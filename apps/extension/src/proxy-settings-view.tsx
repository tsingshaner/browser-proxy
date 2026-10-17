import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ProxyConfig, ProxyProfile } from '@browser-proxy/core'

import { errorKey, requestConfig } from './client'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'

export const ProxySettings = () => {
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
        <p className="text-muted-foreground text-sm">Browser Proxy</p>
        <h1 className="mt-2 font-semibold text-2xl tracking-tight">{t('profiles')}</h1>
      </header>
      <div aria-live="polite" className="mb-5 text-sm">
        {error ? (
          <div className="rounded-lg border border-destructive/30 p-4 text-destructive" role="alert">
            <p>{t(error)}</p>
            <Button
              className="mt-3"
              disabled={busy}
              onClick={() => {
                void request()
              }}
              type="button"
              variant="outline"
            >
              {t('retry')}
            </Button>
          </div>
        ) : busy ? (
          <p>{t('loading')}</p>
        ) : null}
      </div>
      {editing !== undefined ? (
        <form className="rounded-xl border border-border p-6" key={editing?.id ?? 'new'} onSubmit={save}>
          <fieldset className="space-y-5" disabled={busy}>
            <legend className="mb-4 font-medium">{t(editing ? 'edit' : 'add')}</legend>
            <label className="grid gap-2 font-medium text-sm" htmlFor="proxy-name">
              {t('name')}
              <Input defaultValue={editing?.name} id="proxy-name" maxLength={80} name="name" required />
            </label>
            <label className="grid gap-2 font-medium text-sm" htmlFor="proxy-scheme">
              {t('scheme')}
              <NativeSelect className="w-full" defaultValue={editing?.scheme ?? 'http'} id="proxy-scheme" name="scheme">
                {['http', 'https', 'socks4', 'socks5'].map((s) => (
                  <option key={s} value={s}>
                    {s.toUpperCase()}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-2 font-medium text-sm" htmlFor="proxy-host">
              {t('host')}
              <Input
                defaultValue={editing?.host}
                id="proxy-host"
                name="host"
                placeholder="proxy.example.com"
                required
              />
            </label>
            <label className="grid gap-2 font-medium text-sm" htmlFor="proxy-port">
              {t('port')}
              <Input
                defaultValue={editing?.port ?? 8080}
                id="proxy-port"
                max={65535}
                min={1}
                name="port"
                required
                step={1}
                type="number"
              />
            </label>
            <p className="text-muted-foreground text-xs">{t('authHint')}</p>
            <label className="grid gap-2 font-medium text-sm" htmlFor="proxy-username">
              {t('username')}
              <Input autoComplete="off" defaultValue={editing?.auth?.username} id="proxy-username" name="username" />
            </label>
            <label className="grid gap-2 font-medium text-sm" htmlFor="proxy-password">
              {t('password')}
              <Input
                autoComplete="new-password"
                defaultValue={editing?.auth?.password}
                id="proxy-password"
                name="password"
                type="password"
              />
            </label>
            <div className="flex gap-3">
              <Button type="submit">{t('save')}</Button>
              <Button
                onClick={() => {
                  setEditing(undefined)
                }}
                type="button"
                variant="outline"
              >
                {t('cancel')}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <>
          <Button
            className="mb-5"
            disabled={busy || !config}
            onClick={() => {
              setEditing(null)
            }}
            type="button"
          >
            {t('add')}
          </Button>
          <ul className="space-y-3">
            {config?.profiles.map((profile) => (
              <li
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5"
                key={profile.id}
              >
                <div className="min-w-0">
                  <h2 className="truncate font-medium">{profile.name}</h2>
                  <p className="mt-1 break-all text-muted-foreground text-sm">
                    {profile.scheme.toUpperCase()} · {profile.host}:{profile.port}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setEditing(profile)
                    }}
                    type="button"
                    variant="outline"
                  >
                    {t('edit')}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => {
                      void request({ id: profile.id, revision: config.revision, type: 'delete-profile' })
                    }}
                    type="button"
                    variant="outline"
                  >
                    {t('remove')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {config && config.profiles.length === 0 && (
            <p className="rounded-xl border border-border border-dashed p-8 text-center text-muted-foreground text-sm">
              {t('empty')}
            </p>
          )}
        </>
      )}
    </section>
  )
}
