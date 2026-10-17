import { normalizeDomain, parseConfig, parseProfile, type DomainRule, type ProxyConfig } from './index';

export interface ImportIssue { path: string; reason: string; kind?: string }
export interface ImportPreview { config: ProxyConfig; issues: ImportIssue[]; legacy: boolean }

export function exportBackup(config: ProxyConfig): string {
  return JSON.stringify(parseConfig(config), null, 2);
}

export function inspectBackup(text: string): ImportPreview {
  if (text.length > 5 * 1024 * 1024) throw new Error('invalid-backup');
  const raw: unknown = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid-backup');
  const source = raw as Record<string, unknown>;
  const issues: ImportIssue[] = [];
  if ('version' in source) {
    const config = parseConfig(source);
    const unknownFields = (value: unknown, path: string, allowed: string[]) => {
      if (!value || typeof value !== 'object') return;
      for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) issues.push({ path: `${path}${key}`, reason: 'unsupported-setting' });
      }
    };
    unknownFields(source, '', ['version', 'revision', 'mode', 'profiles', 'rules', 'defaultTarget', 'ruleProfiles']);
    (source.profiles as Record<string, unknown>[]).forEach((profile, index) => {
      unknownFields(profile, `profiles[${index}].`, ['id', 'name', 'scheme', 'host', 'port', 'auth']);
      unknownFields(profile.auth, `profiles[${index}].auth.`, ['username', 'password']);
    });
    if (Array.isArray(source.rules)) source.rules.forEach((rule, index) => {
      unknownFields(rule, `rules[${index}].`, ['domain', 'target']);
    });
    if (Array.isArray(source.ruleProfiles)) source.ruleProfiles.forEach((group, index) => {
      unknownFields(group, `ruleProfiles[${index}].`, ['id', 'name', 'rules', 'defaultTarget']);
      if (Array.isArray(group.rules)) group.rules.forEach((rule: unknown, n: number) => unknownFields(rule, `ruleProfiles[${index}].rules[${n}].`, ['domain', 'target']));
    });
    return { config, issues, legacy: false };
  }
  if (source.schemaVersion !== 2) throw new Error('invalid-backup');
  const config = parseConfig(undefined);
  const names = new Map<string, string>();
  const switches: [string, Record<string, unknown>][] = [];
  const report = (path: string, reason: string, kind?: unknown) => {
    issues.push({ path, reason, ...(typeof kind === 'string' ? { kind } : {}) });
  };
  for (const [key, value] of Object.entries(source)) {
    if (key === 'schemaVersion') continue;
    if (!key.startsWith('+')) { report(key, 'unsupported-setting'); continue; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { report(key, 'unsupported-profile'); continue; }
    const p = value as Record<string, unknown>;
    if (['SwitchProfile', 'VirtualProfile'].includes(p.profileType as string)) { switches.push([key, p]); continue; }
    if (p.profileType !== 'FixedProfile' || p.proxyForHttp || p.proxyForHttps || p.proxyForFtp) {
      report(key, 'unsupported-profile', p.profileType); continue;
    }
    try {
      if (!p.fallbackProxy || typeof p.fallbackProxy !== 'object') throw new Error();
      const auth = p.auth && typeof p.auth === 'object' ? p.auth as Record<string, unknown> : undefined;
      const profile = parseProfile({ ...p.fallbackProxy, id: `legacy-${config.profiles.length}`, name: p.name,
        ...(auth && (auth.fallbackProxy !== undefined || auth.all !== undefined) ? { auth: auth.fallbackProxy ?? auth.all } : {}) });
      if (names.has(p.name as string) || ['direct', 'system'].includes(profile.name)) throw new Error();
      config.profiles.push(profile);
      names.set(p.name as string, profile.id);
      if (p.bypassList !== undefined && (!Array.isArray(p.bypassList) || p.bypassList.length)) report(`${key}.bypassList`, 'unsupported-bypass');
      if (p.auth !== undefined && (!auth || Object.keys(auth).some(k => !['fallbackProxy', 'all'].includes(k)))) report(`${key}.auth`, 'unsupported-setting');
    } catch { report(key, 'unsupported-profile', p.profileType); }
  }
  const singleSwitch = switches.length === 1 && switches[0]![1].profileType === 'SwitchProfile';
  const accepted = switches.filter(([key, p], index) => {
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80 || names.has(p.name) || ['direct', 'system'].includes(p.name)) {
      report(key, 'unsupported-profile', p.profileType); return false;
    }
    names.set(p.name, singleSwitch ? 'auto' : `legacy-rule-${index}`);
    return true;
  });
  const target = (name: unknown): string | undefined => name === 'direct' ? 'direct' : typeof name === 'string' ? names.get(name) : undefined;
  // Remove unusable nodes and their dependents before converting supported rules.
  const valid = new Map(accepted);
  let removed = true;
  while (removed) {
    removed = false;
    for (const [key, p] of valid) {
      if (!target(p.defaultProfileName) || (p.profileType === 'SwitchProfile' && !Array.isArray(p.rules))) {
        valid.delete(key); names.delete(p.name as string); report(key, 'unsupported-profile', p.profileType); removed = true;
      }
    }
  }
  for (const [key, p] of valid) {
    const group = { id: names.get(p.name as string)!, name: p.name as string, defaultTarget: target(p.defaultProfileName)!, rules: [] as DomainRule[] };
    if (p.profileType === 'SwitchProfile') {
      (p.rules as unknown[]).forEach((value: unknown, index: number) => {
        const path = `${key}.rules[${index}]`;
        const rule = value && typeof value === 'object' ? value as Record<string, unknown> : {};
        const condition = rule.condition && typeof rule.condition === 'object' ? rule.condition as Record<string, unknown> : {};
        try {
          const destination = target(rule.profileName);
          if (condition.conditionType !== 'HostWildcardCondition' || typeof condition.pattern !== 'string' || !destination) throw new Error();
          const pattern = condition.pattern;
          let domains: string[];
          if (pattern.startsWith('**.')) domains = [`*.${normalizeDomain(pattern.slice(3))}`];
          else if (pattern.startsWith('*.') || pattern.startsWith('.')) {
            const domain = normalizeDomain(pattern.slice(pattern.startsWith('*.') ? 2 : 1));
            domains = [domain, `*.${domain}`];
          } else domains = [normalizeDomain(pattern)];
          const rules: DomainRule[] = domains.map(domain => ({ domain, target: destination }));
          group.rules.push(...rules);
        } catch { report(path, 'unsupported-rule', condition.conditionType); }
      });
    }
    if (singleSwitch) { config.rules = group.rules; config.defaultTarget = group.defaultTarget; }
    else (config.ruleProfiles ??= []).push(group);
  }
  return { config: parseConfig(config), issues, legacy: true };
}
