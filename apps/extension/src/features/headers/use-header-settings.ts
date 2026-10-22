import { useCallback, useEffect, useState } from 'react'

import { api } from '../../browser-api'
import { type Config, defaults, type HeaderRule, origins, validate } from './config'

async function requestHeaders(action: 'load' | 'save' | 'disable', value?: Config) {
  if (action === 'save' && value) {
    value = validate(value)
    const required = origins(value)
    if (required.length > 0 && !(await api.permissions.request({ origins: required }))) {
      throw new Error('headersPermission')
    }
  }
  const response = await api.runtime.sendMessage({ action, config: value, feature: 'headerRules' })
  if (!response?.ok) {
    throw new Error(response?.code ?? 'error')
  }
  return response
}

export function useHeaderSettings() {
  const [config, setConfig] = useState(defaults)
  const [busy, setBusy] = useState(true)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const request = useCallback(async (action: 'load' | 'save' | 'disable', value?: Config) => {
    setBusy(true)
    setStatus('')
    setFailed(false)
    try {
      const response = await requestHeaders(action, value)
      setConfig(validate(response.config))
      if (action !== 'load') {
        setStatus(action === 'disable' ? 'headersDisabled' : 'saved')
      }
    } catch (error) {
      setFailed(true)
      const code = error instanceof Error ? error.message : 'error'
      setStatus(/^(headers[A-Z]\w*|dnr[A-Z]\w*|conflict)$/.test(code) ? code : 'error')
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    void request('load')
  }, [request])
  return {
    actions: {
      add: () =>
        setConfig((current) => ({
          ...current,
          rules: [
            ...current.rules,
            {
              enabled: true,
              header: '',
              id: crypto.randomUUID(),
              match: 'domain',
              method: 'any',
              name: 'Header',
              operation: 'set',
              pattern: '',
              resource: 'any',
              target: 'request',
              value: ''
            }
          ]
        })),
      disable: () => request('disable'),
      enable: (enabled: boolean) => setConfig((current) => ({ ...current, enabled })),
      move: (index: number, direction: -1 | 1) =>
        setConfig((current) => {
          const next = index + direction
          if (next < 0 || next >= current.rules.length) {
            return current
          }
          const rules = [...current.rules]
          ;[rules[index], rules[next]] = [rules[next], rules[index]]
          return { ...current, rules }
        }),
      reload: () => request('load'),
      remove: (id: string) => setConfig((current) => ({ ...current, rules: current.rules.filter((r) => r.id !== id) })),
      save: () => request('save', config),
      update: (id: string, update: Partial<HeaderRule>) =>
        setConfig((current) => ({
          ...current,
          rules: current.rules.map((r) => (r.id === id ? { ...r, ...update } : r))
        }))
    },
    config,
    feedback: { busy, failed, status }
  }
}
