export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5'
export interface ProxyProfile {
  id: string
  name: string
  scheme: ProxyScheme
  host: string
  port: number
  auth?: { username: string; password: string }
}
export interface DomainRule {
  domain: string
  target: string
}
export interface RuleProfile {
  id: string
  name: string
  rules: DomainRule[]
  defaultTarget: string
}
export interface ProxyConfig {
  version: 1
  revision: number
  mode: string
  profiles: ProxyProfile[]
  rules: DomainRule[]
  defaultTarget: string
  ruleProfiles?: RuleProfile[]
}

export function parseProfile(value: unknown): ProxyProfile {
  if (!value || typeof value !== 'object') {
    throw new Error('invalid-profile')
  }
  const p = value as Record<string, unknown>
  if (
    typeof p.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ||
    ['direct', 'system', 'auto'].includes(p.id) ||
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 80 ||
    !['http', 'https', 'socks4', 'socks5'].includes(p.scheme as string) ||
    typeof p.host !== 'string' ||
    !p.host ||
    /[\s/?#@\\]/.test(p.host) ||
    typeof p.port !== 'number' ||
    !Number.isInteger(p.port) ||
    p.port < 1 ||
    p.port > 65535
  ) {
    throw new Error('invalid-profile')
  }
  const host = normalizeHost(p.host)
  let auth: ProxyProfile['auth']
  if (p.auth !== undefined) {
    if (!p.auth || typeof p.auth !== 'object' || !['http', 'https'].includes(p.scheme as string)) {
      throw new Error('invalid-profile')
    }
    const credentials = p.auth as Record<string, unknown>
    if (typeof credentials.username !== 'string' || !credentials.username || typeof credentials.password !== 'string') {
      throw new Error('invalid-profile')
    }
    auth = { password: credentials.password, username: credentials.username }
  }
  return {
    host,
    id: p.id,
    name: p.name.trim(),
    port: p.port,
    scheme: p.scheme as ProxyScheme,
    ...(auth ? { auth } : {})
  }
}

export function parseConfig(value: unknown): ProxyConfig {
  if (value === undefined || value === 'direct' || value === 'system') {
    return { defaultTarget: 'direct', mode: value ?? 'system', profiles: [], revision: 0, rules: [], version: 1 }
  }
  if (!value || typeof value !== 'object') {
    throw new Error('invalid-config')
  }
  const c = value as Record<string, unknown>
  if (
    c.version !== 1 ||
    !Number.isSafeInteger(c.revision) ||
    (c.revision as number) < 0 ||
    typeof c.mode !== 'string' ||
    !Array.isArray(c.profiles)
  ) {
    throw new Error('invalid-config')
  }
  const profiles = c.profiles.map(parseProfile)
  const rawGroups = c.ruleProfiles ?? []
  if (!Array.isArray(rawGroups)) {
    throw new Error('invalid-rule')
  }
  const groups = rawGroups.map((value: unknown) => {
    if (!value || typeof value !== 'object') {
      throw new Error('invalid-rule')
    }
    const p = value as Record<string, unknown>
    if (
      typeof p.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ||
      ['direct', 'system', 'auto'].includes(p.id) ||
      typeof p.name !== 'string' ||
      !p.name.trim() ||
      p.name.length > 80
    ) {
      throw new Error('invalid-rule')
    }
    return { defaultTarget: p.defaultTarget, id: p.id, name: p.name.trim(), rules: p.rules }
  })
  const ids = [...profiles.map((p) => p.id), ...groups.map((p) => p.id)]
  if (new Set(ids).size !== ids.length || !['direct', 'system', 'auto', ...ids].includes(c.mode)) {
    throw new Error('invalid-config')
  }
  const targets = new Set(['direct', 'auto', ...ids])
  const parseRules = (sourceRules: unknown, fallback: unknown) => {
    if (!Array.isArray(sourceRules) || typeof fallback !== 'string' || !targets.has(fallback)) {
      throw new Error('invalid-rule')
    }
    const rules = sourceRules.map((rule: unknown): DomainRule => {
      if (!rule || typeof rule !== 'object') {
        throw new Error('invalid-rule')
      }
      const r = rule as Record<string, unknown>
      if (typeof r.domain !== 'string' || typeof r.target !== 'string' || !targets.has(r.target)) {
        throw new Error('invalid-rule')
      }
      return {
        domain: r.domain.startsWith('*.') ? `*.${normalizeDomain(r.domain.slice(2))}` : normalizeDomain(r.domain),
        target: r.target
      }
    })
    return { defaultTarget: fallback, rules }
  }
  const root = parseRules(c.rules ?? [], c.defaultTarget ?? 'direct')
  const ruleProfiles = groups.map((p) => ({ id: p.id, name: p.name, ...parseRules(p.rules, p.defaultTarget) }))
  const graph = new Map([['auto', root], ...ruleProfiles.map((p) => [p.id, p] as const)])
  const depths = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string, level = 0): number => {
    const group = graph.get(id)
    if (!group) {
      return 0
    }
    if (visiting.has(id) || level >= 32) {
      throw new Error('invalid-rule')
    }
    const known = depths.get(id)
    if (known !== undefined) {
      return known
    }
    visiting.add(id)
    let value = 1
    for (const target of [group.defaultTarget, ...group.rules.map((r) => r.target)]) {
      value = Math.max(value, 1 + depth(target, level + 1))
    }
    visiting.delete(id)
    if (value > 32) {
      throw new Error('invalid-rule')
    }
    depths.set(id, value)
    return value
  }
  for (const id of graph.keys()) {
    depth(id)
  }
  return {
    mode: c.mode,
    profiles,
    revision: c.revision as number,
    version: 1,
    ...root,
    ...(c.ruleProfiles !== undefined ? { ruleProfiles } : {})
  }
}

function normalizeHost(value: string): string {
  if (!value || /[\s/?#@\\]/.test(value)) {
    throw new Error('invalid-profile')
  }
  let host: string
  try {
    const input = value.includes(':') && !value.startsWith('[') ? `[${value}]` : value
    const url = new URL(`http://${input}`)
    if (url.port || !url.hostname) {
      throw new Error('invalid-profile')
    }
    host = url.hostname.replace(/^\[|\]$/g, '')
    if (
      !host.includes(':') &&
      (host.length > 253 ||
        !host
          .replace(/\.$/, '')
          .split('.')
          .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))
    ) {
      throw new Error('invalid-profile')
    }
  } catch {
    throw new Error('invalid-profile')
  }
  return host
}

export function normalizeDomain(value: string): string {
  try {
    const host = normalizeHost(value).replace(/\.$/, '')
    if (host.includes(':') || /^[0-9.]+$/.test(host)) {
      throw new Error('invalid-rule')
    }
    return host
  } catch {
    throw new Error('invalid-rule')
  }
}

// Hosts received from a browser URL are already ASCII (including IDN punycode).
export function resolveTarget(config: ProxyConfig, host: string): string {
  let normalized: string
  try {
    const input = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
    normalized = new URL(`http://${input}`).hostname.replace(/\.$/, '')
  } catch {
    normalized = ''
  }
  let target = config.mode
  for (let i = 0; i <= 32; i++) {
    const group = target === 'auto' ? config : config.ruleProfiles?.find((p) => p.id === target)
    if (!group) {
      return target
    }
    target =
      group.rules.find((rule) =>
        rule.domain.startsWith('*.')
          ? normalized.length > rule.domain.length - 1 && normalized.endsWith(rule.domain.slice(1))
          : rule.domain === normalized
      )?.target ?? group.defaultTarget
  }
  throw new Error('invalid-rule')
}

export function generatePac(value: unknown): string {
  const config = parseConfig(value)
  const groups = [
    { defaultTarget: config.defaultTarget, id: 'auto', rules: config.rules },
    ...(config.ruleProfiles ?? [])
  ].map(({ id, rules, defaultTarget }) => ({ defaultTarget, id, rules }))
  const proxies = config.profiles.map((profile) => {
    const scheme = { http: 'PROXY', https: 'HTTPS', socks4: 'SOCKS', socks5: 'SOCKS5' }[profile.scheme]
    const host = profile.host.includes(':') ? `[${profile.host}]` : profile.host
    return { id: profile.id, result: `${scheme} ${host}:${profile.port}` }
  })
  return `function FindProxyForURL(url, host) {
    host = host.toLowerCase().replace(/\\.$/, '');
    var groups = ${JSON.stringify(groups)};
    var proxies = ${JSON.stringify(proxies)};
    var target = ${JSON.stringify(config.mode)};
    for (var depth = 0; depth <= 32; depth++) {
      var group = null;
      for (var g = 0; g < groups.length; g++) if (groups[g].id === target) group = groups[g];
      if (!group) break;
      target = group.defaultTarget;
      for (var i = 0; i < group.rules.length; i++) {
        var rule = group.rules[i], domain = rule.domain;
        if (domain.slice(0, 2) === '*.' ? host.length > domain.length - 1 && host.slice(-domain.length + 1) === domain.slice(1) : host === domain) { target = rule.target; break; }
      }
    }
    for (var p = 0; p < proxies.length; p++) if (proxies[p].id === target) return proxies[p].result;
    return 'DIRECT';
  }`
}

export { exportBackup, type ImportIssue, type ImportPreview, inspectBackup } from './backup'
