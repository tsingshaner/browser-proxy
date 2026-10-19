import { runInNewContext } from 'node:vm'

import { parseConfig } from '@browser-tookits/core'
import { expect, test } from 'vitest'

import { proxyValue } from './proxy-settings'

test('maps system and direct modes to each browser settings API', () => {
  expect(proxyValue(parseConfig('system'), true)).toEqual({ proxyType: 'system' })
  expect(proxyValue(parseConfig('direct'), true)).toEqual({ proxyType: 'none' })
  expect(proxyValue(parseConfig('direct'), false)).toEqual({ mode: 'direct' })
})
test('uses a Firefox PAC URL for fixed HTTPS proxies and domain routing', () => {
  const fixed = parseConfig({
    mode: 'office',
    profiles: [{ host: 'localhost', id: 'office', name: 'Office', port: 8443, scheme: 'https' }],
    revision: 0,
    version: 1
  })
  const value = proxyValue(fixed, true)
  expect(value).toHaveProperty('proxyType', 'autoConfig')
  if (!('autoConfigUrl' in value && value.autoConfigUrl)) {
    throw new Error('missing PAC URL')
  }
  const script = decodeURIComponent(value.autoConfigUrl.split(',').slice(1).join(','))
  expect(runInNewContext(`${script}; FindProxyForURL('', 'example.test')`)).toBe('HTTPS localhost:8443')
  const automatic = { ...fixed, mode: 'auto', rules: [{ domain: '*.example.test', target: 'office' }] }
  const autoValue = proxyValue(automatic, true)
  if (!('autoConfigUrl' in autoValue && autoValue.autoConfigUrl)) {
    throw new Error('missing PAC URL')
  }
  const autoScript = decodeURIComponent(autoValue.autoConfigUrl.split(',').slice(1).join(','))
  expect(runInNewContext(`${autoScript}; FindProxyForURL('', 'sub.example.test')`)).toBe('HTTPS localhost:8443')
  expect(runInNewContext(`${autoScript}; FindProxyForURL('', 'example.test')`)).toBe('DIRECT')
})
