import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from './browser-api'
import { Button } from './components/ui/button'
import { probeUrl } from './proxy-latency'

export const ProxyLatencyTest = ({
  profileId,
  revision,
  active
}: {
  profileId: string
  revision: number
  active: boolean
}) => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const test = async () => {
    setBusy(true)
    setResult('')
    try {
      const response = await api.runtime.sendMessage({ profileId, revision, type: 'test-proxy' })
      setResult(
        response?.ok && Number.isFinite(response.milliseconds)
          ? t('pingLatency', { milliseconds: response.milliseconds })
          : t(['pingBusy', 'pingChanged', 'pingTimeout'].includes(response?.code) ? response.code : 'pingFailed')
      )
    } catch {
      setResult(t('pingFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="w-full space-y-2 text-sm">
      <Button
        disabled={!active || busy}
        onClick={() => {
          void test()
        }}
        type="button"
        variant="outline"
      >
        {t(busy ? 'pingTesting' : 'pingTest')}
      </Button>
      <p className="break-all text-muted-foreground text-xs">
        {t(active ? 'pingHint' : 'pingInactive', { url: probeUrl })}
      </p>
      <p aria-live="polite">{result}</p>
    </div>
  )
}
