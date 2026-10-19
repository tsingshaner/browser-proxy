import { CONFIG_KEY, defaults, hostPattern, RULE_ID, rules, validate } from './config'

import type { Config } from './config'

export function createController(api: typeof chrome) {
  const trustedStorage = api.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }) ?? Promise.resolve()
  void trustedStorage.catch(() => undefined)
  let pending: Promise<unknown> = Promise.resolve()
  function serial<T>(action: () => Promise<T>): Promise<T> {
    const result = pending.then(async () => {
      await trustedStorage
      return action()
    })
    pending = result.catch(() => undefined)
    return result
  }
  async function read(): Promise<Config> {
    const stored = await api.storage.local.get(CONFIG_KEY)
    return stored[CONFIG_KEY] === undefined ? defaults() : validate(stored[CONFIG_KEY])
  }
  async function replace(config: Config) {
    const addRules = rules(config)
    if (config.enabled) {
      if (!(await api.permissions.contains({ origins: [hostPattern(config)] }))) {
        throw new Error('redirectPermission')
      }
      const regex = addRules[0]?.condition.regexFilter
      if (!regex) {
        throw new Error('redirectInvalidRule')
      }
      const supported = await api.declarativeNetRequest.isRegexSupported({
        regex,
        requireCapturing: true
      })
      if (!supported.isSupported) {
        throw new Error('redirectUnsupported')
      }
    }
    await api.declarativeNetRequest.updateDynamicRules({ addRules, removeRuleIds: [RULE_ID] })
  }
  async function reconcile() {
    try {
      const config = await read()
      await replace(config)
      return config
    } catch (error) {
      await replace(defaults())
      throw error
    }
  }
  return {
    disable: () =>
      serial(async () => {
        // Always remove the rule first, even if stored addresses are corrupt.
        await replace(defaults())
        let config = defaults()
        try {
          config = { ...(await read()), enabled: false }
        } catch {
          /* Repair invalid data. */
        }
        await api.storage.local.set({ [CONFIG_KEY]: config })
        return config
      }),
    load: () => serial(reconcile),
    save: (value: unknown) =>
      serial(async () => {
        const config = validate(value)
        let old = defaults()
        try {
          old = await read()
        } catch {
          /* Allow explicit repair of invalid stored data. */
        }
        await replace(config)
        try {
          await api.storage.local.set({ [CONFIG_KEY]: config })
        } catch {
          try {
            await replace(old)
          } catch {
            await replace(defaults())
          }
          throw new Error('redirectSaveFailed')
        }
        return config
      })
  }
}
