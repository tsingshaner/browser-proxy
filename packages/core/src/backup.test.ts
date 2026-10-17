import { describe, expect, test } from 'vitest'

import { exportBackup, inspectBackup } from './backup'
import { parseConfig } from './index'

const modern = parseConfig({
  defaultTarget: 'office',
  mode: 'auto',
  profiles: [
    {
      auth: { password: 'secret', username: 'user' },
      host: 'localhost',
      id: 'office',
      name: 'Office',
      port: 8080,
      scheme: 'http'
    }
  ],
  revision: 8,
  rules: [
    { domain: 'exact.example', target: 'direct' },
    { domain: '*.example', target: 'office' }
  ],
  version: 1
})
const legacy = {
  '+auto': {
    defaultProfileName: 'direct',
    name: 'auto',
    profileType: 'SwitchProfile',
    rules: [
      { condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'proxy' },
      { condition: { conditionType: 'HostWildcardCondition', pattern: '**.other.com' }, profileName: 'direct' }
    ]
  },
  '+proxy': {
    auth: { all: { password: 'secret', username: 'user' } },
    fallbackProxy: { host: 'localhost', port: 8080, scheme: 'http' },
    name: 'proxy',
    profileType: 'FixedProfile'
  },
  schemaVersion: 2
}

describe('configuration backup boundary', () => {
  test('round trips credentials, ordered rules, default connection and selected mode', () => {
    expect(inspectBackup(exportBackup(modern))).toEqual({ config: modern, issues: [], legacy: false })
  })
  test.each(['{', 'null', '"direct"', '{"version":999}', '{"profiles":[]}'])(
    'rejects invalid documents: %s',
    (text) => {
      expect(() => inspectBackup(text)).toThrow()
    }
  )
  test('preserves legacy wildcard apex behavior and translates authentication', () => {
    const result = inspectBackup(JSON.stringify(legacy))
    expect(result.issues).toEqual([])
    expect(result.config.mode).toBe('system')
    expect(result.config.profiles[0]?.auth).toEqual({ password: 'secret', username: 'user' })
    expect(result.config.rules).toEqual([
      { domain: 'example.com', target: 'legacy-0' },
      { domain: '*.example.com', target: 'legacy-0' },
      { domain: '*.other.com', target: 'direct' }
    ])
  })
  test('reports advanced PAC, IP rules, bypasses, and sync settings before partial import', () => {
    const old = {
      ...legacy,
      '-syncOptions': { token: 'do not include in report' },
      '+auto': {
        ...legacy['+auto'],
        rules: [
          ...legacy['+auto'].rules,
          { condition: { conditionType: 'IpCondition', pattern: '10.0.0.0/8' }, profileName: 'direct' }
        ]
      },
      '+pac': { pacScript: 'do not execute', profileType: 'PacProfile' },
      '+proxy': { ...legacy['+proxy'], bypassList: [{ conditionType: 'BypassCondition', pattern: '127.0.0.1' }] }
    }
    const result = inspectBackup(JSON.stringify(old))
    expect(result.issues.map((issue) => issue.reason)).toEqual(
      expect.arrayContaining(['unsupported-profile', 'unsupported-rule', 'unsupported-bypass', 'unsupported-setting'])
    )
    expect(JSON.stringify(result.issues)).not.toContain('do not include')
    expect(result.config.rules).toHaveLength(3)
    expect(result.config.mode).toBe('system')
  })
})
