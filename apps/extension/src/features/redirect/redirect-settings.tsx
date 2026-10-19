import { Switch } from '@base-ui/react/switch'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '../../browser-api'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { type Config, defaults, hostPattern, validate } from './config'

async function requestRedirect(action: 'load' | 'save' | 'disable', value?: Config) {
  if (action === 'save' && value) {
    value = validate(value)
    // Request permission within the Save gesture, including Firefox's withheld host access.
    if (value.enabled && !(await api.permissions.request({ origins: [hostPattern(value)] }))) {
      throw new Error('redirectPermission')
    }
  }
  const response = await api.runtime.sendMessage({ action, config: value, feature: 'pathRedirect' })
  if (!response?.ok) {
    throw new Error(response?.code ?? 'error')
  }
  return response
}

export const RedirectSettings = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState(defaults)
  const [busy, setBusy] = useState(true)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState(false)
  const request = useCallback(async (action: 'load' | 'save' | 'disable', value?: Config) => {
    setBusy(true)
    setStatus('')
    setFailed(false)
    try {
      const response = await requestRedirect(action, value)
      setConfig(validate(response.config))
      if (action !== 'load') {
        setStatus(action === 'disable' ? 'redirectDisabled' : 'saved')
      }
    } catch (error) {
      setFailed(true)
      setStatus(error instanceof Error ? error.message : 'error')
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    void request('load')
  }, [request])
  return (
    <section aria-busy={busy} className="space-y-4">
      <h1 className="font-semibold text-2xl">{t('redirectTitle')}</h1>
      <p className="text-muted-foreground text-sm">{t('redirectHint')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void request('save', config)
        }}
      >
        <fieldset className="space-y-4" disabled={busy}>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <label htmlFor="redirect-enabled">{t('redirectEnabled')}</label>
            <Switch.Root
              checked={config.enabled}
              className="inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-input p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-checked:bg-primary"
              disabled={busy}
              id="redirect-enabled"
              onCheckedChange={(enabled) => setConfig((current) => ({ ...current, enabled }))}
            >
              <Switch.Thumb className="size-5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-5" />
            </Switch.Root>
          </div>
          {(['source', 'target'] as const).map((field) => (
            <div className="space-y-2" key={field}>
              <label htmlFor={`redirect-${field}`}>{t(field === 'source' ? 'redirectSource' : 'redirectTarget')}</label>
              <Input
                autoComplete="off"
                id={`redirect-${field}`}
                onChange={(event) => setConfig((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={field === 'source' ? 'https://source.example/' : 'https://destination.example/git/'}
                spellCheck={false}
                value={config[field]}
              />
            </div>
          ))}
          <p className="text-muted-foreground text-sm">{t('redirectLocal')}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} type="submit">
              {t('redirectSave')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                void request('disable')
              }}
              type="button"
              variant="outline"
            >
              {t('redirectDisable')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                void request('load')
              }}
              type="button"
              variant="outline"
            >
              {t('reload')}
            </Button>
          </div>
        </fieldset>
      </form>
      <p
        aria-live="polite"
        className={failed ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
        role={failed ? 'alert' : 'status'}
      >
        {status ? t(status) : ''}
      </p>
    </section>
  )
}
