import { inspectBackup, parseConfig, parseProfile, type ProxyConfig } from '@browser-proxy/core';

export function createModeController(io: {
  read(): Promise<unknown>;
  write(config: ProxyConfig): Promise<void>;
  apply(config: ProxyConfig): Promise<void>;
}) {
  let config = parseConfig(undefined);
  let initialized = false;
  async function restore() {
    if (initialized) return;
    config = parseConfig(await io.read());
    await io.apply(config);
    initialized = true;
  }
  const ready = restore();
  let pending = ready.catch(() => undefined);

  function handle(message: unknown): Promise<ProxyConfig> {
    const operation = pending.then(async () => {
      await restore();
      if (!message || typeof message !== 'object') throw new Error('invalid-request');
      const request = message as Record<string, unknown>;
      if (request.type === 'get-config') return structuredClone(config);
      if (!['set-mode', 'save-profile', 'delete-profile', 'save-rules', 'save-rule-profile', 'delete-rule-profile', 'import-config'].includes(request.type as string)) {
        throw new Error('invalid-request');
      }
      if (request.revision !== config.revision) throw new Error('conflict');
      let next = structuredClone(config);
      if (request.type === 'set-mode') {
        if (typeof request.mode !== 'string' ||
            !['direct', 'system', 'auto', ...config.profiles.map(p => p.id), ...(config.ruleProfiles?.map(p => p.id) ?? [])].includes(request.mode)) {
          throw new Error('invalid-request');
        }
        next.mode = request.mode;
      } else if (request.type === 'save-profile') {
        const profile = parseProfile(request.profile);
        const index = next.profiles.findIndex(p => p.id === profile.id);
        if (index < 0) next.profiles.push(profile);
        else next.profiles[index] = profile;
      } else if (request.type === 'import-config') {
        if (typeof request.text !== 'string') throw new Error('invalid-backup');
        const preview = inspectBackup(request.text);
        if (preview.issues.length && request.allowPartial !== true) throw new Error('import-warning');
        next = { ...preview.config, revision: config.revision };
      } else if (request.type === 'save-rule-profile') {
        if (!request.profile || typeof request.profile !== 'object') throw new Error('invalid-rule');
        const profile = request.profile as Record<string, unknown>;
        const groups: unknown[] = (next.ruleProfiles ?? []).filter(p => p.id !== profile.id);
        groups.push(profile);
        next = parseConfig({ ...next, ruleProfiles: groups });
      } else if (request.type === 'save-rules') {
        if (!Array.isArray(request.rules) || typeof request.defaultTarget !== 'string') throw new Error('invalid-rule');
        const validated = parseConfig({ ...next, rules: request.rules, defaultTarget: request.defaultTarget });
        next.rules = validated.rules;
        next.defaultTarget = validated.defaultTarget;
      } else {
        if ([next, ...(next.ruleProfiles ?? [])].some(p => p.defaultTarget === request.id || p.rules.some(r => r.target === request.id))) throw new Error('referenced-profile');
        if (![...next.profiles, ...(next.ruleProfiles ?? [])].some(p => p.id === request.id)) throw new Error('invalid-request');
        if (request.id === next.mode) throw new Error('active-profile');
        if (request.type === 'delete-rule-profile') next.ruleProfiles = next.ruleProfiles?.filter(p => p.id !== request.id);
        else next.profiles = next.profiles.filter(p => p.id !== request.id);
      }
      next = parseConfig(next);
      next.revision++;
      await io.apply(next);
      try {
        await io.write(next);
      } catch {
        try { await io.apply(config); }
        catch { initialized = false; }
        throw new Error('save-failed');
      }
      config = next;
      return structuredClone(config);
    });
    pending = operation.then(() => undefined, () => undefined);
    return operation;
  }

  return { ready, handle };
}
