export type ProxyScheme = 'http' | 'https' | 'socks4' | 'socks5';
export interface ProxyProfile {
  id: string;
  name: string;
  scheme: ProxyScheme;
  host: string;
  port: number;
}
export interface ProxyConfig {
  version: 1;
  revision: number;
  mode: string;
  profiles: ProxyProfile[];
}

export function parseProfile(value: unknown): ProxyProfile {
  if (!value || typeof value !== 'object') throw new Error('invalid-profile');
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.id) ||
      p.id === 'direct' || p.id === 'system' ||
      typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 ||
      !['http', 'https', 'socks4', 'socks5'].includes(p.scheme as string) ||
      typeof p.host !== 'string' || !p.host || /[\s/?#@\\]/.test(p.host) ||
      typeof p.port !== 'number' || !Number.isInteger(p.port) || p.port < 1 || p.port > 65535) {
    throw new Error('invalid-profile');
  }
  let host: string;
  try {
    const input = p.host.includes(':') && !p.host.startsWith('[') ? `[${p.host}]` : p.host;
    const url = new URL(`http://${input}`);
    if (url.port || !url.hostname) throw new Error();
    host = url.hostname.replace(/^\[|\]$/g, '');
    if (!host.includes(':') && (host.length > 253 ||
        !host.replace(/\.$/, '').split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) {
      throw new Error();
    }
  } catch { throw new Error('invalid-profile'); }
  return { id: p.id, name: p.name.trim(), scheme: p.scheme as ProxyScheme, host, port: p.port };
}

export function parseConfig(value: unknown): ProxyConfig {
  if (value === undefined || value === 'direct' || value === 'system') {
    return { version: 1, revision: 0, mode: value ?? 'system', profiles: [] };
  }
  if (!value || typeof value !== 'object') throw new Error('invalid-config');
  const c = value as Record<string, unknown>;
  if (c.version !== 1 || !Number.isSafeInteger(c.revision) || (c.revision as number) < 0 ||
      typeof c.mode !== 'string' || !Array.isArray(c.profiles)) throw new Error('invalid-config');
  const profiles = c.profiles.map(parseProfile);
  if (new Set(profiles.map(p => p.id)).size !== profiles.length ||
      !['direct', 'system', ...profiles.map(p => p.id)].includes(c.mode)) throw new Error('invalid-config');
  return { version: 1, revision: c.revision as number, mode: c.mode, profiles };
}
