import { exportBackup, type ImportPreview, inspectBackup } from '@browser-proxy/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorKey, requestConfig } from './client'

export const BackupSettings = () => {
  const { t } = useTranslation()
  const [preview, setPreview] = useState<{ report: ImportPreview; text: string; revision: number }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const button = 'rounded-md border border-zinc-200 px-3 py-2 text-sm disabled:opacity-50'
  const inspect = async (file?: File) => {
    setPreview(undefined)
    setSaved(false)
    setError('')
    if (!file) {
      return
    }
    setBusy(true)
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('invalid-backup')
      }
      const text = await file.text()
      const report = inspectBackup(text)
      const config = await requestConfig()
      setPreview({ report, revision: config.revision, text })
    } catch {
      setError('invalid-backup')
    } finally {
      setBusy(false)
    }
  }
  const restore = async () => {
    if (!preview) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await requestConfig({
        allowPartial: preview.report.issues.length > 0,
        revision: preview.revision,
        text: preview.text,
        type: 'import-config'
      })
      setPreview(undefined)
      setSaved(true)
    } catch (error) {
      setError(errorKey(error))
    } finally {
      setBusy(false)
    }
  }
  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const url = URL.createObjectURL(new Blob([exportBackup(await requestConfig())], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `browser-proxy-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    } catch (error) {
      setError(errorKey(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="space-y-5">
      <h1 className="font-semibold text-2xl">{t('backup')}</h1>
      <p className="text-sm text-zinc-600">{t('backupSensitive')}</p>
      <button
        className={button}
        disabled={busy}
        onClick={() => {
          void download()
        }}
        type="button"
      >
        {t('exportBackup')}
      </button>
      <label className="block font-medium text-sm">
        {t('importBackup')}
        <input
          accept=".json,.bak,application/json"
          className="mt-2 block w-full rounded-md border border-zinc-200 p-3"
          disabled={busy}
          onChange={(event) => {
            void inspect(event.target.files?.[0])
            event.target.value = ''
          }}
          type="file"
        />
      </label>
      <div aria-live="polite">
        {error && (
          <p className="text-red-700 text-sm" role="alert">
            {t(error)}
          </p>
        )}
        {saved && <p className="text-sm text-zinc-600">{t('saved')}</p>}
      </div>
      {preview && (
        <div className="space-y-4 rounded-xl border border-zinc-200 p-5">
          <p className="text-sm">
            {t('importSummary', {
              groups: preview.report.config.ruleProfiles?.length ?? 0,
              profiles: preview.report.config.profiles.length,
              rules:
                preview.report.config.rules.length +
                (preview.report.config.ruleProfiles ?? []).reduce((sum, p) => sum + p.rules.length, 0)
            })}
          </p>
          {preview.report.legacy && <p className="text-sm text-zinc-600">{t('legacyImport')}</p>}
          {preview.report.issues.length > 0 && (
            <>
              <p className="font-medium text-amber-800 text-sm">{t('importWarning')}</p>
              <ul className="max-h-72 space-y-2 overflow-auto text-sm">
                {preview.report.issues.map((issue) => (
                  <li key={`${issue.path}:${issue.reason}`}>
                    <code className="break-all">{issue.path}</code> — {t(issue.reason)}
                    {issue.kind ? ` (${issue.kind})` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="text-sm text-zinc-600">{t('replaceWarning')}</p>
          <div className="flex gap-3">
            <button
              className={`${button} bg-zinc-900 text-white`}
              disabled={busy}
              onClick={() => {
                void restore()
              }}
              type="button"
            >
              {t(preview.report.issues.length > 0 ? 'importSupported' : 'confirmImport')}
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setPreview(undefined)
              }}
              type="button"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
