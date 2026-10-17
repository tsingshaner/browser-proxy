import { runInNewContext } from 'node:vm'

import { describe, expect, test } from 'vitest'

import { exportBackup, generatePac, inspectBackup, parseConfig, resolveTarget } from './index'

const input = {
  defaultTarget: 'direct',
  mode: 'auto',
  profiles: [{ host: 'localhost', id: 'proxy', name: 'Proxy', port: 8080, scheme: 'http' }],
  revision: 2,
  ruleProfiles: [
    {
      defaultTarget: 'proxy',
      id: 'nested',
      name: 'Nested',
      rules: [{ domain: 'direct.example.com', target: 'direct' }]
    }
  ],
  rules: [{ domain: '*.example.com', target: 'nested' }],
  version: 1
}

describe('nested routing graph', () => {
  test('resolves nested first matches and defaults identically in core, PAC, and backups', () => {
    const config = parseConfig(input)
    for (const [host, target, directive] of [
      ['sub.example.com', 'proxy', 'PROXY localhost:8080'],
      ['direct.example.com', 'direct', 'DIRECT'],
      ['example.com', 'direct', 'DIRECT']
    ] as const) {
      expect(resolveTarget(config, host)).toBe(target)
      expect(runInNewContext(`${generatePac(config)};FindProxyForURL('', host)`, { host })).toBe(directive)
    }
    expect(inspectBackup(exportBackup(config))).toEqual({ config, issues: [], legacy: false })
  })
  test('rejects cycles through defaults or rules', () => {
    expect(() =>
      parseConfig({ ...input, ruleProfiles: [{ ...input.ruleProfiles[0], defaultTarget: 'auto' }] })
    ).toThrow('invalid-rule')
  })
  test('rejects missing references', () => {
    expect(() => parseConfig({ ...input, ruleProfiles: [] })).toThrow('invalid-rule')
  })
  test('rejects more than 32 nested rule profiles', () => {
    const ruleProfiles = Array.from({ length: 33 }, (_, i) => ({
      defaultTarget: i === 32 ? 'direct' : `r${i + 1}`,
      id: `r${i}`,
      name: `Rule ${i}`,
      rules: []
    }))
    expect(() => parseConfig({ ...input, ruleProfiles, rules: [] })).toThrow('invalid-rule')
  })
})

describe('legacy nested migration', () => {
  test('restores multiple switch profiles and virtual references without activating them', () => {
    const legacy = {
      '+alias': { defaultProfileName: 'Nested', name: 'Alias', profileType: 'VirtualProfile' },
      '+fixed': {
        fallbackProxy: { host: 'localhost', port: 8080, scheme: 'http' },
        name: 'Fixed',
        profileType: 'FixedProfile'
      },
      '+nested': { defaultProfileName: 'Fixed', name: 'Nested', profileType: 'SwitchProfile', rules: [] },
      '+root': {
        defaultProfileName: 'direct',
        name: 'Root',
        profileType: 'SwitchProfile',
        rules: [
          { condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'Alias' }
        ]
      },
      schemaVersion: 2
    }
    const preview = inspectBackup(JSON.stringify(legacy))
    expect(preview.issues).toEqual([])
    expect(preview.config.mode).toBe('system')
    expect(preview.config.ruleProfiles).toHaveLength(3)
    const root = preview.config.ruleProfiles?.find((profile) => profile.name === 'Root')
    if (!root) {
      throw new Error('Missing imported root profile')
    }
    const config = { ...preview.config, mode: root.id }
    expect(resolveTarget(config, 'sub.example.com')).toBe('legacy-0')
    expect(resolveTarget(config, 'example.com')).toBe('legacy-0')
    expect(resolveTarget(config, 'other.com')).toBe('direct')
    expect(inspectBackup(exportBackup(config)).config).toEqual(config)
  })
  test('rejects a cycle in legacy virtual references', () => {
    expect(() =>
      inspectBackup(
        JSON.stringify({
          '+a': { defaultProfileName: 'B', name: 'A', profileType: 'VirtualProfile' },
          '+b': { defaultProfileName: 'A', name: 'B', profileType: 'VirtualProfile' },
          schemaVersion: 2
        })
      )
    ).toThrow('invalid-rule')
  })
})
