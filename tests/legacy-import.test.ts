import { runInNewContext } from 'node:vm'

import { expect, test } from 'vitest'

import { generatePac, inspectBackup } from '../packages/core/src/index'

test('keeps historical wildcard routing when importing a legacy switch profile', () => {
  const legacy = {
    '+auto': {
      defaultProfileName: 'direct',
      name: 'auto',
      profileType: 'SwitchProfile',
      rules: [
        { condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'proxy' },
        { condition: { conditionType: 'HostWildcardCondition', pattern: '**.other.com' }, profileName: 'proxy' }
      ]
    },
    '+proxy': {
      bypassList: [],
      fallbackProxy: { host: 'localhost', port: 8080, scheme: 'http' },
      name: 'proxy',
      profileType: 'FixedProfile'
    },
    schemaVersion: 2
  }
  // Captured from the legacy generator before its removal.
  const expected = ['PROXY localhost:8080', 'PROXY localhost:8080', 'DIRECT', 'DIRECT', 'PROXY localhost:8080']
  const modernScript = generatePac({ ...inspectBackup(JSON.stringify(legacy)).config, mode: 'auto' })
  for (const [index, host] of [
    'example.com',
    'sub.example.com',
    'badexample.com',
    'other.com',
    'sub.other.com'
  ].entries()) {
    const result = (script: string) =>
      runInNewContext(`${script}; FindProxyForURL(url, host)`, { host, url: `https://${host}/` })
    expect(result(modernScript), host).toBe(expected[index])
  }
})
