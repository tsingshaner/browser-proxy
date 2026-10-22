import { normalizeDomain } from '@browser-tookits/core'

export const CONFIG_KEY = 'headerRules'
export const RULE_ID_START = 480000
export const MAX_RULES = 100
export const METHODS = ['any', 'get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const
export const RESOURCES = [
  'any',
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'script',
  'stylesheet',
  'image',
  'font',
  'media',
  'object',
  'ping',
  'csp_report',
  'other'
] as const
export interface HeaderRule {
  id: string
  name: string
  enabled: boolean
  match: 'domain' | 'prefix' | 'regex'
  pattern: string
  method: (typeof METHODS)[number]
  resource: (typeof RESOURCES)[number]
  target: 'request' | 'response'
  operation: 'set' | 'remove'
  header: string
  value: string
}
export interface Config {
  version: 1
  revision: number
  enabled: boolean
  rules: HeaderRule[]
}
export const defaults = (): Config => ({ enabled: false, revision: 0, rules: [], version: 1 })
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function validate(value: unknown): Config {
  if (!value || typeof value !== 'object') {
    throw new Error('headersInvalid')
  }
  const input = value as Partial<Config>
  if (
    input.version !== 1 ||
    typeof input.revision !== 'number' ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 0 ||
    input.revision >= Number.MAX_SAFE_INTEGER ||
    typeof input.enabled !== 'boolean' ||
    !Array.isArray(input.rules) ||
    input.rules.length > MAX_RULES
  ) {
    throw new Error('headersInvalid')
  }
  const rules = input.rules.map(validateRule)
  if (new Set(rules.map((rule) => rule.id)).size !== rules.length) {
    throw new Error('headersInvalid')
  }
  return { enabled: input.enabled, revision: input.revision, rules, version: 1 }
}

function validateRule(item: unknown): HeaderRule {
  if (!item || typeof item !== 'object') {
    throw new Error('headersInvalid')
  }
  const r = item as HeaderRule
  if (
    typeof r.id !== 'string' ||
    !/^[\w-]{1,80}$/.test(r.id) ||
    typeof r.name !== 'string' ||
    !r.name.trim() ||
    r.name.length > 80 ||
    typeof r.enabled !== 'boolean' ||
    !['domain', 'prefix', 'regex'].includes(r.match) ||
    !METHODS.includes(r.method) ||
    !RESOURCES.includes(r.resource) ||
    !['request', 'response'].includes(r.target) ||
    !['set', 'remove'].includes(r.operation)
  ) {
    throw new Error('headersInvalid')
  }
  validateHeader(r)
  const pattern = validatePattern(r.match, r.pattern)

  return {
    enabled: r.enabled,
    header: r.header.toLowerCase(),
    id: r.id,
    match: r.match,
    method: r.method,
    name: r.name.trim(),
    operation: r.operation,
    pattern,
    resource: r.resource,
    target: r.target,
    value: r.operation === 'remove' ? '' : r.value
  }
}

function validateHeader(r: HeaderRule) {
  if (typeof r.header !== 'string' || r.header.length > 256 || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(r.header)) {
    throw new Error('headersInvalidHeader')
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject HTTP header injection and control bytes.
  if (typeof r.value !== 'string' || r.value.length > 8192 || /[\x00-\x08\x0a-\x1f\x7f]/.test(r.value)) {
    throw new Error('headersInvalidValue')
  }
}

function validatePattern(match: HeaderRule['match'], value: unknown): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: URL patterns cannot contain whitespace or control bytes.
  if (typeof value !== 'string' || !value.trim() || value.length > 1500 || /[\x00-\x20\x7f]/.test(value)) {
    throw new Error('headersInvalidPattern')
  }
  let pattern = value
  if (match === 'domain') {
    try {
      pattern = pattern.startsWith('*.') ? `*.${normalizeDomain(pattern.slice(2))}` : normalizeDomain(pattern)
    } catch {
      throw new Error('headersInvalidPattern')
    }
  } else if (match === 'prefix') {
    try {
      const url = new URL(pattern)
      if (!/^https?:\/\//i.test(pattern) || url.username || url.password || url.hash || /[\\*]/.test(pattern)) {
        throw new Error('headersInvalidPattern')
      }
      pattern = url.href
    } catch {
      throw new Error('headersInvalidPattern')
    }
  }
  return pattern
}

export function origins(config: Config): string[] {
  if (!config.enabled) {
    return []
  }
  return [
    ...new Set(
      config.rules
        .filter((r) => r.enabled)
        .flatMap((r) => {
          if (r.match === 'regex') {
            return ['http://*/*', 'https://*/*']
          }
          if (r.match === 'domain') {
            return [`*://${r.pattern}/*`]
          }
          const url = new URL(r.pattern)
          return [`${url.protocol}//${url.hostname}/*`]
        })
    )
  ]
}

export function rules(value: Config): chrome.declarativeNetRequest.Rule[] {
  const config = validate(value)
  if (!config.enabled) {
    return []
  }
  return config.rules.flatMap((r, index) => {
    if (!r.enabled) {
      return []
    }
    return [
      {
        action: {
          type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
          [r.target === 'request' ? 'requestHeaders' : 'responseHeaders']: [
            { header: r.header, operation: r.operation, ...(r.operation === 'set' ? { value: r.value } : {}) }
          ]
        },
        condition: {
          isUrlFilterCaseSensitive: r.match !== 'domain',
          regexFilter: matchRegex(r),
          ...(r.method === 'any' ? {} : { requestMethods: [r.method as chrome.declarativeNetRequest.RequestMethod] }),
          // Explicit types include main_frame; an empty exclusion list does not reliably include it.
          resourceTypes: (r.resource === 'any'
            ? RESOURCES.filter((type) => type !== 'any')
            : [r.resource]) as chrome.declarativeNetRequest.ResourceType[]
        },
        id: RULE_ID_START + index + 1,
        priority: MAX_RULES - index + 1
      }
    ]
  })
}

function matchRegex(r: HeaderRule): string {
  let regex = r.pattern
  if (r.match === 'domain') {
    const wildcard = r.pattern.startsWith('*.')
    regex = `^https?://${wildcard ? '([a-z0-9-]+\\.)+' : ''}${escapeRegex(wildcard ? r.pattern.slice(2) : r.pattern)}(:[0-9]+)?/`
  } else if (r.match === 'prefix') {
    regex = `^${escapeRegex(r.pattern)}`
  }
  return regex
}
