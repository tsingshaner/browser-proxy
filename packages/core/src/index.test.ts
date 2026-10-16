import { describe, expect, test } from 'vitest';
import { parseProfile } from './index';

describe('fixed proxy configuration', () => {
  test('normalizes a domain server while preserving the selected protocol and port', () => {
    expect(parseProfile({ id: 'office', name: ' Office ', scheme: 'http', host: 'PROXY.EXAMPLE.COM', port: 8080 }))
      .toEqual({ id: 'office', name: 'Office', scheme: 'http', host: 'proxy.example.com', port: 8080 });
  });
});

test.each(['127.0.0.1', '::1', '[2001:db8::1]', '代理.example'])('accepts a proxy server address: %s', host => {
  expect(parseProfile({ id: 'p', name: 'Proxy', scheme: 'socks5', host, port: 1080 }).host).toBeTruthy();
});
test.each([
  { host: 'http://example.com' }, { host: 'example.com:80' }, { host: 'user@example.com' },
  { host: 'a..example' }, { host: '-bad.example' }, { host: '.' },
  { port: 0 }, { port: 65536 }, { port: 1.5 }, { scheme: 'ftp' }, { name: '  ' },
])('rejects malformed profiles: %j', patch => {
  expect(() => parseProfile({ id: 'p', name: 'Proxy', scheme: 'http', host: 'localhost', port: 80, ...patch })).toThrow('invalid-profile');
});

test('preserves HTTP credentials and rejects unsupported or malformed authentication', () => {
  const profile = { id: 'p', name: 'Proxy', scheme: 'http', host: 'localhost', port: 80, auth: { username: 'user', password: 'secret' } };
  expect(parseProfile(profile).auth).toEqual(profile.auth);
  expect(() => parseProfile({ ...profile, scheme: 'socks5' })).toThrow('invalid-profile');
  expect(() => parseProfile({ ...profile, auth: { username: 'user', password: 123 } })).toThrow('invalid-profile');
});
