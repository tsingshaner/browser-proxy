import { afterEach, describe, expect, test, vi } from 'vitest'

import { createPublisher } from '../dnr/publisher'
import { defaults as headerDefaults } from '../headers/config'
import { CONFIG_KEY, defaults, RULE_ID, rules, validate } from './config'

import type { Config } from './config'

const config: Config = {
  enabled: true,
  source: 'https://source.example/',
  target: 'https://destination.example/git/',
  version: 1
}
function fake(initial: unknown = config, accessLevel = true) {
  const state = {
    active: [{ id: 99 }, ...rules(config)] as chrome.declarativeNetRequest.Rule[],
    failRules: false,
    failWrite: false,
    granted: true,
    headerStored: undefined as unknown,
    stored: initial,
    supported: true
  }
  const api = {
    declarativeNetRequest: {
      getDynamicRules: async () => state.active,
      isRegexSupported: async () => ({ isSupported: state.supported }),
      updateDynamicRules: async ({ removeRuleIds, addRules }: chrome.declarativeNetRequest.UpdateRuleOptions) => {
        if (state.failRules) {
          throw new Error('rules')
        }
        state.active = [...state.active.filter((rule) => !removeRuleIds?.includes(rule.id)), ...(addRules ?? [])]
      }
    },
    permissions: { contains: async () => state.granted },
    storage: {
      local: {
        get: async () => ({ [CONFIG_KEY]: state.stored, headerRules: state.headerStored }),
        set: async (value: Record<string, unknown>) => {
          if (state.failWrite) {
            throw new Error('disk')
          }
          if (CONFIG_KEY in value) {
            state.stored = value[CONFIG_KEY]
          }
          if ('headerRules' in value) {
            state.headerStored = value.headerRules
          }
        },
        ...(accessLevel ? { setAccessLevel: async () => undefined } : {})
      }
    }
  }
  return { api, controller: createPublisher(api as unknown as typeof chrome).controller('pathRedirect'), state }
}

describe('path redirect rules', () => {
  test.each(['', 'repo/tree/FeatureABC?ref=Main&path=a%2Fb', '?q=hello%20world', '%E4%B8%AD/file.txt'])(
    'preserves suffix %s',
    (suffix) => {
      const rule = rules(config)[0]
      const match = new RegExp(rule.condition.regexFilter ?? '', 'i').exec(config.source + suffix)
      expect(rule.action.redirect?.regexSubstitution?.replace('\\1', match?.[1] ?? '')).toBe(config.target + suffix)
      expect(rule.condition.resourceTypes).toEqual(['main_frame'])
      expect(rule.condition.requestMethods).toEqual(['get'])
    }
  )
  test.each([
    'https://source.example.evil/repo',
    'https://sub.source.example/repo',
    'https://source.example@evil.example/repo',
    'http://source.example/repo',
    config.target
  ])('does not redirect %s', (url) => {
    expect(new RegExp(rules(config)[0].condition.regexFilter ?? '', 'i').test(url)).toBe(false)
  })
  test('normalizes roots and accepts old unversioned settings', () => {
    expect(validate({ enabled: true, source: 'https://source.example', target: config.target })).toEqual(config)
  })
  test('has no rule by default or when disabled', () => {
    expect(rules(defaults())).toEqual([])
    expect(rules({ ...config, enabled: false })).toEqual([])
  })
  test.each([
    { source: 'http://source.example/' },
    { source: 'https://*.example/' },
    { source: 'https:source.example' },
    { target: 'https://dest.example/?' },
    { source: 'https://source.example/sub/' },
    { source: 'https://u:p@source.example/' },
    { target: config.source },
    { target: 'javascript:alert(1)' },
    { target: 'https://dest.example/path' },
    { target: 'https://dest.example/?x=1' },
    { target: 'https://dest.example/#x' },
    { target: 'https://dest.example/\\1/' },
    { source: 'https://source.example:8443/' },
    { enabled: 'false' },
    { version: 2 },
    { target: `https://dest.example/${'a'.repeat(1500)}/` },
    { source: 'https://source.example /' }
  ])('rejects invalid configuration %j', (change) => {
    expect(() => validate({ ...config, ...change })).toThrow()
  })
})

describe('redirect controller', () => {
  test.each([true, false])('persists and restores rules with setAccessLevel available: %s', async (accessLevel) => {
    const { controller, state } = fake(config, accessLevel)
    const updated = { ...config, target: 'https://new.example/custom/' }
    await expect(controller.save(updated)).resolves.toEqual(updated)
    expect(state.stored).toEqual(updated)
    await controller.load()
    expect(state.active).toEqual([{ id: 99 }, ...rules(updated)])
  })
  test('disable removes only its own rule and preserves addresses', async () => {
    const { controller, state } = fake()
    await controller.disable()
    await controller.load()
    expect(state.active).toEqual([{ id: 99 }])
    expect(state.stored).toEqual({ ...config, enabled: false })
  })
  test('permission rejection preserves saved settings', async () => {
    const { controller, state } = fake()
    state.granted = false
    await expect(controller.save({ ...config, target: 'https://new.example/' })).rejects.toThrow('redirectPermission')
    expect(state.stored).toEqual(config)
  })
  test('permission revocation removes the active rule', async () => {
    const { controller, state } = fake()
    state.granted = false
    await expect(controller.load()).rejects.toThrow('redirectPermission')
    expect(state.active).toEqual([{ id: 99 }])
  })
  test('unsupported regex preserves existing rules and settings on save', async () => {
    const { controller, state } = fake()
    state.supported = false
    await expect(controller.save({ ...config, target: 'https://new.example/' })).rejects.toThrow('redirectUnsupported')
    expect(state.active).toEqual([{ id: 99 }, ...rules(config)])
    expect(state.stored).toEqual(config)
  })
  test('storage failure rolls back rules', async () => {
    const { controller, state } = fake()
    state.failWrite = true
    await expect(controller.save({ ...config, target: 'https://new.example/' })).rejects.toThrow('redirectSaveFailed')
    expect(state.active.find((rule) => rule.id === RULE_ID)).toEqual(rules(config)[0])
  })
  test('rule failure never saves', async () => {
    const { controller, state } = fake()
    state.failRules = true
    await expect(controller.save({ ...config, enabled: false })).rejects.toThrow('rules')
    expect(state.stored).toEqual(config)
  })
  test('corrupt config removes rules and explicit disable repairs it', async () => {
    const { controller, state } = fake({ garbage: true })
    await expect(controller.load()).rejects.toThrow()
    expect(state.active).toEqual([{ id: 99 }])
    await controller.disable()
    expect(state.stored).toEqual(defaults())
  })
  test('missing config disables stale rules', async () => {
    const { controller, state } = fake()
    state.stored = undefined
    await expect(controller.load()).resolves.toEqual(defaults())
    expect(state.active).toEqual([{ id: 99 }])
  })
  test('concurrent save and disable finish disabled', async () => {
    const { controller, state } = fake()
    await Promise.all([controller.save(config), controller.disable()])
    expect(state.stored).toEqual({ ...config, enabled: false })
    expect(state.active).toEqual([{ id: 99 }])
  })
})

describe('network rule background', () => {
  afterEach(() => {
    // cspell:ignore unstub
    vi.unstubAllGlobals()
    vi.resetModules()
  })
  test.each(['pathRedirect', 'headerRules'] as const)(
    'only extension pages can save %s; unrelated messages are ignored',
    async (feature) => {
      const { api, state } = fake()
      const addListener = vi.fn()
      const onMessage = vi.fn()
      vi.stubGlobal('chrome', {
        ...api,
        permissions: { ...api.permissions, onAdded: { addListener }, onRemoved: { addListener } },
        runtime: {
          getURL: () => 'chrome-extension://extension-id/',
          id: 'extension-id',
          onInstalled: { addListener },
          onMessage: { addListener: onMessage },
          onStartup: { addListener }
        },
        storage: { ...api.storage, onChanged: { addListener } }
      })
      await import('../dnr/background')
      const listener = onMessage.mock.calls[0][0] as (
        message: unknown,
        sender: chrome.runtime.MessageSender,
        respond: (value: unknown) => void
      ) => boolean
      const sender = {
        id: 'extension-id',
        tab: { id: 1 } as chrome.tabs.Tab,
        url: 'chrome-extension://extension-id/src/options/index.html'
      }
      const updated = feature === 'pathRedirect' ? { ...config, target: 'https://new.example/' } : headerDefaults()
      const saved = feature === 'pathRedirect' ? updated : { ...updated, revision: 1 }
      const message = { action: 'save', config: updated, feature }
      const respond = vi.fn()
      expect(listener(message, { ...sender, id: 'another-extension' }, respond)).toBe(false)
      expect(
        listener(message, { ...sender, tab: { id: 1 } as chrome.tabs.Tab, url: 'https://source.example/' }, respond)
      ).toBe(false)
      expect(listener(message, { id: sender.id }, respond)).toBe(false)
      expect(listener({ type: 'get-config' }, sender, respond)).toBe(false)
      expect(listener({ action: 'unknown', feature: 'pathRedirect' }, sender, respond)).toBe(false)
      expect(respond).not.toHaveBeenCalled()
      const response = new Promise((resolve) => {
        expect(listener(message, sender, resolve)).toBe(true)
      })
      await expect(response).resolves.toEqual({ config: saved, ok: true })
      expect(feature === 'pathRedirect' ? state.stored : state.headerStored).toEqual(saved)
      expect(state.active).toEqual([{ id: 99 }, ...rules(state.stored as Config)])
    }
  )
})
