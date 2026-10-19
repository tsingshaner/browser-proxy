import { api } from '../../browser-api'
import { CONFIG_KEY } from './config'
import { createController as createRedirectController } from './controller'

const redirect = createRedirectController(api)
const refreshRedirect = () => {
  void redirect.load().catch(() => undefined)
}
api.runtime.onInstalled.addListener(refreshRedirect)
api.runtime.onStartup.addListener(refreshRedirect)
api.permissions.onRemoved.addListener(refreshRedirect)
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[CONFIG_KEY]) {
    refreshRedirect()
  }
})
refreshRedirect()

api.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (sender.id !== api.runtime.id) {
    return false
  }
  if (!message || typeof message !== 'object' || !('feature' in message) || message.feature !== 'pathRedirect') {
    return false
  }
  // Only extension pages may configure redirects.
  if (sender.tab || !sender.url?.startsWith(api.runtime.getURL(''))) {
    return false
  }
  const action = Reflect.get(message, 'action')
  const task =
    action === 'load'
      ? redirect.load()
      : action === 'save'
        ? redirect.save(Reflect.get(message, 'config'))
        : action === 'disable'
          ? redirect.disable()
          : undefined
  if (!task) {
    return false
  }
  void task.then(
    (config) => respond({ config, ok: true }),
    (error: unknown) => respond({ code: error instanceof Error ? error.message : 'error', ok: false })
  )
  return true
})
