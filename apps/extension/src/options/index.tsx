import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'

import { api } from '../browser-api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { BackupSettings } from '../features/backup/backup-settings'
import { HeaderSettings } from '../features/headers/header-settings'
import { LogSettings } from '../features/logs/log-settings'
import { ModeSwitcher } from '../features/proxy/mode-switcher'
import { ProxySettings } from '../features/proxy/proxy-settings-view'
import { RulesSettings } from '../features/proxy/rules-settings'
import { RedirectSettings } from '../features/redirect/redirect-settings'
import { TabSettings } from '../features/tabs/tab-settings'
import { translationsReady } from '../i18n'
import { sectionFromHash, settingsSections } from './navigation'
import '../style.css'

const Options = () => {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <Tabs defaultValue={sectionFromHash(location.hash)}>
        <TabsList
          aria-label={t('manage')}
          className="mb-6 grid w-full grid-cols-2 group-data-[orientation=horizontal]/tabs:h-auto sm:flex sm:flex-wrap"
        >
          {settingsSections.map((value) => (
            <TabsTrigger className="h-9" key={value} value={value}>
              {t(value)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="mode">
          <ModeSwitcher />
        </TabsContent>
        <TabsContent value="profiles">
          <ProxySettings />
        </TabsContent>
        <TabsContent value="rulesTitle">
          <RulesSettings />
        </TabsContent>
        <TabsContent value="redirectTitle">
          <RedirectSettings />
        </TabsContent>
        <TabsContent value="headersTitle">
          <HeaderSettings />
        </TabsContent>
        <TabsContent value="tabsTitle">
          <TabSettings />
        </TabsContent>
        <TabsContent value="backup">
          <BackupSettings />
        </TabsContent>
        <TabsContent value="logs">
          <LogSettings />
        </TabsContent>
      </Tabs>
    </main>
  )
}
void translationsReady.then(() => {
  document.documentElement.lang = api.i18n.getUILanguage()
  const root = document.getElementById('root')
  if (!root) {
    throw new Error('Missing root element')
  }
  createRoot(root).render(<Options />)
})
