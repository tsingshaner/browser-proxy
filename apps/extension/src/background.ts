import { configure, getConsoleSink, getLogger } from '@logtape/logtape';
import { createModeController } from './mode-controller';

const logger = getLogger(['browser-proxy']);
const logging = configure({
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['browser-proxy'], lowestLevel: 'info', sinks: ['console'] },
    { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
  ],
});

const controller = createModeController({
  read: async () => {
    const stored = await chrome.storage.local.get(['proxyConfig', 'proxyMode']);
    return stored.proxyConfig ?? stored.proxyMode;
  },
  write: async (config) => { await chrome.storage.local.set({ proxyConfig: config }); },
  apply: async (config) => {
    const current = await chrome.proxy.settings.get({ incognito: false });
    if (current.levelOfControl === 'controlled_by_other_extensions' ||
        current.levelOfControl === 'not_controllable') throw new Error('proxy-unavailable');
    const profile = config.profiles.find(p => p.id === config.mode);
    const value: chrome.proxy.ProxyConfig = profile
      ? { mode: 'fixed_servers', rules: { singleProxy: { scheme: profile.scheme, host: profile.host, port: profile.port } } }
      : { mode: config.mode as 'direct' | 'system' };
    await chrome.proxy.settings.set({ value, scope: 'regular' });
  },
});
void controller.ready.catch(async () => {
  await logging;
  logger.error('Could not restore proxy mode.');
});

chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  void controller.handle(message).then(
    (config) => respond({ ok: true, config }),
    async (error: unknown) => {
      await logging;
      logger.error('Could not complete proxy mode request.');
      const code = error instanceof Error && ['conflict', 'invalid-profile', 'active-profile'].includes(error.message)
        ? error.message : 'error';
      respond({ ok: false, code });
    },
  );
  return true;
});
