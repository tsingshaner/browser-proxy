import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, test } from 'vitest';
import { inspectBackup, generatePac } from '../packages/core/src/index';
const require = createRequire(import.meta.url);
require('coffee-script/register');
const { PacGenerator } = require('../omega-pac/index.coffee');

test('keeps historical wildcard routing when importing a legacy switch profile', () => {
  const legacy = { schemaVersion: 2,
    '+proxy': { name: 'proxy', profileType: 'FixedProfile', fallbackProxy: { scheme: 'http', host: 'localhost', port: 8080 }, bypassList: [] },
    '+auto': { name: 'auto', profileType: 'SwitchProfile', defaultProfileName: 'direct', rules: [
      { condition: { conditionType: 'HostWildcardCondition', pattern: '*.example.com' }, profileName: 'proxy' },
      { condition: { conditionType: 'HostWildcardCondition', pattern: '**.other.com' }, profileName: 'proxy' },
    ] },
  };
  const oldScript = PacGenerator.script(legacy, legacy['+auto']).print_to_string();
  const modernScript = generatePac(inspectBackup(JSON.stringify(legacy)).config);
  for (const host of ['example.com', 'sub.example.com', 'badexample.com', 'other.com', 'sub.other.com']) {
    const result = (script: string) => runInNewContext(`${script}; FindProxyForURL(url, host)`, { url: `https://${host}/`, host });
    expect(result(modernScript), host).toBe(result(oldScript));
  }
});
