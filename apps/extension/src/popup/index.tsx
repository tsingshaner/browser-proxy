import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'

import { api, isFirefox } from '../browser-api'
import { Button } from '../components/ui/button'
import { ModeSwitcher } from '../features/proxy/mode-switcher'
import { translationsReady } from '../i18n'
import '../style.css'

import { RequestStatus } from '../features/request-monitor/request-status'
import { SidePanelButton } from '../features/side-panel/side-panel-button'

const Popup = () => {
  const { t } = useTranslation()
  return (
    <main className="w-80 bg-background p-5 text-foreground">
      <header className="mb-6">
        <h1 className="font-semibold text-xl tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted-foreground text-sm">{t('subtitle')}</p>
      </header>
      <ModeSwitcher />
      <RequestStatus />
      <SidePanelButton />
      <Button
        className="w-full"
        onClick={() => {
          void api.runtime.openOptionsPage()
        }}
        type="button"
        variant="outline"
      >
        {t('manage')}
      </Button>
      <footer className="mt-2 border-border border-t pt-4 text-[11px] text-muted-foreground">
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
