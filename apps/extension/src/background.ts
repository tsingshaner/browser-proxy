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
  read: async () => (await chrome.storage.local.get('proxyMode')).proxyMode,
  write: async (mode) => { await chrome.storage.local.set({ proxyMode: mode }); },
  apply: async (mode) => {
    const current = await chrome.proxy.settings.get({ incognito: false });
    if (current.levelOfControl === 'controlled_by_other_extensions' ||
        current.levelOfControl === 'not_controllable') throw new Error('proxy-unavailable');
    await chrome.proxy.settings.set({ value: { mode }, scope: 'regular' });
  },
});
void controller.ready.catch(async () => {
  await logging;
  logger.error('Could not restore proxy mode.');
});

chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  void controller.handle(message).then(
    (state) => respond({ ok: true, ...state }),
    async () => {
      await logging;
      logger.error('Could not complete proxy mode request.');
      respond({ ok: false });
    },
  );
  return true;
});
