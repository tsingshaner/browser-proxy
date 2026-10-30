import { Globe, Settings } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'

import { api, isFirefox } from '../browser-api'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { BackupSettings } from '../features/backup/backup-settings'
import { HeaderSettings } from '../features/headers/header-settings'
import { LogSettings } from '../features/logs/log-settings'
import { ModeSwitcher } from '../features/proxy/mode-switcher'
import { ProxySettings } from '../features/proxy/proxy-settings-view'
import { RulesSettings } from '../features/proxy/rules-settings'
import { RedirectSettings } from '../features/redirect/redirect-settings'
import { RequestStatus } from '../features/request-monitor/request-status'
import { SidePanelButton } from '../features/side-panel/side-panel-button'
import { TabButton } from '../features/tabs/tab-button'
import { translationsReady } from '../i18n'
import '../style.css'

const Popup = () => {
  const { t } = useTranslation()
  return (
    <main className="flex h-[600px] w-[480px] flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Globe aria-hidden="true" className="size-5" />
          <h1 className="font-semibold text-base tracking-tight">{t('title')}</h1>
        </div>
        <Button
          aria-label={t('allSettings')}
          render={<a href={api.runtime.getURL('src/options/index.html')} rel="noreferrer" target="_blank" />}
          size="icon"
          title={t('allSettings')}
          variant="ghost"
        >
          <Settings aria-hidden="true" />
        </Button>
      </header>
      <Tabs className="min-h-0 flex-1 gap-0" defaultValue="mode">
        <TabsList
          aria-label={t('allSettings')}
          className="mx-4 my-2 grid w-auto shrink-0 grid-cols-4 group-data-[orientation=horizontal]/tabs:h-auto"
        >
          {['mode', 'profiles', 'rulesTitle', 'redirectTitle', 'headersTitle', 'backup', 'logs'].map((section) => (
            <TabsTrigger className="h-auto min-h-9 whitespace-normal text-xs" key={section} value={section}>
              {t(section)}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [overflow-wrap:anywhere]">
          <TabsContent className="space-y-4" keepMounted value="mode">
            <ModeSwitcher compact />
            <RequestStatus />
          </TabsContent>
          <TabsContent keepMounted value="profiles">
            <ProxySettings />
          </TabsContent>
          <TabsContent keepMounted value="rulesTitle">
            <RulesSettings />
          </TabsContent>
          <TabsContent keepMounted value="redirectTitle">
            <RedirectSettings />
          </TabsContent>
          <TabsContent keepMounted value="headersTitle">
            <HeaderSettings />
          </TabsContent>
          <TabsContent keepMounted value="backup">
            <BackupSettings />
          </TabsContent>
          <TabsContent keepMounted value="logs">
            <LogSettings />
          </TabsContent>
        </div>
      </Tabs>
      <footer className="shrink-0 border-t bg-background px-4 py-3">
        <p className="mb-2 text-muted-foreground text-xs">{t('popupDraftHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          <SidePanelButton />
          <TabButton />
        </div>
        <p className="text-[11px] text-muted-foreground">{t(isFirefox ? 'footerFirefox' : 'footer')}</p>
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
