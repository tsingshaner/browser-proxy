import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { inspectBackup, generatePac } from '../packages/core/src/index';
test('keeps historical wildcard routing when importing a legacy switch profile', () => {
  const legacy = { schemaVersion: 2,
    '+proxy': { name: 'proxy', profileType: 'FixedProfile', fallbackProxy: { scheme: 'http', host: 'localhost', port: 8080 }, bypassList: [] },
    '+auto': { name: 'auto', profileType: 'SwitchProfile', defaultProfileName: 'direct', rules: [
      { condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'proxy' },
      { condition: { conditionType: 'HostWildcardCondition', pattern: '**.other.com' }, profileName: 'proxy' },
    ] },
  };
  // Captured from the legacy generator before its removal.
  const expected = ['PROXY localhost:8080', 'PROXY localhost:8080', 'DIRECT', 'DIRECT', 'PROXY localhost:8080'];
  const modernScript = generatePac({ ...inspectBackup(JSON.stringify(legacy)).config, mode: 'auto' });
  for (const [index, host] of ['example.com', 'sub.example.com', 'badexample.com', 'other.com', 'sub.other.com'].entries()) {
    const result = (script: string) => runInNewContext(`${script}; FindProxyForURL(url, host)`, { url: `https://${host}/`, host });
    expect(result(modernScript), host).toBe(expected[index]);
  }
});
