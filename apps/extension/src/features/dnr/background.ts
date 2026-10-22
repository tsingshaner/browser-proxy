import { api } from '../../browser-api'
import { createPublisher } from './publisher'

const publisher = createPublisher(api)
const controllers = {
  headerRules: publisher.controller('headerRules'),
  pathRedirect: publisher.controller('pathRedirect')
}
const refreshRules = () => {
  void publisher.reconcile().catch(() => undefined)
}
api.runtime.onInstalled.addListener(refreshRules)
api.runtime.onStartup.addListener(refreshRules)
api.permissions.onRemoved.addListener(refreshRules)
api.permissions.onAdded.addListener(refreshRules)
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.pathRedirect || changes.headerRules)) {
    refreshRules()
  }
})
refreshRules()

api.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  if (sender.id !== api.runtime.id) {
    return false
  }
  if (
    !message ||
    typeof message !== 'object' ||
    !('feature' in message) ||
    (message.feature !== 'pathRedirect' && message.feature !== 'headerRules')
  ) {
    return false
  }
  // Only extension pages may configure network rules.
  if (!sender.url?.startsWith(api.runtime.getURL(''))) {
    return false
  }
  const controller = controllers[message.feature]
  const action = Reflect.get(message, 'action')
  const task =
    action === 'load'
      ? controller.load()
      : action === 'save'
        ? controller.save(Reflect.get(message, 'config'))
        : action === 'disable'
          ? controller.disable()
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
