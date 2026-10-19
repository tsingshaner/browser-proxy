import { configure, getConsoleSink, getLogger } from '@logtape/logtape'

import { api, isFirefox } from './browser-api'
import { createLogControl } from './features/logs/log-control'
import { createPersistentLogs } from './features/logs/persistent-logs'
import { createModeController } from './features/proxy/mode-controller'
import { createProxyAuth } from './features/proxy/proxy-auth'
import { createProxyLatency } from './features/proxy/proxy-latency'
import { type FirefoxProxyValue, proxyValue } from './features/proxy/proxy-settings'
import './features/redirect/background'
import { createRequestMonitor } from './features/request-monitor/request-monitor'

const logs = createPersistentLogs()
const monitor = createRequestMonitor()
const logger = getLogger(['browser-tookits'])
const logControl = createLogControl({
  read: async () => (await api.storage.local.get('logsEnabled')).logsEnabled,
  write: async (enabled) => {
    await api.storage.local.set({ logsEnabled: enabled })
  }
})
const logging = logControl.ready.then(() =>
  configure({
    loggers: [
      { category: ['browser-tookits'], lowestLevel: 'info', sinks: ['console', 'persistent'] },
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] }
    ],
    sinks: { console: logControl.sink(getConsoleSink()), persistent: logControl.sink(logs.sink) }
  })
)

void logging.then(() => {
  logger.info('Background initialized.')
})

const controller = createModeController({
  apply: async (config) => {
    const current = await api.proxy.settings.get({ incognito: false })
    if (current.levelOfControl === 'controlled_by_other_extensions' || current.levelOfControl === 'not_controllable') {
      throw new Error('proxy-unavailable')
    }
    if (isFirefox && !(await api.extension.isAllowedIncognitoAccess())) {
      throw new Error('private-permission')
    }
    const settings = api.proxy.settings as {
      set(details: { value: chrome.proxy.ProxyConfig | FirefoxProxyValue; scope?: 'regular' }): Promise<void>
    }
    await settings.set({ value: proxyValue(config, isFirefox), ...(isFirefox ? {} : { scope: 'regular' as const }) })
  },
  read: async () => {
    const stored = await api.storage.local.get(['proxyConfig', 'proxyMode'])
    return stored.proxyConfig ?? stored.proxyMode
  },
  write: async (config) => {
    await api.storage.local.set({ proxyConfig: config })
  }
})
void controller.ready.catch(async () => {
  await logging
  logger.error('Could not restore proxy mode.')
})

let proxyGeneration = 0
api.proxy.settings.onChange.addListener(() => {
  proxyGeneration += 1
})
const testProxy = createProxyLatency({
  fetch: (...args) => fetch(...args),
  read: async () => {
    const config = await controller.handle({ type: 'get-config' })
    const control = await api.proxy.settings.get({ incognito: false })
    return {
      config,
      controlled: control.levelOfControl === 'controlled_by_this_extension',
      generation: proxyGeneration
    }
  }
})

api.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (
    sender.id !== api.runtime.id ||
    (message && typeof message === 'object' && 'feature' in message && message.feature === 'pathRedirect')
  ) {
    return false
  }

  if (message && typeof message === 'object' && 'type' in message && message.type === 'test-proxy') {
    void testProxy(message as { profileId?: unknown; revision?: unknown }).then(respond)
    return true
  }
  if (
    message &&
    typeof message === 'object' &&
    'type' in message &&
    ['get-logs', 'clear-logs', 'set-logs-enabled'].includes(message.type as string)
  ) {
    void (async () => {
      await logging
      await logControl.restore()
      if (message.type === 'set-logs-enabled') {
        await logControl.setEnabled(Reflect.get(message, 'enabled'))
      }
      if (message.type === 'clear-logs') {
        await logs.clear()
      }
      return { ...(await logs.read().catch(() => ({ entries: [], failed: true }))), enabled: logControl.enabled }
    })().then(
      (value) => {
        respond({ ok: true, ...value })
      },
      () => {
        respond({ code: 'logs-unavailable', ok: false })
      }
    )
    return true
  }
  if (message && typeof message === 'object' && 'type' in message && message.type === 'get-requests') {
    const tabId = 'tabId' in message ? message.tabId : undefined
    respond(
      Number.isInteger(tabId) && (tabId as number) >= 0
        ? { ok: true, summary: monitor.read(tabId as number) }
        : { ok: false }
    )
    return false
  }
  void controller.handle(message).then(
    async (config) => {
      if (message && typeof message === 'object' && 'type' in message && message.type !== 'get-config') {
        logger.info('Proxy configuration applied.')
        await api.storage.session.set({ authFailed: false }).catch(() => undefined)
      }
      respond({ config, ok: true })
    },
    async (error: unknown) => {
      await logging
      logger.error('Could not complete proxy mode request.')
      const code =
        error instanceof Error &&
        [
          'conflict',
          'invalid-profile',
          'active-profile',
          'invalid-rule',
          'referenced-profile',
          'invalid-backup',
          'import-warning',
          'private-permission'
        ].includes(error.message)
          ? error.message
          : 'error'
      respond({ code, ok: false })
    }
  )
  return true
})

const auth = createProxyAuth(
  async () => {
    const control = await api.proxy.settings.get({ incognito: false })
    if (control.levelOfControl !== 'controlled_by_this_extension') {
      throw new Error('proxy-unavailable')
    }
    return controller.handle({ type: 'get-config' })
  },
  async (failed) => {
    await api.storage.session.set({ authFailed: failed })
    if (failed) {
      logger.warn('Proxy authentication failed. Check the saved credentials.')
    }
  }
)
api.webRequest.onAuthRequired.addListener(
  (details, respond) => {
    if (respond) {
      void auth.respond(details).then(respond, () => {
        respond({})
      })
    }
    return undefined
  },
  { urls: ['<all_urls>'] },
  ['asyncBlocking']
)
api.webRequest.onCompleted.addListener(
  (details) => {
    void auth.complete(details.requestId, details.statusCode !== 407).catch(() => undefined)
  },
  { urls: ['<all_urls>'] }
)
api.webRequest.onErrorOccurred.addListener(
  (details) => {
    void auth.complete(details.requestId, false).catch(() => undefined)
  },
  { urls: ['<all_urls>'] }
)

api.webRequest.onBeforeRequest.addListener(
  (details) => {
    monitor.start(details)
    return undefined
  },
  { urls: ['<all_urls>'] }
)
api.webRequest.onCompleted.addListener(
  (details) => {
    monitor.finish(details.tabId, details.requestId)
  },
  { urls: ['<all_urls>'] }
)
api.webRequest.onErrorOccurred.addListener(
  (details) => {
    monitor.finish(details.tabId, details.requestId, details.error)
  },
  { urls: ['<all_urls>'] }
)
api.tabs.onRemoved.addListener((tabId) => {
  monitor.remove(tabId)
})

api.webRequest.onBeforeRedirect.addListener(
  (details) => {
    if (details.redirectUrl.startsWith('data:')) {
      monitor.finish(details.tabId, details.requestId)
    }
  },
  { urls: ['<all_urls>'] }
)
api.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    monitor.commit(details.tabId, /^https?:/.test(details.url))
  }
})
