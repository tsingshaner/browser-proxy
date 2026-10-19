export const CONFIG_KEY = 'pathRedirect'
export const RULE_ID = 470001
export interface Config {
  version: 1
  enabled: boolean
  source: string
  target: string
}
export const defaults = (): Config => ({ enabled: false, source: '', target: '', version: 1 })

function url(value: unknown): URL {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || value.length > 1500 || /[\\\s?#*]/u.test(value)) {
    throw new Error('redirectInvalidUrl')
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('redirectIncompleteUrl')
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.port
  ) {
    throw new Error('redirectUrlParts')
  }
  return parsed
}

export function validate(value: unknown): Config {
  if (!value || typeof value !== 'object') {
    throw new Error('redirectInvalidConfig')
  }
  const input = value as Partial<Config>
  // Accept the same fields without a version for forwards migration from early settings.
  if (input.version !== undefined && input.version !== 1) {
    throw new Error('redirectVersion')
  }
  if (typeof input.enabled !== 'boolean') {
    throw new Error('redirectInvalidEnabled')
  }
  if (!input.enabled && input.source === '' && input.target === '') {
    return defaults()
  }
  const source = url(input.source)
  const target = url(input.target)
  if (source.pathname !== '/') {
    throw new Error('redirectRoot')
  }
  if (source.origin === target.origin) {
    throw new Error('redirectLoop')
  }
  if (!target.pathname.endsWith('/')) {
    throw new Error('redirectTrailingSlash')
  }
  return { enabled: input.enabled, source: source.href, target: target.href, version: 1 }
}

export function hostPattern(config: Config): string {
  return `${new URL(config.source).origin}/*`
}

export function rules(config: Config): chrome.declarativeNetRequest.Rule[] {
  if (!config.enabled) {
    return []
  }
  const checked = validate(config)
  const escaped = checked.source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [
    {
      action: {
        redirect: { regexSubstitution: `${checked.target}\\1` },
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType
      },
      condition: {
        isUrlFilterCaseSensitive: false,
        regexFilter: `^${escaped}(.*)$`,
        requestMethods: ['get' as chrome.declarativeNetRequest.RequestMethod],
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType]
      },
      id: RULE_ID,
      priority: 1
    }
  ]
}
