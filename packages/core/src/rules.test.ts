import { runInNewContext } from 'node:vm';
import { describe, expect, test } from 'vitest';
import { parseConfig, generatePac, resolveTarget } from './index';

const profile = { id: 'office', name: 'Office', scheme: 'http', host: 'localhost', port: 8080 };
const input = { version: 1, revision: 0, mode: 'auto', profiles: [profile],
  rules: [{ domain: 'EXAMPLE.COM.', target: 'office' }, { domain: '例子.中国', target: 'office' }], defaultTarget: 'direct' };

describe('exact domain routing', () => {
  test.each(['example.com', 'EXAMPLE.COM.', '例子.中国', 'xn--fsqu00a.xn--fiqs8s'])('matches normalized hosts in core and PAC: %s', host => {
    const config = parseConfig(input);
    expect(resolveTarget(config, host)).toBe('office');
    const result = runInNewContext(`${generatePac(config)}; FindProxyForURL(url, host)`, {
      url: `https://${host}/`, host: new URL(`https://${host}`).hostname,
    });
    expect(result).toBe('PROXY localhost:8080');
  });
  test('uses the default for subdomains and unrelated domains', () => {
    const config = parseConfig(input);
    for (const host of ['sub.example.com', 'badexample.com', 'other.test', 'under_score.test', '[::1]']) {
      expect(resolveTarget(config, host)).toBe('direct');
      expect(runInNewContext(`${generatePac(config)}; FindProxyForURL('', host)`, { host })).toBe('DIRECT');
    }
    const defaultProxy = parseConfig({ ...input, defaultTarget: 'office' });
    expect(resolveTarget(defaultProxy, 'other.test')).toBe('office');
    expect(runInNewContext(`${generatePac(defaultProxy)}; FindProxyForURL('', 'other.test')`)).toBe('PROXY localhost:8080');
  });
  test.each(['a.*.example.com', 'https://example.com', 'example.com/path', '127.0.0.1', '10.0.0.0/8', '::1', '\"; throw Error(1);//'])('rejects unsupported rules without generating executable input: %s', domain => {
    expect(() => generatePac({ ...input, rules: [{ domain, target: 'office' }] })).toThrow();
  });
  test('rejects missing proxy targets', () => {
    expect(() => parseConfig({ ...input, rules: [{ domain: 'example.com', target: 'missing' }] })).toThrow('invalid-rule');
  });
});


describe('ordered wildcard routing', () => {
  test('matches only subdomains and uses the first match in both runtimes', () => {
    const config = parseConfig({ ...input, rules: [
      { domain: '*.EXAMPLE.COM.', target: 'office' },
      { domain: 'direct.example.com', target: 'direct' },
    ] });
    for (const host of ['sub.example.com', 'deep.sub.example.com', 'under_score.example.com', 'direct.example.com']) {
      expect(resolveTarget(config, host)).toBe('office');
      expect(runInNewContext(`${generatePac(config)}; FindProxyForURL('', host)`, { host })).toBe('PROXY localhost:8080');
    }
    for (const host of ['example.com', 'badexample.com', '.example.com']) {
      expect(resolveTarget(config, host)).toBe('direct');
      expect(runInNewContext(`${generatePac(config)}; FindProxyForURL('', host)`, { host })).toBe('DIRECT');
    }
    config.rules.reverse();
    expect(resolveTarget(config, 'direct.example.com')).toBe('direct');
    expect(runInNewContext(`${generatePac(config)}; FindProxyForURL('', 'direct.example.com')`)).toBe('DIRECT');
  });
  test.each(['*', '*example.com', 'foo.*.com', '*.127.0.0.1', '*.10.0.0.0/8', '*.example.com/path'])('rejects unsupported wildcard patterns: %s', domain => {
    expect(() => parseConfig({ ...input, rules: [{ domain, target: 'office' }] })).toThrow('invalid-rule');
  });
});
