import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from './browser-api'

import type { StoredLog } from './persistent-logs'

export const LogSettings = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<StoredLog[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useCallback(async (action: 'get-logs' | 'clear-logs' | 'export' = 'get-logs') => {
    setBusy(true)
    setFailed(false)
    try {
      const response = await api.runtime.sendMessage({ type: action === 'export' ? 'get-logs' : action })
      if (!response?.ok) {
        throw new Error('logs-unavailable')
      }
      setEntries(response.entries)
      setFailed(response.failed)
      if (action === 'export') {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(response.entries, null, 2)], { type: 'application/json' })
        )
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `browser-proxy-logs-${new Date().toISOString().slice(0, 10)}.json`
        anchor.click()
        setTimeout(() => {
          URL.revokeObjectURL(url)
        }, 1000)
      }
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    void request()
  }, [request])
  const button = 'rounded-md border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50'
  return (
    <section className="space-y-4">
      <h1 className="font-semibold text-2xl">{t('logs')}</h1>
      <p className="text-sm text-zinc-500">{t('logsHint')}</p>
      <div className="flex gap-2">
        {(
          [
            ['get-logs', 'refreshLogs'],
            ['export', 'exportLogs'],
            ['clear-logs', 'clearLogs']
          ] as const
        ).map(([action, label]) => (
          <button
            className={button}
            disabled={busy}
            key={action}
            onClick={() => {
              void request(action)
            }}
            type="button"
          >
            {t(label)}
          </button>
        ))}
      </div>
      {failed && (
        <p className="text-red-700 text-sm" role="alert">
          {t('logs-unavailable')}
        </p>
      )}
      <ol
        aria-label={t('logs')}
        className="max-h-96 space-y-2 overflow-auto rounded-lg border border-zinc-200 p-4 text-xs"
      >
        {entries
          .slice(-200)
          .reverse()
          .map((entry, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Log rows are read-only snapshots and may contain identical records.
            <li key={index}>
              <time>{new Date(entry.timestamp).toLocaleString()}</time> · {entry.level} · {entry.message}
            </li>
          ))}
      </ol>
    </section>
  )
}
