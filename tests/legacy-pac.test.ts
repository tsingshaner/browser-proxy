import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
require('coffee-script/register');
const { PacGenerator } = require('omega-pac/index.coffee');

describe('legacy PAC behavior during workspace migration', () => {
  test('routes a fixed profile through its configured proxy', () => {
    const profile = {
      name: 'proxy', profileType: 'FixedProfile',
      fallbackProxy: { scheme: 'http', host: '127.0.0.1', port: 8888 },
      bypassList: [],
    };
    const script = PacGenerator.script({ '+proxy': profile }, profile).print_to_string();
    const result = runInNewContext(`${script}\nFindProxyForURL('https://example.com/', 'example.com')`, {}, { timeout: 1000 });
    expect(result).toBe('PROXY 127.0.0.1:8888');
  });
});
