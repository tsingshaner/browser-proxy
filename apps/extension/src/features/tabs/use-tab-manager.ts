import { useCallback, useEffect, useRef, useState } from 'react'

import { api } from '../../browser-api'
import { type Preview, protectedTab, type Selection } from './tab-manager'

async function request<T>(action: string, values: object = {}): Promise<T> {
  const response = await api.runtime.sendMessage({ action, feature: 'tabs', ...values })
  if (!response?.ok) {
    throw new Error(response?.code ?? 'tabsError')
  }
  return response.value as T
}

export function useTabManager() {
  const [scope, setScope] = useState('current')
  const [source, setSource] = useState(-1)
  const [preview, setPreview] = useState<Preview>()
  const [selections, setSelections] = useState<Selection[]>([])
  const [recovery, setRecovery] = useState({ count: 0, uncertain: 0 })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ key: string; values: Record<string, number> }>()
  const running = useRef(false)

  const reload = useCallback(async (windowId: number | null) => {
    setPreview(undefined)
    setSelections([])
    const saved = await request<typeof recovery>('recovery')
    setRecovery(saved)
    const next = await request<Preview>('scan', { windowId })
    setPreview(next)
    setSelections(
      next.groups.map((group) => ({
        closeIds: group.tabs.filter((tab) => tab.id !== group.keepId && !protectedTab(tab)).map((tab) => tab.id),
        keepId: group.keepId
      }))
    )
  }, [])

  const run = useCallback(async (work: () => Promise<void>) => {
    if (running.current) {
      return
    }
    running.current = true
    setBusy(true)
    setError('')
    try {
      await work()
    } catch (failure) {
      setError(failure instanceof Error && /^tabs[A-Z]/.test(failure.message) ? failure.message : 'tabsError')
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void run(async () => {
      const parameter = new URLSearchParams(location.hash.slice(1)).get('window')
      const current = await api.windows.getCurrent()
      if (current.incognito) {
        throw new Error('tabsWindowMissing')
      }
      const id = parameter === null ? current.id : Number(parameter)
      if (id === undefined || !Number.isInteger(id) || id < 0) {
        throw new Error('tabsWindowMissing')
      }
      setSource(id)
      await reload(id)
    })
  }, [reload, run])

  const refresh = () =>
    run(async () => {
      setResult(undefined)
      await reload(scope === 'all' ? null : source)
    })
  return {
    actions: {
      close: () =>
        run(async () => {
          const value = await request<{ succeeded: number; failed: number; skipped: number; storageFailed: boolean }>(
            'close',
            { previewId: preview?.id, selections }
          )
          setResult({
            key: 'tabsClosed',
            values: { failed: value.failed, skipped: value.skipped, succeeded: value.succeeded }
          })
          await reload(scope === 'all' ? null : source)
          if (value.storageFailed) {
            setError('tabsStorage')
          }
        }),
      keep: (index: number, id: number) =>
        setSelections((current) =>
          current.map((selection, i) =>
            i === index ? { closeIds: selection.closeIds.filter((closed) => closed !== id), keepId: id } : selection
          )
        ),
      refresh,
      reopen: () =>
        run(async () => {
          const current = await api.windows.getCurrent()
          if (current.incognito || current.type !== 'normal') {
            throw new Error('tabsWindowMissing')
          }
          const value = await request<{ succeeded: number; failed: number; relocated: number; storageFailed: boolean }>(
            'reopen',
            { windowId: current.id }
          )
          setResult({
            key: 'tabsReopened',
            values: { failed: value.failed, relocated: value.relocated, succeeded: value.succeeded }
          })
          await reload(scope === 'all' ? null : source)
          if (value.storageFailed) {
            setError('tabsStorage')
          }
        }),
      scope: (value: string) => {
        setScope(value)
        void run(async () => {
          setResult(undefined)
          await reload(value === 'all' ? null : source)
        })
      },
      toggle: (index: number, id: number, checked: boolean) =>
        setSelections((current) =>
          current.map((selection, i) =>
            i === index
              ? {
                  ...selection,
                  closeIds: checked ? [...selection.closeIds, id] : selection.closeIds.filter((closed) => closed !== id)
                }
              : selection
          )
        ),
      visit: (id: number) =>
        run(async () => {
          const tab = await api.tabs.get(id)
          await api.windows.update(tab.windowId, { focused: true })
          await api.tabs.update(id, { active: true })
          await reload(scope === 'all' ? null : source)
        })
    },
    busy,
    error,
    preview,
    recovery,
    result,
    scope,
    selections
  }
}
