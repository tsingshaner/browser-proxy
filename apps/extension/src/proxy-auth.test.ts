import { describe, expect, test } from 'vitest';
import { createProxyAuth } from './proxy-auth';
import type { ProxyConfig } from '@browser-proxy/core';

const config: ProxyConfig = { version: 1, revision: 0, mode: 'office', rules: [], defaultTarget: 'direct', profiles: [{
  id: 'office', name: 'Office', scheme: 'http', host: 'proxy.example', port: 8080,
  auth: { username: 'user', password: 'secret' },
}] };
const challenge = { requestId: '1', isProxy: true, challenger: { host: 'proxy.example', port: 8080 } };

describe('proxy authentication boundary', () => {
  test('responds once and cancels a rejected credential without exposing it in feedback', async () => {
    const feedback: boolean[] = [];
    const auth = createProxyAuth(async () => config, async failed => { feedback.push(failed); });
    expect(await auth.respond(challenge)).toEqual({ authCredentials: { username: 'user', password: 'secret' } });
    expect(await auth.respond(challenge)).toEqual({ cancel: true });
    expect(feedback).toEqual([true]);
    await auth.complete('1', false);
    expect(await auth.respond(challenge)).toHaveProperty('authCredentials');
    expect(feedback).toEqual([true]);
    await auth.complete('1', false);
    expect(feedback).toEqual([true]);
    await auth.respond({ ...challenge, requestId: '2' });
    await auth.complete('2', true);
    expect(feedback).toEqual([true, false]);
  });
  test.each([
    { ...challenge, isProxy: false },
    { ...challenge, challenger: { host: 'unrelated.example', port: 8080 } },
    { ...challenge, challenger: { host: 'proxy.example', port: 8081 } },
  ])('does not send credentials to an unrelated challenge: %j', async details => {
    const auth = createProxyAuth(async () => config, async () => {});
    expect(await auth.respond(details)).toEqual({});
  });
  test('uses updated credentials on the next request and ignores inactive profiles', async () => {
    let current = structuredClone(config);
    const auth = createProxyAuth(async () => current, async () => {});
    await auth.respond(challenge);
    current.profiles[0]!.auth!.password = 'updated';
    expect(await auth.respond({ ...challenge, requestId: '2' })).toEqual({ authCredentials: { username: 'user', password: 'updated' } });
    current.mode = 'direct';
    expect(await auth.respond({ ...challenge, requestId: '3' })).toEqual({});
  });
});

test('authenticates only the proxy selected by the current domain rule', async () => {
  const automatic = { ...config, mode: 'auto', rules: [{ domain: 'example.com', target: 'office' }] };
  const auth = createProxyAuth(async () => automatic, async () => {});
  expect(await auth.respond({ ...challenge, url: 'https://example.com/' })).toHaveProperty('authCredentials');
  expect(await auth.respond({ ...challenge, requestId: '2', url: 'https://other.test/' })).toEqual({});
});

test('keeps retry limits per proxy when a redirect reuses the request ID', async () => {
  const automatic: ProxyConfig = { ...config, mode: 'auto',
    profiles: [...config.profiles, { ...config.profiles[0]!, id: 'second', port: 8081 }],
    rules: [{ domain: 'a.test', target: 'office' }, { domain: 'b.test', target: 'second' }] };
  const auth = createProxyAuth(async () => automatic, async () => {});
  const first = { ...challenge, url: 'https://a.test/' };
  expect(await auth.respond(first)).toHaveProperty('authCredentials');
  expect(await auth.respond({ ...challenge, url: 'https://b.test/', challenger: { host: 'proxy.example', port: 8081 } })).toHaveProperty('authCredentials');
  expect(await auth.respond(first)).toEqual({ cancel: true });
});
