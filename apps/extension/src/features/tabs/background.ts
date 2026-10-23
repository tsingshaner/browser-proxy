import { api, isFirefox } from '../../browser-api'
import { createTabManager } from './tab-manager'

const manager = createTabManager({
  create: (entry) => api.tabs.create({ ...entry, active: false }),
  firefox: isFirefox,
  read: async () => (await api.storage.session.get('tabRecovery')).tabRecovery,
  remove: (id) => api.tabs.remove(id),
  tabs: () => api.tabs.query({}),
  windows: () => api.windows.getAll({ windowTypes: ['normal'] }),
  write: (tabRecovery) => api.storage.session.set({ tabRecovery })
})

api.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (!message || typeof message !== 'object' || Reflect.get(message, 'feature') !== 'tabs') {
    return false
  }
  if (sender.id !== api.runtime.id || !sender.url?.startsWith(api.runtime.getURL('')) || sender.tab?.incognito) {
    return false
  }
  const action = Reflect.get(message, 'action')
  const task =
    action === 'scan'
      ? manager.scan(Reflect.get(message, 'windowId'))
      : action === 'close'
        ? manager.close(Reflect.get(message, 'previewId'), Reflect.get(message, 'selections'))
        : action === 'recovery'
          ? manager.recovery()
          : action === 'reopen'
            ? manager.reopen(Reflect.get(message, 'windowId'))
            : undefined
  if (!task) {
    return false
  }
  void task.then(
    (value) => respond({ ok: true, value }),
    (error: unknown) =>
      respond({
        code: error instanceof Error && /^tabs[A-Z]/.test(error.message) ? error.message : 'tabsError',
        ok: false
      })
  )
  return true
})
