import { describe, expect, test } from 'vitest';
import { inspectBackup, exportBackup } from './backup';
import { parseConfig } from './index';

const modern = parseConfig({ version: 1, revision: 8, mode: 'auto',
  profiles: [{ id: 'office', name: 'Office', scheme: 'http', host: 'localhost', port: 8080, auth: { username: 'user', password: 'secret' } }],
  rules: [{ domain: 'exact.example', target: 'direct' }, { domain: '*.example', target: 'office' }], defaultTarget: 'office' });
const legacy = { schemaVersion: 2,
  '+proxy': { name: 'proxy', profileType: 'FixedProfile', fallbackProxy: { scheme: 'http', host: 'localhost', port: 8080 }, auth: { all: { username: 'user', password: 'secret' } } },
  '+auto': { name: 'auto', profileType: 'SwitchProfile', defaultProfileName: 'direct', rules: [
    { condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'proxy' },
    { condition: { conditionType: 'HostWildcardCondition', pattern: '**.other.com' }, profileName: 'direct' },
  ] },
};

describe('configuration backup boundary', () => {
  test('round trips credentials, ordered rules, default connection and selected mode', () => {
    expect(inspectBackup(exportBackup(modern))).toEqual({ config: modern, issues: [], legacy: false });
  });
  test.each(['{', 'null', '"direct"', '{"version":999}', '{"profiles":[]}'])('rejects invalid documents: %s', text => {
    expect(() => inspectBackup(text)).toThrow();
  });
  test('preserves legacy wildcard apex behavior and translates authentication', () => {
    const result = inspectBackup(JSON.stringify(legacy));
    expect(result.issues).toEqual([]);
    expect(result.config.mode).toBe('system');
    expect(result.config.profiles[0]?.auth).toEqual({ username: 'user', password: 'secret' });
    expect(result.config.rules).toEqual([
      { domain: 'example.com', target: 'legacy-0' }, { domain: '*.example.com', target: 'legacy-0' },
      { domain: '*.other.com', target: 'direct' },
    ]);
  });
  test('reports advanced PAC, IP rules, bypasses, and sync settings before partial import', () => {
    const old = { ...legacy,
      '+pac': { profileType: 'PacProfile', pacScript: 'do not execute' },
      '+proxy': { ...legacy['+proxy'], bypassList: [{ conditionType: 'BypassCondition', pattern: '127.0.0.1' }] },
      '+auto': { ...legacy['+auto'], rules: [...legacy['+auto'].rules,
        { condition: { conditionType: 'IpCondition', pattern: '10.0.0.0/8' }, profileName: 'direct' }] },
      '-syncOptions': { token: 'do not include in report' },
    };
    const result = inspectBackup(JSON.stringify(old));
    expect(result.issues.map(issue => issue.reason)).toEqual(expect.arrayContaining(['unsupported-profile', 'unsupported-rule', 'unsupported-bypass', 'unsupported-setting']));
    expect(JSON.stringify(result.issues)).not.toContain('do not include');
    expect(result.config.rules).toHaveLength(3);
    expect(result.config.mode).toBe('system');
  });
});
