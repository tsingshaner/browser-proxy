import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { api, isFirefox } from './browser-api'
import { Button } from './components/ui/button'
import { openSidePanel } from './side-panel'

export const SidePanelButton = () => {
  const { t } = useTranslation()
  const [windowId, setWindowId] = useState<number>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (isFirefox) {
      return
    }
    void api.windows.getCurrent().then(
      (window) => {
        setWindowId(window.id)
        setFailed(window.id === undefined)
      },
      () => {
        setFailed(true)
      }
    )
  }, [])

  return (
    <div className="mb-2">
      <Button
        className="w-full"
        disabled={!isFirefox && windowId === undefined}
        onClick={() => {
          setFailed(false)
          void openSidePanel(api, windowId).catch(() => {
            setFailed(true)
          })
        }}
        type="button"
      >
        {t('openSidePanel')}
      </Button>
      {failed && (
        <p className="mt-2 text-destructive text-xs" role="alert">
          {t('sidePanelError')}
        </p>
      )}
    </div>
  )
}
