import { createRequestMonitor } from './request-monitor';
import { api, isFirefox } from './browser-api';
import { proxyValue, type FirefoxProxyValue } from './proxy-settings';
import { configure, getConsoleSink, getLogger } from '@logtape/logtape';
import { createProxyAuth } from './proxy-auth';
import { createModeController } from './mode-controller';

const monitor = createRequestMonitor();
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
    const stored = await api.storage.local.get(['proxyConfig', 'proxyMode']);
    return stored.proxyConfig ?? stored.proxyMode;
  },
  write: async (config) => { await api.storage.local.set({ proxyConfig: config }); },
  apply: async (config) => {
    const current = await api.proxy.settings.get({ incognito: false });
    if (current.levelOfControl === 'controlled_by_other_extensions' ||
        current.levelOfControl === 'not_controllable') throw new Error('proxy-unavailable');
    if (isFirefox && !await api.extension.isAllowedIncognitoAccess()) throw new Error('private-permission');
    const settings = api.proxy.settings as { set(details: { value: chrome.proxy.ProxyConfig | FirefoxProxyValue; scope?: 'regular' }): Promise<void> };
    await settings.set({ value: proxyValue(config, isFirefox), ...(isFirefox ? {} : { scope: 'regular' as const }) });
  },
});
void controller.ready.catch(async () => {
  await logging;
  logger.error('Could not restore proxy mode.');
});

api.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (sender.id !== api.runtime.id) return false;
  if (message && typeof message === 'object' && 'type' in message && message.type === 'get-requests') {
    const tabId = 'tabId' in message ? message.tabId : undefined;
    respond(Number.isInteger(tabId) && (tabId as number) >= 0
      ? { ok: true, summary: monitor.read(tabId as number) } : { ok: false });
    return false;
  }
  void controller.handle(message).then(
    async (config) => {
      if (message && typeof message === 'object' && 'type' in message && message.type !== 'get-config') {
        await api.storage.session.set({ authFailed: false }).catch(() => undefined);
      }
      respond({ ok: true, config });
    },
    async (error: unknown) => {
      await logging;
      logger.error('Could not complete proxy mode request.');
      const code = error instanceof Error && ['conflict', 'invalid-profile', 'active-profile', 'invalid-rule', 'referenced-profile', 'invalid-backup', 'import-warning', 'private-permission'].includes(error.message)
        ? error.message : 'error';
      respond({ ok: false, code });
    },
  );
  return true;
});


const auth = createProxyAuth(
  async () => {
    const control = await api.proxy.settings.get({ incognito: false });
    if (control.levelOfControl !== 'controlled_by_this_extension') throw new Error('proxy-unavailable');
    return controller.handle({ type: 'get-config' });
  },
  async (failed) => {
    await api.storage.session.set({ authFailed: failed });
    if (failed) logger.warn('Proxy authentication failed. Check the saved credentials.');
  },
);
api.webRequest.onAuthRequired.addListener((details, respond) => {
  if (respond) void auth.respond(details).then(respond, () => { respond({}); });
  return undefined;
}, { urls: ['<all_urls>'] }, ['asyncBlocking']);
api.webRequest.onCompleted.addListener(details => { void auth.complete(details.requestId, details.statusCode !== 407).catch(() => undefined); }, { urls: ['<all_urls>'] });
api.webRequest.onErrorOccurred.addListener(details => { void auth.complete(details.requestId, false).catch(() => undefined); }, { urls: ['<all_urls>'] });

api.webRequest.onBeforeRequest.addListener(details => { monitor.start(details); return undefined; }, { urls: ['<all_urls>'] });
api.webRequest.onCompleted.addListener(details => { monitor.finish(details.tabId, details.requestId); }, { urls: ['<all_urls>'] });
api.webRequest.onErrorOccurred.addListener(details => { monitor.finish(details.tabId, details.requestId, details.error); }, { urls: ['<all_urls>'] });
api.tabs.onRemoved.addListener(tabId => { monitor.remove(tabId); });

api.webRequest.onBeforeRedirect.addListener(details => {
  if (details.redirectUrl.startsWith('data:')) monitor.finish(details.tabId, details.requestId);
}, { urls: ['<all_urls>'] });
api.webNavigation.onCommitted.addListener(details => {
  if (details.frameId === 0) monitor.commit(details.tabId, /^https?:/.test(details.url));
});
