export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5';
export interface ProxyProfile {
  id: string;
  name: string;
  scheme: ProxyScheme;
  host: string;
  port: number;
  auth?: { username: string; password: string };
}
export interface DomainRule { domain: string; target: string }
export interface ProxyConfig {
  version: 1;
  revision: number;
  mode: string;
  profiles: ProxyProfile[];
  rules: DomainRule[];
  defaultTarget: string;
}

export function parseProfile(value: unknown): ProxyProfile {
  if (!value || typeof value !== 'object') throw new Error('invalid-profile');
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ||
      ['direct', 'system', 'auto'].includes(p.id) ||
      typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 ||
      !['http', 'https', 'socks4', 'socks5'].includes(p.scheme as string) ||
      typeof p.host !== 'string' || !p.host || /[\s/?#@\\]/.test(p.host) ||
      typeof p.port !== 'number' || !Number.isInteger(p.port) || p.port < 1 || p.port > 65535) {
    throw new Error('invalid-profile');
  }
  const host = normalizeHost(p.host);
  let auth: ProxyProfile['auth'];
  if (p.auth !== undefined) {
    if (!p.auth || typeof p.auth !== 'object' || !['http', 'https'].includes(p.scheme as string)) throw new Error('invalid-profile');
    const credentials = p.auth as Record<string, unknown>;
    if (typeof credentials.username !== 'string' || !credentials.username ||
        typeof credentials.password !== 'string') throw new Error('invalid-profile');
    auth = { username: credentials.username, password: credentials.password };
  }
  return { id: p.id, name: p.name.trim(), scheme: p.scheme as ProxyScheme, host, port: p.port, ...(auth ? { auth } : {}) };
}

export function parseConfig(value: unknown): ProxyConfig {
  if (value === undefined || value === 'direct' || value === 'system') {
    return { version: 1, revision: 0, mode: value ?? 'system', profiles: [], rules: [], defaultTarget: 'direct' };
  }
  if (!value || typeof value !== 'object') throw new Error('invalid-config');
  const c = value as Record<string, unknown>;
  if (c.version !== 1 || !Number.isSafeInteger(c.revision) || (c.revision as number) < 0 ||
      typeof c.mode !== 'string' || !Array.isArray(c.profiles)) throw new Error('invalid-config');
  const profiles = c.profiles.map(parseProfile);
  if (new Set(profiles.map(p => p.id)).size !== profiles.length ||
      !['direct', 'system', 'auto', ...profiles.map(p => p.id)].includes(c.mode)) throw new Error('invalid-config');
  const targets = ['direct', ...profiles.map(p => p.id)];
  const defaultTarget = c.defaultTarget === undefined ? 'direct' : c.defaultTarget;
  if (typeof defaultTarget !== 'string' || !targets.includes(defaultTarget)) throw new Error('invalid-rule');
  const sourceRules = c.rules === undefined ? [] : c.rules;
  if (!Array.isArray(sourceRules)) throw new Error('invalid-rule');
  const rules = sourceRules.map((rule: unknown): DomainRule => {
    if (!rule || typeof rule !== 'object') throw new Error('invalid-rule');
    const r = rule as Record<string, unknown>;
    if (typeof r.domain !== 'string' || typeof r.target !== 'string' || !targets.includes(r.target)) throw new Error('invalid-rule');
    return { domain: normalizeDomain(r.domain), target: r.target };
  });
  return { version: 1, revision: c.revision as number, mode: c.mode, profiles, rules, defaultTarget };
}

function normalizeHost(value: string): string {
  if (!value || /[\s/?#@\\]/.test(value)) throw new Error('invalid-profile');
  let host: string;
  try {
    const input = value.includes(':') && !value.startsWith('[') ? `[${value}]` : value;
    const url = new URL(`http://${input}`);
    if (url.port || !url.hostname) throw new Error();
    host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host.includes(':') && (host.length > 253 ||
        !host.replace(/\.$/, '').split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) {
      throw new Error();
    }
  } catch { throw new Error('invalid-profile'); }
  return host;
}

export function normalizeDomain(value: string): string {
  try {
    const host = normalizeHost(value).replace(/\.$/, '');
    if (host.includes(':') || /^[0-9.]+$/.test(host)) throw new Error();
    return host;
  } catch { throw new Error('invalid-rule'); }
}

// Hosts received from a browser URL are already ASCII (including IDN punycode).
export function resolveTarget(config: ProxyConfig, host: string): string {
  if (config.mode !== 'auto') return config.mode;
  let normalized: string;
  try { normalized = normalizeHost(host).replace(/\.$/, ''); }
  catch { return config.defaultTarget; }
  return config.rules.find(rule => rule.domain === normalized)?.target ?? config.defaultTarget;
}

export function generatePac(value: unknown): string {
  const config = parseConfig(value);
  const directive = (target: string) => {
    if (target === 'direct') return 'DIRECT';
    const profile = config.profiles.find(p => p.id === target)!;
    const scheme = { http: 'PROXY', https: 'HTTPS', socks4: 'SOCKS', socks5: 'SOCKS5' }[profile.scheme];
    const host = profile.host.includes(':') ? `[${profile.host}]` : profile.host;
    return `${scheme} ${host}:${profile.port}`;
  };
  const rules = config.rules.map(rule => ({ domain: rule.domain, result: directive(rule.target) }));
  return `function FindProxyForURL(url, host) {
    host = host.toLowerCase().replace(/\\.$/, '');
    var rules = ${JSON.stringify(rules)};
    for (var i = 0; i < rules.length; i++) {
      if (host === rules[i].domain) return rules[i].result;
    }
    return ${JSON.stringify(directive(config.defaultTarget))};
  }`;
}
