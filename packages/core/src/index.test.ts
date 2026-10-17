import { describe, expect, test } from 'vitest'

import { parseProfile } from './index'

describe('fixed proxy configuration', () => {
  test('normalizes a domain server while preserving the selected protocol and port', () => {
    expect(
      parseProfile({ host: 'PROXY.EXAMPLE.COM', id: 'office', name: ' Office ', port: 8080, scheme: 'http' })
    ).toEqual({ host: 'proxy.example.com', id: 'office', name: 'Office', port: 8080, scheme: 'http' })
  })
})

test.each(['127.0.0.1', '::1', '[2001:db8::1]', '代理.example'])('accepts a proxy server address: %s', (host) => {
  expect(parseProfile({ host, id: 'p', name: 'Proxy', port: 1080, scheme: 'socks5' }).host).toBeTruthy()
})
test.each([
  { host: 'http://example.com' },
  { host: 'example.com:80' },
  { host: 'user@example.com' },
  { host: 'a..example' },
  { host: '-bad.example' },
  { host: '.' },
  { port: 0 },
  { port: 65536 },
  { port: 1.5 },
  { scheme: 'ftp' },
  { name: '  ' }
])('rejects malformed profiles: %j', (patch) => {
  expect(() => parseProfile({ host: 'localhost', id: 'p', name: 'Proxy', port: 80, scheme: 'http', ...patch })).toThrow(
    'invalid-profile'
  )
})

test('preserves HTTP credentials and rejects unsupported or malformed authentication', () => {
  const profile = {
    auth: { password: 'secret', username: 'user' },
    host: 'localhost',
    id: 'p',
    name: 'Proxy',
    port: 80,
    scheme: 'http'
  }
  expect(parseProfile(profile).auth).toEqual(profile.auth)
  expect(() => parseProfile({ ...profile, scheme: 'socks5' })).toThrow('invalid-profile')
  expect(() => parseProfile({ ...profile, auth: { password: 123, username: 'user' } })).toThrow('invalid-profile')
})
