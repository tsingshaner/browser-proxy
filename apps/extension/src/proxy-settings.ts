import { generatePac, type ProxyConfig } from '@browser-proxy/core';

export interface FirefoxProxyValue { proxyType: 'none' | 'system' | 'autoConfig'; autoConfigUrl?: string }
export function proxyValue(config: ProxyConfig, firefox: boolean): chrome.proxy.ProxyConfig | FirefoxProxyValue {
  if (firefox) {
    if (config.mode === 'direct' || config.mode === 'system') return { proxyType: config.mode === 'direct' ? 'none' : 'system' };
    const pac = generatePac(config);
    return { proxyType: 'autoConfig', autoConfigUrl: `data:application/x-ns-proxy-autoconfig,${encodeURIComponent(pac)}` };
  }
  if (config.mode === 'auto' || config.ruleProfiles?.some(p => p.id === config.mode)) return { mode: 'pac_script', pacScript: { data: generatePac(config), mandatory: true } };
  const profile = config.profiles.find(p => p.id === config.mode);
  return profile
    ? { mode: 'fixed_servers', rules: { singleProxy: { scheme: profile.scheme, host: profile.host, port: profile.port } } }
    : { mode: config.mode as 'direct' | 'system' };
}
