import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api } from '../../browser-api'
import { Button } from '../../components/ui/button'

export const TabButton = () => {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div className="mb-2">
      <Button
        className="w-full"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setFailed(false)
          void (async () => {
            const window = await api.windows.getCurrent()
            if (window.id === undefined || window.incognito || window.type !== 'normal') {
              throw new Error('window')
            }
            await api.tabs.create({
              url: api.runtime.getURL(`src/options/index.html#tabs&window=${window.id}`),
              windowId: window.id
            })
          })()
            .catch(() => setFailed(true))
            .finally(() => setBusy(false))
        }}
        variant="outline"
      >
        {t('tabsOpen')}
      </Button>
      {failed && (
        <p className="text-destructive text-xs" role="alert">
          {t('tabsError')}
        </p>
      )}
    </div>
  )
}
