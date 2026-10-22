import * as headers from '../headers/config'
import * as redirect from '../redirect/config'

const features = [redirect.CONFIG_KEY, headers.CONFIG_KEY] as const
type Feature = (typeof features)[number]
type Configs = { pathRedirect: redirect.Config; headerRules: headers.Config }
const definitions = {
  headerRules: headers,
  pathRedirect: {
    ...redirect,
    origins: (config: redirect.Config) => (config.enabled ? [redirect.hostPattern(config)] : [])
  }
}
const ownedBy = (feature: Feature, id: number) =>
  feature === 'pathRedirect'
    ? id === redirect.RULE_ID
    : id > headers.RULE_ID_START && id <= headers.RULE_ID_START + headers.MAX_RULES
const owned = (id: number) => features.some((feature) => ownedBy(feature, id))

export function createPublisher(api: typeof chrome) {
  const trusted = api.storage.local.setAccessLevel?.({ accessLevel: 'TRUSTED_CONTEXTS' }) ?? Promise.resolve()
  void trusted.catch(() => undefined)
  let pending: Promise<unknown> = Promise.resolve()
  function serial<T>(action: () => Promise<T>): Promise<T> {
    const result = pending.then(async () => {
      await trusted
      return action()
    })
    pending = result.catch(() => undefined)
    return result
  }
  function parse<K extends Feature>(feature: K, value: unknown): Configs[K] {
    const definition = definitions[feature]
    return (value === undefined ? definition.defaults() : definition.validate(value)) as Configs[K]
  }
  async function compile<K extends Feature>(feature: K, config: Configs[K]) {
    const definition = definitions[feature] as {
      origins(value: Configs[K]): string[]
      rules(value: Configs[K]): chrome.declarativeNetRequest.Rule[]
    }
    const origins = definition.origins(config)
    if (origins.length > 0 && !(await api.permissions.contains({ origins }))) {
      throw new Error(feature === 'pathRedirect' ? 'redirectPermission' : 'headersPermission')
    }
    const rules = definition.rules(config)
    for (const rule of rules) {
      await checkRegex(feature, rule)
    }
    return rules
  }
  async function checkRegex(feature: Feature, rule: chrome.declarativeNetRequest.Rule) {
    if (!rule.condition.regexFilter) {
      return
    }
    const result = await api.declarativeNetRequest.isRegexSupported({
      isCaseSensitive: rule.condition.isUrlFilterCaseSensitive,
      regex: rule.condition.regexFilter,
      requireCapturing: feature === 'pathRedirect'
    })
    if (!result.isSupported) {
      throw new Error(feature === 'pathRedirect' ? 'redirectUnsupported' : 'headersUnsupported')
    }
  }
  function nextRevision<K extends Feature>(
    feature: K,
    config: Configs[K],
    stored: Record<string, unknown>
  ): Configs[K] {
    if (feature !== 'headerRules') {
      return config
    }
    let previous = headers.defaults()
    try {
      previous = parse('headerRules', stored.headerRules)
    } catch {
      /* Allow explicit repair. */
    }
    const current = config as headers.Config
    if (previous.revision !== current.revision) {
      throw new Error('conflict')
    }
    return { ...current, revision: current.revision + 1 } as Configs[K]
  }
  async function persist(
    feature: Feature,
    config: Configs[Feature],
    previousRules: chrome.declarativeNetRequest.Rule[]
  ) {
    try {
      await api.storage.local.set({ [feature]: config })
    } catch {
      await rollback(previousRules)
      throw new Error(feature === 'pathRedirect' ? 'redirectSaveFailed' : 'headersSaveFailed')
    }
  }
  async function rollback(rules: chrome.declarativeNetRequest.Rule[]) {
    try {
      await replace(rules)
    } catch {
      // Remove only owned rules if rollback cannot restore a known configuration.
      try {
        await replace([])
      } catch {
        throw new Error('dnrRecoveryFailed')
      }
      throw new Error('dnrRecoveryFailed')
    }
  }
  async function prepare(stored: Record<string, unknown>) {
    const rules: chrome.declarativeNetRequest.Rule[] = []
    const errors: Partial<Record<Feature, unknown>> = {}
    for (const feature of features) {
      try {
        rules.push(...(await compile(feature, parse(feature, stored[feature]))))
      } catch (error) {
        errors[feature] = error
      }
    }
    return { errors, rules }
  }
  async function replace(addRules: chrome.declarativeNetRequest.Rule[]) {
    const active = await api.declarativeNetRequest.getDynamicRules()
    await api.declarativeNetRequest.updateDynamicRules({
      addRules,
      removeRuleIds: active.filter((rule) => owned(rule.id)).map((rule) => rule.id)
    })
  }
  async function reconcile() {
    const stored = await api.storage.local.get([...features])
    const prepared = await prepare(stored)
    await replace(prepared.rules)
    return { stored, ...prepared }
  }
  return {
    controller<K extends Feature>(feature: K) {
      return {
        disable: () =>
          serial(async () => {
            // Disable live rules even if storage cannot be read or its configuration is corrupt.
            const active = await api.declarativeNetRequest.getDynamicRules()
            await replace(active.filter((rule) => owned(rule.id) && !ownedBy(feature, rule.id)))
            let config = parse(feature, undefined)
            try {
              const stored = await api.storage.local.get([...features])
              try {
                config = parse(feature, stored[feature])
              } catch {
                /* Repair corrupt settings. */
              }
              config = { ...config, enabled: false }
              if (feature === 'headerRules') {
                ;(config as headers.Config).revision += 1
              }
              await api.storage.local.set({ [feature]: config })
            } catch {
              throw new Error('dnrDisableSaveFailed')
            }
            return config
          }),
        load: () =>
          serial(async () => {
            const result = await reconcile()
            if (result.errors[feature]) {
              throw result.errors[feature]
            }
            return parse(feature, result.stored[feature])
          }),
        save: (value: unknown) =>
          serial(async () => {
            if (value === undefined) {
              throw new Error('dnrInvalid')
            }
            let config = parse(feature, value)
            const stored = await api.storage.local.get([...features])
            config = nextRevision(feature, config, stored)
            const prepared = await prepare({ ...stored, [feature]: config })
            if (prepared.errors[feature]) {
              throw prepared.errors[feature]
            }
            const previous = await prepare(stored)
            await replace(prepared.rules)
            await persist(feature, config, previous.rules)
            return config
          })
      }
    },
    reconcile: () => serial(reconcile)
  }
}
