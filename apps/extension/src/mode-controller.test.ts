import { parseConfig } from '@browser-proxy/core'
import { describe, expect, test } from 'vitest'

import { createModeController } from './mode-controller'

describe('mode selection through the background boundary', () => {
  test('applies and persists a requested mode', async () => {
    let stored: unknown = 'system'
    let active: unknown = 'system'
    const controller = createModeController({
      apply: (mode) => {
        active = mode.mode
        return Promise.resolve()
      },
      read: async () => stored,
      write: (mode) => {
        stored = mode
        return Promise.resolve()
      }
    })

    await controller.ready
    await expect(controller.handle({ mode: 'direct', revision: 0, type: 'set-mode' })).resolves.toMatchObject({
      mode: 'direct'
    })
    expect(stored).toMatchObject({ mode: 'direct', revision: 1 })
    expect(active).toBe('direct')
  })

  test('restores the saved mode after the background restarts', async () => {
    let active: unknown
    const controller = createModeController({
      apply: (mode) => {
        active = mode.mode
        return Promise.resolve()
      },
      read: async () => 'direct',
      write: async () => {}
    })
    await controller.ready
    expect(active).toBe('direct')
    await expect(controller.handle({ type: 'get-config' })).resolves.toMatchObject({ mode: 'direct' })
  })

  test('rolls back the active mode when saving fails and allows retry', async () => {
    let active: unknown = 'system'
    let fail = true
    const controller = createModeController({
      apply: (mode) => {
        active = mode.mode
        return Promise.resolve()
      },
      read: async () => 'system',
      write: () => {
        if (fail) {
          return Promise.reject(new Error('disk full'))
        }
        return Promise.resolve()
      }
    })
    await controller.ready
    await expect(controller.handle({ mode: 'direct', revision: 0, type: 'set-mode' })).rejects.toThrow('save-failed')
    expect(active).toBe('system')
    await expect(controller.handle({ type: 'get-config' })).resolves.toMatchObject({ mode: 'system' })
    fail = false
    await expect(controller.handle({ mode: 'direct', revision: 0, type: 'set-mode' })).resolves.toMatchObject({
      mode: 'direct'
    })
  })

  test.each([null, {}, { mode: 'pac_script', revision: 0, type: 'set-mode' }])(
    'rejects invalid requests without changing the mode: %j',
    async (message) => {
      let active: unknown
      const controller = createModeController({
        apply: (mode) => {
          active = mode.mode
          return Promise.resolve()
        },
        read: async () => 'system',
        write: async () => {}
      })
      await controller.ready
      await expect(controller.handle(message)).rejects.toThrow('invalid-request')
      expect(active).toBe('system')
    }
  )

  test('does not overwrite unsupported stored configuration', async () => {
    const applied: string[] = []
    const controller = createModeController({
      apply: (mode) => {
        applied.push(mode.mode)
        return Promise.resolve()
      },
      read: async () => ({ old: 'config' }),
      write: async () => {}
    })
    await expect(controller.ready).rejects.toThrow('invalid-config')
    expect(applied).toEqual([])
  })

  test('retries initialization after proxy control becomes available', async () => {
    let blocked = true
    const controller = createModeController({
      apply: () => {
        if (blocked) {
          return Promise.reject(new Error('proxy-unavailable'))
        }
        return Promise.resolve()
      },
      read: async () => 'system',
      write: async () => {}
    })
    await expect(controller.ready).rejects.toThrow('proxy-unavailable')
    blocked = false
    await expect(controller.handle({ type: 'get-config' })).resolves.toMatchObject({ mode: 'system' })
  })
})

describe('fixed profiles through the background boundary', () => {
  const profile = { host: 'localhost', id: 'office', name: 'Office', port: 8080, scheme: 'http' }
  test('creates, selects, edits, and deletes profiles after switching away', async () => {
    let stored: unknown
    let active = parseConfig(undefined)
    const controller = createModeController({
      apply: (config) => {
        active = config
        return Promise.resolve()
      },
      read: async () => stored,
      write: (config) => {
        stored = config
        return Promise.resolve()
      }
    })
    await controller.handle({ profile, revision: 0, type: 'save-profile' })
    await controller.handle({ mode: 'office', revision: 1, type: 'set-mode' })
    expect(active).toMatchObject({ mode: 'office', profiles: [profile] })
    await controller.handle({ profile: { ...profile, port: 9000 }, revision: 2, type: 'save-profile' })
    expect(active.profiles[0]?.port).toBe(9000)
    await expect(controller.handle({ id: 'office', revision: 3, type: 'delete-profile' })).rejects.toThrow(
      'active-profile'
    )
    await controller.handle({ mode: 'system', revision: 3, type: 'set-mode' })
    await controller.handle({ id: 'office', revision: 4, type: 'delete-profile' })
    expect(stored).toMatchObject({ mode: 'system', profiles: [], revision: 5 })
  })
  test('rejects a stale page without overwriting a newer save', async () => {
    let stored: unknown
    const controller = createModeController({
      apply: async () => {},
      read: async () => stored,
      write: (config) => {
        stored = config
        return Promise.resolve()
      }
    })
    await controller.handle({ profile, revision: 0, type: 'save-profile' })
    await expect(
      controller.handle({ profile: { ...profile, name: 'Stale' }, revision: 0, type: 'save-profile' })
    ).rejects.toThrow('conflict')
    expect(stored).toMatchObject({ profiles: [profile], revision: 1 })
  })
})

test('saves domain rules, applies automatic routing, and protects referenced profiles', async () => {
  let stored: unknown
  let active = parseConfig(undefined)
  const controller = createModeController({
    apply: (config) => {
      active = config
      return Promise.resolve()
    },
    read: async () => stored,
    write: (config) => {
      stored = config
      return Promise.resolve()
    }
  })
  await controller.handle({
    profile: { host: 'localhost', id: 'office', name: 'Office', port: 8080, scheme: 'http' },
    revision: 0,
    type: 'save-profile'
  })
  await controller.handle({
    defaultTarget: 'direct',
    revision: 1,
    rules: [{ domain: 'EXAMPLE.COM.', target: 'office' }],
    type: 'save-rules'
  })
  await controller.handle({ mode: 'auto', revision: 2, type: 'set-mode' })
  expect(active).toMatchObject({
    defaultTarget: 'direct',
    mode: 'auto',
    rules: [{ domain: 'example.com', target: 'office' }]
  })
  await expect(controller.handle({ id: 'office', revision: 3, type: 'delete-profile' })).rejects.toThrow(
    'referenced-profile'
  )
  await expect(
    controller.handle({
      defaultTarget: 'direct',
      revision: 3,
      rules: [{ domain: 'bad/path', target: 'office' }],
      type: 'save-rules'
    })
  ).rejects.toThrow('invalid-rule')
  await expect(controller.handle({ revision: 3, type: 'save-rules' })).rejects.toThrow('invalid-rule')
  expect(stored).toMatchObject({ revision: 3 })
})

test('validates imported backups before replacing current configuration and checks conflicts', async () => {
  let stored: unknown = 'direct'
  const controller = createModeController({
    apply: async () => {},
    read: async () => stored,
    write: (config) => {
      stored = config
      return Promise.resolve()
    }
  })
  await expect(controller.handle({ revision: 0, text: '{', type: 'import-config' })).rejects.toThrow()
  expect(stored).toBe('direct')
  const backup = JSON.stringify({ ...parseConfig('system'), revision: 99 })
  await controller.handle({ revision: 0, text: backup, type: 'import-config' })
  expect(stored).toMatchObject({ mode: 'system', revision: 1 })
  await expect(controller.handle({ revision: 0, text: backup, type: 'import-config' })).rejects.toThrow('conflict')
})

test('requires explicit confirmation before importing only supported legacy content', async () => {
  let stored: unknown = 'direct'
  const controller = createModeController({
    apply: async () => {},
    read: async () => stored,
    write: (config) => {
      stored = config
      return Promise.resolve()
    }
  })
  const text = JSON.stringify({ '+pac': { pacScript: 'unsupported', profileType: 'PacProfile' }, schemaVersion: 2 })
  await expect(controller.handle({ revision: 0, text, type: 'import-config' })).rejects.toThrow('import-warning')
  expect(stored).toBe('direct')
  await controller.handle({ allowPartial: true, revision: 0, text, type: 'import-config' })
  expect(stored).toMatchObject({ mode: 'system', profiles: [], revision: 1 })
})

describe('nested profile editing', () => {
  test('protects references, detects stale edits, and preserves existing automatic rules', async () => {
    const initial = parseConfig({
      defaultTarget: 'direct',
      mode: 'auto',
      profiles: [],
      revision: 0,
      rules: [{ domain: 'example.com', target: 'direct' }],
      version: 1
    })
    let stored = initial
    const controller = createModeController({
      apply: async () => {},
      read: async () => stored,
      write: (c) => {
        stored = c
        return Promise.resolve()
      }
    })
    await controller.ready
    const group = { defaultTarget: 'direct', id: 'group', name: 'Group', rules: [] }
    await controller.handle({ profile: group, revision: 0, type: 'save-rule-profile' })
    expect(stored.rules).toEqual(initial.rules)
    await expect(controller.handle({ profile: group, revision: 0, type: 'save-rule-profile' })).rejects.toThrow(
      'conflict'
    )
    await controller.handle({ defaultTarget: 'group', revision: 1, rules: [], type: 'save-rules' })
    await expect(controller.handle({ id: 'group', revision: 2, type: 'delete-rule-profile' })).rejects.toThrow(
      'referenced-profile'
    )
    await expect(
      controller.handle({ profile: { ...group, defaultTarget: 'auto' }, revision: 2, type: 'save-rule-profile' })
    ).rejects.toThrow('invalid-rule')
    expect(stored.revision).toBe(2)
    await controller.handle({ defaultTarget: 'direct', revision: 2, rules: [], type: 'save-rules' })
    await controller.handle({ id: 'group', revision: 3, type: 'delete-rule-profile' })
    expect(stored.ruleProfiles).toEqual([])
  })
})
