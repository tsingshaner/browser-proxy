import { describe, expect, test } from 'vitest'

import * as headers from '../headers/config'
import * as redirect from '../redirect/config'
import { createPublisher } from './publisher'

const redirectConfig: redirect.Config = {
  enabled: true,
  source: 'https://source.example/',
  target: 'https://destination.example/',
  version: 1
}
const headerConfig: headers.Config = {
  ...headers.defaults(),
  enabled: true,
  rules: [
    {
      enabled: true,
      header: 'x-env',
      id: 'one',
      match: 'domain',
      method: 'any',
      name: 'Test',
      operation: 'set',
      pattern: 'api.example.com',
      resource: 'any',
      target: 'request',
      value: 'test'
    }
  ]
}
function fake() {
  const state = {
    active: [
      { id: 99 },
      ...redirect.rules(redirectConfig),
      ...headers.rules(headerConfig)
    ] as chrome.declarativeNetRequest.Rule[],
    calls: 0,
    failRead: false,
    failWrite: false,
    regexSupported: true,
    rejectCalls: [] as number[],
    rejectUpdates: 0,
    revokeHeaders: false,
    stored: { headerRules: headerConfig, pathRedirect: redirectConfig } as Record<string, unknown>
  }
  const api = {
    declarativeNetRequest: {
      getDynamicRules: () => Promise.resolve(structuredClone(state.active)),
      isRegexSupported: () => Promise.resolve({ isSupported: state.regexSupported }),
      updateDynamicRules: ({ addRules = [], removeRuleIds = [] }: chrome.declarativeNetRequest.UpdateRuleOptions) => {
        state.calls += 1
        if (state.rejectUpdates > 0 || state.rejectCalls.includes(state.calls)) {
          state.rejectUpdates = Math.max(0, state.rejectUpdates - 1)
          return Promise.reject(new Error('browser rejected rules'))
        }
        state.active = [
          ...state.active.filter((rule) => !removeRuleIds.includes(rule.id)),
          ...structuredClone(addRules)
        ]
        return Promise.resolve()
      }
    },
    permissions: {
      contains: ({ origins }: { origins: string[] }) =>
        Promise.resolve(!(state.revokeHeaders && origins.some((origin) => origin.includes('api.example.com'))))
    },
    storage: {
      local: {
        get: () =>
          state.failRead ? Promise.reject(new Error('disk')) : Promise.resolve(structuredClone(state.stored)),
        set: (value: Record<string, unknown>) => {
          if (state.failWrite) {
            return Promise.reject(new Error('disk'))
          }
          state.stored = { ...state.stored, ...structuredClone(value) }
          return Promise.resolve()
        }
      }
    }
  } as unknown as typeof chrome
  const publisher = createPublisher(api)
  return {
    api,
    headerController: publisher.controller('headerRules'),
    publisher,
    redirectController: publisher.controller('pathRedirect'),
    state
  }
}

describe('shared DNR publisher', () => {
  test('serializes concurrent feature saves without overwriting either feature', async () => {
    const { state, headerController, redirectController } = fake()
    const nextHeaders = { ...headerConfig, rules: [{ ...headerConfig.rules[0], value: 'next' }] }
    const nextRedirect = { ...redirectConfig, target: 'https://new.example/' }
    await Promise.all([headerController.save(nextHeaders), redirectController.save(nextRedirect)])
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(nextRedirect), ...headers.rules(nextHeaders)])
    expect(state.stored).toEqual({ headerRules: { ...nextHeaders, revision: 1 }, pathRedirect: nextRedirect })
  })
  test.each(['headerRules', 'pathRedirect'] as const)(
    'disabling %s preserves the other feature and unrelated rules',
    async (feature) => {
      const { state, publisher } = fake()
      await publisher.controller(feature).disable()
      expect(state.active).toEqual([
        { id: 99 },
        ...(feature === 'headerRules' ? redirect.rules(redirectConfig) : headers.rules(headerConfig))
      ])
    }
  )
  test('restores both persisted features after a background restart', async () => {
    const { api, state } = fake()
    state.active = [{ id: 99 }] as chrome.declarativeNetRequest.Rule[]
    await createPublisher(api).reconcile()
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(redirectConfig), ...headers.rules(headerConfig)])
  })
  test('rejects stale header edits', async () => {
    const { state, headerController } = fake()
    await headerController.save(headerConfig)
    await expect(headerController.save(headerConfig)).rejects.toThrow('conflict')
    expect(state.stored.headerRules).toEqual({ ...headerConfig, revision: 1 })
  })
  test('rolls back both rule groups when persistence fails', async () => {
    const { state, headerController } = fake()
    const previous = structuredClone(state.active)
    state.failWrite = true
    await expect(headerController.save({ ...headerConfig, enabled: false })).rejects.toThrow('headersSaveFailed')
    expect(state.active).toEqual(previous)
    expect(state.stored.headerRules).toEqual(headerConfig)
  })
  test('does not persist if the browser rejects an update', async () => {
    const { state, headerController } = fake()
    const previous = structuredClone(state.active)
    state.rejectUpdates = 1
    await expect(headerController.save({ ...headerConfig, enabled: false })).rejects.toThrow('browser rejected rules')
    expect(state.active).toEqual(previous)
    expect(state.stored.headerRules).toEqual(headerConfig)
  })
  test('clears owned rules if rollback fails and reports recovery failure', async () => {
    const { state, headerController } = fake()
    state.failWrite = true
    state.rejectCalls = [2]
    await expect(headerController.save({ ...headerConfig, enabled: false })).rejects.toThrow('dnrRecoveryFailed')
    expect(state.active).toEqual([{ id: 99 }])
  })
  test('explicit disable stays inactive when persistence fails', async () => {
    const { state, headerController } = fake()
    state.failWrite = true
    await expect(headerController.disable()).rejects.toThrow('dnrDisableSaveFailed')
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(redirectConfig)])
  })
  test('explicit disable removes rules even if storage cannot be read', async () => {
    const { state, headerController } = fake()
    state.failRead = true
    await expect(headerController.disable()).rejects.toThrow('dnrDisableSaveFailed')
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(redirectConfig)])
  })
  test('revoking header site access removes only header rules and reports it', async () => {
    const { state, headerController } = fake()
    state.revokeHeaders = true
    await expect(headerController.load()).rejects.toThrow('headersPermission')
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(redirectConfig)])
  })
  test('rejects unsupported regex before changing stored or active rules', async () => {
    const { state, headerController } = fake()
    const previous = structuredClone(state.active)
    state.regexSupported = false
    await expect(headerController.save(headerConfig)).rejects.toThrow('headersUnsupported')
    expect(state.active).toEqual(previous)
    expect(state.stored.headerRules).toEqual(headerConfig)
  })
  test('corrupt header settings do not disable redirects and can be repaired', async () => {
    const { state, headerController } = fake()
    state.stored.headerRules = { garbage: true }
    await expect(headerController.load()).rejects.toThrow('headersInvalid')
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(redirectConfig)])
    await headerController.disable()
    expect(state.stored.headerRules).toEqual({ ...headers.defaults(), revision: 1 })
  })
  test('removed configuration cleans stale header rules', async () => {
    const { state, headerController } = fake()
    delete state.stored.headerRules
    await expect(headerController.load()).resolves.toEqual(headers.defaults())
    expect(state.active).toEqual([{ id: 99 }, ...redirect.rules(redirectConfig)])
  })
  test('invalid messages never activate defaults in place of saved rules', async () => {
    const { state, headerController } = fake()
    await expect(headerController.save(undefined)).rejects.toThrow('dnrInvalid')
    expect(state.stored.headerRules).toEqual(headerConfig)
  })
})
