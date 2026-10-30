import { type ProxyConfig, parseConfig } from '@browser-tookits/core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '../../browser-api'
import { Button } from '../../components/ui/button'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'
import { errorKey, requestConfig } from './client'

export const ModeSwitcher = ({ compact = false }: { compact?: boolean }) => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ProxyConfig>()
  const mode = config?.mode
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [authFailed, setAuthFailed] = useState(false)
  useEffect(() => {
    void api.storage.session.get('authFailed').then((value) => {
      setAuthFailed(value.authFailed === true)
    })
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.proxyConfig?.newValue) {
        try {
          const next = parseConfig(changes.proxyConfig.newValue)
          setConfig((current) => (!current || next.revision >= current.revision ? next : current))
        } catch {
          setError('error')
        }
      }
      if (area === 'session' && changes.authFailed) {
        setAuthFailed(changes.authFailed.newValue === true)
      }
    }
    api.storage.onChanged.addListener(listener)
    return () => {
      api.storage.onChanged.removeListener(listener)
    }
  }, [])

  const request = async (next?: string) => {
    setBusy(true)
    setError('')
    try {
      const updated = await requestConfig(
        next ? { mode: next, revision: config?.revision, type: 'set-mode' } : undefined
      )
      setConfig((current) => (!current || updated.revision >= current.revision ? updated : current))
    } catch (error) {
      setError(errorKey(error))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void requestConfig()
      .then((updated) => {
        setConfig((current) => (!current || updated.revision >= current.revision ? updated : current))
      })
      .catch((error) => {
        setError(errorKey(error))
      })
      .finally(() => {
        setBusy(false)
      })
  }, [])

  return (
    <>
      {authFailed && (
        <p className="mb-4 text-destructive text-sm" role="alert">
          {t('authFailed')}
        </p>
      )}
      <fieldset className="space-y-3" disabled={busy}>
        <legend className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider" id="mode-label">
          {t('mode')}
        </legend>
        <RadioGroup
          aria-labelledby="mode-label"
          disabled={busy}
          name="mode"
          onValueChange={(value) => {
            if (typeof value === 'string') {
              void request(value)
            }
          }}
          value={mode ?? ''}
        >
          {[
            'direct',
            'system',
            'auto',
            ...(config?.profiles.map((p) => p.id) ?? []),
            ...(config?.ruleProfiles?.map((p) => p.id) ?? [])
          ].map((value) => (
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border ${compact ? 'p-2.5' : 'p-4'} transition-colors focus-within:ring-2 focus-within:ring-ring ${mode === value ? 'border-primary bg-muted' : 'border-border hover:bg-muted'} ${busy ? 'opacity-60' : ''}`}
              htmlFor={`mode-${value}`}
              key={value}
            >
              <RadioGroupItem id={`mode-${value}`} value={value} />
              <span className="min-w-0 break-words">
                <span className="block font-medium text-sm">
                  {[...(config?.profiles ?? []), ...(config?.ruleProfiles ?? [])].find((p) => p.id === value)?.name ??
                    t(value)}
                </span>
                <span className="mt-1 block text-muted-foreground text-xs">
                  {config?.profiles.find((p) => p.id === value)?.host ??
                    t(['direct', 'system'].includes(value) ? `${value}Hint` : 'autoHint')}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <div aria-live="polite" className={compact ? 'mt-2 text-xs' : 'mt-4 min-h-10 text-xs'}>
        {error ? (
          <div className="text-destructive" role="alert">
            <p>{t(error)}</p>
            <Button
              className="mt-2"
              onClick={() => {
                void request()
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {t('retry')}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground">{t(busy ? (mode ? 'saving' : 'loading') : 'saved')}</p>
        )}
      </div>
    </>
  )
}
