import { parseConfig } from '@browser-tookits/core'
import { describe, expect, test } from 'vitest'

import type { ProxyConfig } from '@browser-tookits/core'

import { createProxyAuth } from './proxy-auth'

const config = {
  defaultTarget: 'direct',
  mode: 'office',
  profiles: [
    {
      auth: { password: 'secret', username: 'user' },
      host: 'proxy.example',
      id: 'office',
      name: 'Office',
      port: 8080,
      scheme: 'http'
    }
  ],
  revision: 0,
  rules: [],
  version: 1
} satisfies ProxyConfig
const challenge = { challenger: { host: 'proxy.example', port: 8080 }, isProxy: true, requestId: '1' }

describe('proxy authentication boundary', () => {
  test('responds once and cancels a rejected credential without exposing it in feedback', async () => {
    const feedback: boolean[] = []
    const auth = createProxyAuth(
      async () => config,
      (failed) => {
        feedback.push(failed)
        return Promise.resolve()
      }
    )
    expect(await auth.respond(challenge)).toEqual({ authCredentials: { password: 'secret', username: 'user' } })
    expect(await auth.respond(challenge)).toEqual({ cancel: true })
    expect(feedback).toEqual([true])
    await auth.complete('1', false)
    expect(await auth.respond(challenge)).toHaveProperty('authCredentials')
    expect(feedback).toEqual([true])
    await auth.complete('1', false)
    expect(feedback).toEqual([true])
    await auth.respond({ ...challenge, requestId: '2' })
    await auth.complete('2', true)
    expect(feedback).toEqual([true, false])
  })
  test.each([
    { ...challenge, isProxy: false },
    { ...challenge, challenger: { host: 'unrelated.example', port: 8080 } },
    { ...challenge, challenger: { host: 'proxy.example', port: 8081 } }
  ])('does not send credentials to an unrelated challenge: %j', async (details) => {
    const auth = createProxyAuth(
      async () => config,
      async () => {}
    )
    expect(await auth.respond(details)).toEqual({})
  })
  test('uses updated credentials on the next request and ignores inactive profiles', async () => {
    const current = structuredClone(config)
    const auth = createProxyAuth(
      async () => current,
      async () => {}
    )
    await auth.respond(challenge)
    const [profile] = current.profiles
    if (!profile) {
      throw new Error('Missing proxy fixture')
    }
    profile.auth.password = 'updated'
    expect(await auth.respond({ ...challenge, requestId: '2' })).toEqual({
      authCredentials: { password: 'updated', username: 'user' }
    })
    current.mode = 'direct'
    expect(await auth.respond({ ...challenge, requestId: '3' })).toEqual({})
  })
})

test('authenticates only the proxy selected by the current domain rule', async () => {
  const automatic = { ...config, mode: 'auto', rules: [{ domain: 'example.com', target: 'office' }] }
  const auth = createProxyAuth(
    async () => automatic,
    async () => {}
  )
  expect(await auth.respond({ ...challenge, url: 'https://example.com/' })).toHaveProperty('authCredentials')
  expect(await auth.respond({ ...challenge, requestId: '2', url: 'https://other.test/' })).toEqual({})
})

test('keeps retry limits per proxy when a redirect reuses the request ID', async () => {
  const [profile] = config.profiles
  if (!profile) {
    throw new Error('Missing proxy fixture')
  }
  const automatic: ProxyConfig = {
    ...config,
    mode: 'auto',
    profiles: [...config.profiles, { ...profile, id: 'second', port: 8081 }],
    rules: [
      { domain: 'a.test', target: 'office' },
      { domain: 'b.test', target: 'second' }
    ]
  }
  const auth = createProxyAuth(
    async () => automatic,
    async () => {}
  )
  const first = { ...challenge, url: 'https://a.test/' }
  expect(await auth.respond(first)).toHaveProperty('authCredentials')
  expect(
    await auth.respond({ ...challenge, challenger: { host: 'proxy.example', port: 8081 }, url: 'https://b.test/' })
  ).toHaveProperty('authCredentials')
  expect(await auth.respond(first)).toEqual({ cancel: true })
})

test('authenticates only the proxy reached through a nested profile', async () => {
  const config = parseConfig({
    defaultTarget: 'direct',
    mode: 'nested',
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
    revision: 0,
    ruleProfiles: [
      { defaultTarget: 'direct', id: 'nested', name: 'Nested', rules: [{ domain: 'example.com', target: 'office' }] }
    ],
    rules: [],
    version: 1
  })
  const auth = createProxyAuth(
    async () => config,
    async () => {}
  )
  const challenge = { challenger: { host: 'localhost', port: 8080 }, isProxy: true, requestId: '1' }
  expect(await auth.respond({ ...challenge, url: 'http://other.test/' })).toEqual({})
  expect(await auth.respond({ ...challenge, url: 'http://example.com/' })).toEqual({
    authCredentials: { password: 'secret', username: 'user' }
  })
})
