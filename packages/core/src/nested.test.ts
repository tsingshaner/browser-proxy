import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';
import { parseConfig, resolveTarget, generatePac, exportBackup, inspectBackup } from './index';

const input = { version: 1, revision: 2, mode: 'auto', profiles: [{ id: 'proxy', name: 'Proxy', scheme: 'http', host: 'localhost', port: 8080 }],
  rules: [{ domain: '*.example.com', target: 'nested' }], defaultTarget: 'direct',
  ruleProfiles: [{ id: 'nested', name: 'Nested', rules: [{ domain: 'direct.example.com', target: 'direct' }], defaultTarget: 'proxy' }] };

describe('nested routing graph', () => {
  test('resolves nested first matches and defaults identically in core, PAC, and backups', () => {
    const config = parseConfig(input);
    for (const [host, target, directive] of [['sub.example.com', 'proxy', 'PROXY localhost:8080'], ['direct.example.com', 'direct', 'DIRECT'], ['example.com', 'direct', 'DIRECT']]) {
      expect(resolveTarget(config, host!)).toBe(target);
      expect(runInNewContext(`${generatePac(config)};FindProxyForURL('', host)`, { host })).toBe(directive);
    }
    expect(inspectBackup(exportBackup(config))).toEqual({ config, issues: [], legacy: false });
  });
  test('rejects cycles through defaults or rules', () => {
    expect(() => parseConfig({ ...input, ruleProfiles: [{ ...input.ruleProfiles[0], defaultTarget: 'auto' }] })).toThrow('invalid-rule');
  });
  test('rejects missing references', () => {
    expect(() => parseConfig({ ...input, ruleProfiles: [] })).toThrow('invalid-rule');
  });
  test('rejects more than 32 nested rule profiles', () => {
    const ruleProfiles = Array.from({ length: 33 }, (_, i) => ({ id: `r${i}`, name: `Rule ${i}`, rules: [], defaultTarget: i === 32 ? 'direct' : `r${i + 1}` }));
    expect(() => parseConfig({ ...input, rules: [], ruleProfiles })).toThrow('invalid-rule');
  });
});

describe('legacy nested migration', () => {
  test('restores multiple switch profiles and virtual references without activating them', () => {
    const legacy = { schemaVersion: 2,
      '+fixed': { name: 'Fixed', profileType: 'FixedProfile', fallbackProxy: { scheme: 'http', host: 'localhost', port: 8080 } },
      '+root': { name: 'Root', profileType: 'SwitchProfile', defaultProfileName: 'direct', rules: [{ condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'Alias' }] },
      '+alias': { name: 'Alias', profileType: 'VirtualProfile', defaultProfileName: 'Nested' },
      '+nested': { name: 'Nested', profileType: 'SwitchProfile', defaultProfileName: 'Fixed', rules: [] },
    };
    const preview = inspectBackup(JSON.stringify(legacy));
    expect(preview.issues).toEqual([]);
    expect(preview.config.mode).toBe('system');
    expect(preview.config.ruleProfiles).toHaveLength(3);
    const config = { ...preview.config, mode: preview.config.ruleProfiles![0]!.id };
    expect(resolveTarget(config, 'sub.example.com')).toBe('legacy-0');
    expect(resolveTarget(config, 'example.com')).toBe('legacy-0');
    expect(resolveTarget(config, 'other.com')).toBe('direct');
    expect(inspectBackup(exportBackup(config)).config).toEqual(config);
  });
  test('rejects a cycle in legacy virtual references', () => {
    expect(() => inspectBackup(JSON.stringify({ schemaVersion: 2,
      '+a': { name: 'A', profileType: 'VirtualProfile', defaultProfileName: 'B' },
      '+b': { name: 'B', profileType: 'VirtualProfile', defaultProfileName: 'A' },
    }))).toThrow('invalid-rule');
  });
});
