import { type FormEvent, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'

import type { ProxyConfig, ProxyProfile } from '@browser-proxy/core'

import { BackupSettings } from './backup-settings'
import { api } from './browser-api'
import { errorKey, requestConfig } from './client'
import { translationsReady } from './i18n'
import { LogSettings } from './log-settings'
import { RulesSettings } from './rules-settings'
import './style.css'

const button = 'rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50'
const input =
  'mt-2 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-zinc-500'

const ProxySettings = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ProxyConfig>()
  const [editing, setEditing] = useState<ProxyProfile | null>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const request = async (message?: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    try {
      setConfig(await requestConfig(message))
      setEditing(undefined)
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

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    void request({
      profile: {
        host: data.get('host'),
        id: editing?.id ?? crypto.randomUUID(),
        name: data.get('name'),
        port: Number(data.get('port')),
        scheme: data.get('scheme'),
        ...(data.get('username') ? { auth: { password: data.get('password'), username: data.get('username') } } : {})
      },
      revision: config?.revision,
      type: 'save-profile'
    })
  }

  return (
    <section>
      <header className="mb-8">
        <p className="text-sm text-zinc-500">Browser Proxy</p>
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">{t('profiles')}</h1>
      </header>
      <div aria-live="polite" className="mb-5 text-sm">
        {error ? (
          <div className="rounded-lg border border-red-200 p-4 text-red-700" role="alert">
            <p>{t(error)}</p>
            <button
              className={`${button} mt-3`}
              disabled={busy}
              onClick={() => {
                void request()
              }}
              type="button"
            >
              {t('retry')}
            </button>
          </div>
        ) : busy ? (
          <p>{t('loading')}</p>
        ) : null}
      </div>
      {editing !== undefined ? (
        <form className="rounded-xl border border-zinc-200 p-6" key={editing?.id ?? 'new'} onSubmit={save}>
          <fieldset className="space-y-5" disabled={busy}>
            <legend className="mb-4 font-medium">{t(editing ? 'edit' : 'add')}</legend>
            <label className="block font-medium text-sm">
              {t('name')}
              <input className={input} defaultValue={editing?.name} maxLength={80} name="name" required />
            </label>
            <label className="block font-medium text-sm">
              {t('scheme')}
              <select className={input} defaultValue={editing?.scheme ?? 'http'} name="scheme">
                {['http', 'https', 'socks4', 'socks5'].map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="block font-medium text-sm">
              {t('host')}
              <input
                className={input}
                defaultValue={editing?.host}
                name="host"
                placeholder="proxy.example.com"
                required
              />
            </label>
            <label className="block font-medium text-sm">
              {t('port')}
              <input
                className={input}
                defaultValue={editing?.port ?? 8080}
                max={65535}
                min={1}
                name="port"
                required
                step={1}
                type="number"
              />
            </label>
            <p className="text-xs text-zinc-500">{t('authHint')}</p>
            <label className="block font-medium text-sm">
              {t('username')}
              <input autoComplete="off" className={input} defaultValue={editing?.auth?.username} name="username" />
            </label>
            <label className="block font-medium text-sm">
              {t('password')}
              <input
                autoComplete="new-password"
                className={input}
                defaultValue={editing?.auth?.password}
                name="password"
                type="password"
              />
            </label>
            <div className="flex gap-3">
              <button className={`${button} bg-zinc-900 text-white hover:bg-zinc-800`} type="submit">
                {t('save')}
              </button>
              <button
                className={button}
                onClick={() => {
                  setEditing(undefined)
                }}
                type="button"
              >
                {t('cancel')}
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <button
            className={`${button} mb-5`}
            disabled={busy || !config}
            onClick={() => {
              setEditing(null)
            }}
            type="button"
          >
            {t('add')}
          </button>
          <ul className="space-y-3">
            {config?.profiles.map((profile) => (
              <li
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-5"
                key={profile.id}
              >
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{profile.name}</h2>
                  <p className="mt-1 break-all text-sm text-zinc-500">
                    {profile.scheme.toUpperCase()} · {profile.host}:{profile.port}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      setEditing(profile)
                    }}
                    type="button"
                  >
                    {t('edit')}
                  </button>
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => {
                      void request({ id: profile.id, revision: config.revision, type: 'delete-profile' })
                    }}
                    type="button"
                  >
                    {t('remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {config && config.profiles.length === 0 && (
            <p className="rounded-xl border border-zinc-200 border-dashed p-8 text-center text-sm text-zinc-500">
              {t('empty')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
const Options = () => {
  const { t } = useTranslation()
  const [page, setPage] = useState(location.hash.startsWith('#rule=') ? 'rulesTitle' : 'profiles')
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-zinc-950">
      <nav className="mb-8 flex gap-3">
        {['profiles', 'rulesTitle', 'backup', 'logs'].map((value) => (
          <button
            aria-pressed={page === value}
            className={button}
            key={value}
            onClick={() => {
              setPage(value)
            }}
            type="button"
          >
            {t(value)}
          </button>
        ))}
      </nav>
      {page === 'profiles' ? (
        <ProxySettings />
      ) : page === 'rulesTitle' ? (
        <RulesSettings />
      ) : page === 'backup' ? (
        <BackupSettings />
      ) : (
        <LogSettings />
      )}
    </main>
  )
}
void translationsReady.then(() => {
  document.documentElement.lang = api.i18n.getUILanguage()
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('Missing root element')
  }
  createRoot(root).render(<Options />)
})
