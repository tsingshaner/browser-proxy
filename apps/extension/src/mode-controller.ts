import { inspectBackup, type ProxyConfig, parseConfig, parseProfile } from '@browser-proxy/core'

function setMode(next: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  if (
    typeof request.mode !== 'string' ||
    ![
      'direct',
      'system',
      'auto',
      ...next.profiles.map((p) => p.id),
      ...(next.ruleProfiles?.map((p) => p.id) ?? [])
    ].includes(request.mode)
  ) {
    throw new Error('invalid-request')
  }
  next.mode = request.mode

  return next
}

function saveProfile(next: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  const profile = parseProfile(request.profile)
  const index = next.profiles.findIndex((p) => p.id === profile.id)
  if (index < 0) {
    next.profiles.push(profile)
  } else {
    next.profiles[index] = profile
  }

  return next
}

function importConfig(next: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  if (typeof request.text !== 'string') {
    throw new Error('invalid-backup')
  }
  const preview = inspectBackup(request.text)
  if (preview.issues.length > 0 && request.allowPartial !== true) {
    throw new Error('import-warning')
  }
  return { ...preview.config, revision: next.revision }
}

function saveRuleProfile(next: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  if (!request.profile || typeof request.profile !== 'object') {
    throw new Error('invalid-rule')
  }
  const profile = request.profile as Record<string, unknown>
  const groups: unknown[] = (next.ruleProfiles ?? []).filter((p) => p.id !== profile.id)
  groups.push(profile)
  return parseConfig({ ...next, ruleProfiles: groups })
}

function saveRules(next: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  if (!Array.isArray(request.rules) || typeof request.defaultTarget !== 'string') {
    throw new Error('invalid-rule')
  }
  const validated = parseConfig({ ...next, defaultTarget: request.defaultTarget, rules: request.rules })
  next.rules = validated.rules
  next.defaultTarget = validated.defaultTarget

  return next
}

function deleteProfile(next: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  if (
    [next, ...(next.ruleProfiles ?? [])].some(
      (p) => p.defaultTarget === request.id || p.rules.some((r) => r.target === request.id)
    )
  ) {
    throw new Error('referenced-profile')
  }
  if (![...next.profiles, ...(next.ruleProfiles ?? [])].some((p) => p.id === request.id)) {
    throw new Error('invalid-request')
  }
  if (request.id === next.mode) {
    throw new Error('active-profile')
  }
  if (request.type === 'delete-rule-profile') {
    next.ruleProfiles = next.ruleProfiles?.filter((p) => p.id !== request.id)
  } else {
    next.profiles = next.profiles.filter((p) => p.id !== request.id)
  }

  return next
}

function updateConfig(config: ProxyConfig, request: Record<string, unknown>): ProxyConfig {
  const next = structuredClone(config)
  switch (request.type) {
    case 'set-mode':
      return setMode(next, request)
    case 'save-profile':
      return saveProfile(next, request)
    case 'import-config':
      return importConfig(next, request)
    case 'save-rule-profile':
      return saveRuleProfile(next, request)
    case 'save-rules':
      return saveRules(next, request)
    default:
      return deleteProfile(next, request)
  }
}

export function createModeController(io: {
  read(): Promise<unknown>
  write(config: ProxyConfig): Promise<void>
  apply(config: ProxyConfig): Promise<void>
}) {
  let config = parseConfig(undefined)
  let initialized = false
  async function restore() {
    if (initialized) {
      return
    }
    config = parseConfig(await io.read())
    await io.apply(config)
    initialized = true
  }
  const ready = restore()
  let pending = ready.catch(() => undefined)

  async function persist(next: ProxyConfig) {
    await io.apply(next)
    try {
      await io.write(next)
    } catch {
      try {
        await io.apply(config)
      } catch {
        initialized = false
      }
      throw new Error('save-failed')
    }
  }

  function handle(message: unknown): Promise<ProxyConfig> {
    const operation = pending.then(async () => {
      await restore()
      if (!message || typeof message !== 'object') {
        throw new Error('invalid-request')
      }
      const request = message as Record<string, unknown>
      if (request.type === 'get-config') {
        return structuredClone(config)
      }
      if (
        ![
          'set-mode',
          'save-profile',
          'delete-profile',
          'save-rules',
          'save-rule-profile',
          'delete-rule-profile',
          'import-config'
        ].includes(request.type as string)
      ) {
        throw new Error('invalid-request')
      }
      if (request.revision !== config.revision) {
        throw new Error('conflict')
      }
      const next = parseConfig(updateConfig(config, request))
      next.revision++
      await persist(next)
      config = next
      return structuredClone(config)
    })
    pending = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }

  return { handle, ready }
}
