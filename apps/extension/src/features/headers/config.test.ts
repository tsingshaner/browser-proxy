import { describe, expect, test } from 'vitest'

import { type Config, defaults, type HeaderRule, MAX_RULES, origins, rules, validate } from './config'

const rule: HeaderRule = {
  enabled: true,
  header: 'X-Environment',
  id: 'one',
  match: 'domain',
  method: 'any',
  name: 'Environment',
  operation: 'set',
  pattern: 'api.example.com',
  resource: 'any',
  target: 'request',
  value: 'test'
}
const config = (changes: Partial<HeaderRule> = {}): Config => ({
  ...defaults(),
  enabled: true,
  rules: [{ ...rule, ...changes }]
})
const matches = (value: Config, url: string) => {
  const condition = rules(value)[0].condition
  return new RegExp(condition.regexFilter ?? '', condition.isUrlFilterCaseSensitive ? '' : 'i').test(url)
}

describe('header configuration', () => {
  test.each(['bad name', 'Bad:Name', 'X-Test\r\nOther', '', ':authority'])(
    'rejects invalid header name %j',
    (header) => {
      expect(() => validate(config({ header }))).toThrow('headersInvalidHeader')
    }
  )
  test.each(['test\r\nInjected: yes', 'test\n', 'test\u0000', 'a'.repeat(8193)])(
    'rejects unsafe or oversized header value',
    (value) => {
      expect(() => validate(config({ value }))).toThrow('headersInvalidValue')
    }
  )
  test.each([
    { enabled: 'yes' },
    { method: 'invalid' },
    { resource: 'invalid' },
    { target: 'invalid' },
    { operation: 'append' },
    { match: 'invalid' },
    { name: '' },
    { id: '../one' },
    { pattern: '' },
    { pattern: 'evil.example/path' },
    { match: 'prefix', pattern: 'javascript:alert(1)' },
    { match: 'prefix', pattern: 'https://user:pass@example.com/' },
    { match: 'prefix', pattern: 'https://example.com/#fragment' }
  ])('rejects invalid rule %j', (change) => {
    expect(() => validate({ ...config(), rules: [{ ...rule, ...change }] })).toThrow()
  })
  test('rejects duplicate rule IDs', () => {
    expect(() => validate({ ...config(), rules: [rule, rule] })).toThrow('headersInvalid')
  })
  test('bounds the number of rules', () => {
    expect(() =>
      validate({ ...config(), rules: Array.from({ length: MAX_RULES + 1 }, (_, i) => ({ ...rule, id: String(i) })) })
    ).toThrow('headersInvalid')
  })
  test('normalizes names, header case and international domains', () => {
    const result = validate(config({ name: ' Environment ', pattern: '例子.测试.' }))
    expect(result.rules[0]).toMatchObject({
      header: 'x-environment',
      name: 'Environment',
      pattern: 'xn--fsqu00a.xn--0zwm56d'
    })
  })
})

describe('header DNR compiler', () => {
  test.each(['request', 'response'] as const)('distinguishes an empty set from removal for %s headers', (target) => {
    const key = target === 'request' ? 'requestHeaders' : 'responseHeaders'
    expect(rules(config({ target, value: '' }))[0].action[key]).toEqual([
      { header: 'x-environment', operation: 'set', value: '' }
    ])
    expect(rules(config({ operation: 'remove', target }))[0].action[key]).toEqual([
      { header: 'x-environment', operation: 'remove' }
    ])
  })
  test.each([
    ['https://api.example.com/v1', true],
    ['http://api.example.com:8080/v1', true],
    ['https://API.EXAMPLE.COM/v1', true],
    ['https://sub.api.example.com/v1', false],
    ['https://api.example.com.evil/v1', false],
    ['https://evil.example/?url=https://api.example.com/', false],
    ['https://api.example.com@evil.example/v1', false]
  ])('exact domain matches %s: %s', (url, expected) => {
    expect(matches(config(), url)).toBe(expected)
  })
  test.each([
    ['https://example.com/', false],
    ['https://a.example.com/', true],
    ['https://a.b.example.com/', true],
    ['https://example.com.evil/', false],
    ['https://evil@example.com/', false]
  ])('wildcard domain matches %s: %s', (url, expected) => {
    expect(matches(config({ pattern: '*.example.com' }), url)).toBe(expected)
  })
  test('matches a literal URL prefix without broadening its query or path', () => {
    const value = config({ match: 'prefix', pattern: 'https://example.com/Case?q=a.b' })
    expect(matches(value, 'https://example.com/Case?q=a.b&other=1')).toBe(true)
    expect(matches(value, 'https://example.com/case?q=a.b')).toBe(false)
    expect(matches(value, 'https://example.com/Case?q=axb')).toBe(false)
  })
  test('keeps regex patterns for browser validation', () => {
    expect(rules(config({ match: 'regex', pattern: '^https://example\\.com/' }))[0].condition.regexFilter).toBe(
      '^https://example\\.com/'
    )
  })
  test('includes top-level requests when all resource types are selected', () => {
    expect(rules(config())[0].condition.resourceTypes).toContain('main_frame')
    expect(rules(config())[0].condition.resourceTypes).toContain('xmlhttprequest')
  })
  test('applies method and resource filters', () => {
    expect(rules(config({ method: 'post', resource: 'xmlhttprequest' }))[0].condition).toMatchObject({
      requestMethods: ['post'],
      resourceTypes: ['xmlhttprequest']
    })
  })
  test('assigns higher priority to earlier rules and skips disabled rules', () => {
    const result = rules({
      ...config(),
      rules: [rule, { ...rule, id: 'two', operation: 'remove' }, { ...rule, enabled: false, id: 'three' }]
    })
    expect(result).toHaveLength(2)
    expect(result[0].priority).toBeGreaterThan(result[1].priority ?? 0)
    expect(new Set(result.map((r) => r.id)).size).toBe(2)
  })
  test('global disable emits no rules', () => {
    expect(rules({ ...config(), enabled: false })).toEqual([])
  })
  test('requests only active site permissions, dropping ports from permission patterns', () => {
    expect(origins(validate(config({ match: 'prefix', pattern: 'https://api.example.com:8443/v1/' })))).toEqual([
      'https://api.example.com/*'
    ])
    expect(origins(config({ enabled: false }))).toEqual([])
    expect(origins(config({ match: 'regex', pattern: '.*' }))).toEqual(['http://*/*', 'https://*/*'])
  })
})
