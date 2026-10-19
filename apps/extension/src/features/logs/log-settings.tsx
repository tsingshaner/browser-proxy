import { Switch } from '@base-ui/react/switch'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '../../browser-api'
import { Button } from '../../components/ui/button'

import type { StoredLog } from './persistent-logs'

export const LogSettings = () => {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<StoredLog[]>([])
  const [busy, setBusy] = useState(false)
  const [enabled, setEnabled] = useState<boolean>()
  const [failed, setFailed] = useState(false)
  const request = useCallback(
    async (action: 'get-logs' | 'clear-logs' | 'export' | 'set-logs-enabled' = 'get-logs', nextEnabled?: boolean) => {
      setBusy(true)
      setFailed(false)
      try {
        const response = await api.runtime.sendMessage({
          enabled: nextEnabled,
          type: action === 'export' ? 'get-logs' : action
        })
        if (!response?.ok) {
          throw new Error('logs-unavailable')
        }
        setEnabled(response.enabled)
        setEntries(response.entries)
        setFailed(response.failed)
        if (action === 'export') {
          const url = URL.createObjectURL(
            new Blob([JSON.stringify(response.entries, null, 2)], { type: 'application/json' })
          )
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = `browser-tookits-logs-${new Date().toISOString().slice(0, 10)}.json`
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
    },
    []
  )
  useEffect(() => {
    void request()
  }, [request])
  return (
    <section className="space-y-4">
      <h1 className="font-semibold text-2xl">{t('logs')}</h1>
      <p className="text-muted-foreground text-sm">{t('logsHint')}</p>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
        <div className="space-y-1">
          <label className="font-medium text-sm" htmlFor="logs-enabled">
            {t('logsEnabled')}
          </label>
          <p className="text-muted-foreground text-xs" id="logs-enabled-hint">
            {t('logsEnabledHint')}
          </p>
        </div>
        <Switch.Root
          aria-describedby="logs-enabled-hint"
          checked={enabled ?? false}
          className="inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-input p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-checked:bg-primary"
          disabled={busy || enabled === undefined}
          id="logs-enabled"
          onCheckedChange={(checked) => {
            void request('set-logs-enabled', checked)
          }}
        >
          <Switch.Thumb className="size-5 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-5" />
        </Switch.Root>
      </div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['get-logs', 'refreshLogs'],
            ['export', 'exportLogs'],
            ['clear-logs', 'clearLogs']
          ] as const
        ).map(([action, label]) => (
          <Button
            disabled={busy}
            key={action}
            onClick={() => {
              void request(action)
            }}
            type="button"
            variant="outline"
          >
            {t(label)}
          </Button>
        ))}
      </div>
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t('logs-unavailable')}
        </p>
      )}
      <ol
        aria-label={t('logs')}
        className="max-h-96 space-y-2 overflow-auto rounded-lg border border-border p-4 text-xs"
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
