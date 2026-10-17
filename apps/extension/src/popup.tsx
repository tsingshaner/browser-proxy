import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'

import type { ProxyConfig } from '@browser-proxy/core'

import { api, isFirefox } from './browser-api'
import { errorKey, requestConfig } from './client'
import { translationsReady } from './i18n'
import './style.css'
import { RequestStatus } from './request-status'

const ModeSwitcher = () => {
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
      setConfig(await requestConfig(next ? { mode: next, revision: config?.revision, type: 'set-mode' } : undefined))
    } catch (error) {
      setError(errorKey(error))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void requestConfig()
      .then(setConfig)
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
        <p className="mb-4 text-red-700 text-sm" role="alert">
          {t('authFailed')}
        </p>
      )}
      <fieldset className="space-y-3" disabled={busy}>
        <legend className="mb-3 font-medium text-xs text-zinc-500 uppercase tracking-wider">{t('mode')}</legend>
        {[
          'direct',
          'system',
          'auto',
          ...(config?.profiles.map((p) => p.id) ?? []),
          ...(config?.ruleProfiles?.map((p) => p.id) ?? [])
        ].map((value) => (
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-zinc-500 ${mode === value ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'} ${busy ? 'opacity-60' : ''}`}
            key={value}
          >
            <input
              checked={mode === value}
              className="size-4 accent-zinc-900"
              name="mode"
              onChange={() => {
                void request(value)
              }}
              type="radio"
              value={value}
            />
            <span>
              <span className="block font-medium text-sm">
                {[...(config?.profiles ?? []), ...(config?.ruleProfiles ?? [])].find((p) => p.id === value)?.name ??
                  t(value)}
              </span>
              <span className="mt-1 block text-xs text-zinc-500">
                {config?.profiles.find((p) => p.id === value)?.host ??
                  t(['direct', 'system'].includes(value) ? `${value}Hint` : 'autoHint')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div aria-live="polite" className="mt-4 min-h-10 text-xs">
        {error ? (
          <div className="text-red-700" role="alert">
            <p>{t(error)}</p>
            <button
              className="mt-2 rounded-md border border-red-200 px-3 py-1.5 font-medium focus-visible:outline-2"
              onClick={() => {
                void request()
              }}
              type="button"
            >
              {t('retry')}
            </button>
          </div>
        ) : (
          <p className="text-zinc-500">{t(busy ? (mode ? 'saving' : 'loading') : 'saved')}</p>
        )}
      </div>
    </>
  )
}

const Popup = () => {
  const { t } = useTranslation()
  return (
    <main className="w-80 bg-white p-5 text-zinc-950">
      <header className="mb-6">
        <h1 className="font-semibold text-xl tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
      </header>
      <ModeSwitcher />
      <RequestStatus />
      <button
        className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
        onClick={() => {
          void api.runtime.openOptionsPage()
        }}
        type="button"
      >
        {t('manage')}
      </button>
      <footer className="mt-2 border-zinc-100 border-t pt-4 text-[11px] text-zinc-400">
        {t(isFirefox ? 'footerFirefox' : 'footer')}
      </footer>
    </main>
  )
}

void translationsReady.then(() => {
  document.documentElement.lang = api.i18n.getUILanguage()
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('Missing root element')
  }
  createRoot(root).render(<Popup />)
})
