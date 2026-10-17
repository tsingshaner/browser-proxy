import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'

import { BackupSettings } from './backup-settings'
import { api } from './browser-api'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { translationsReady } from './i18n'
import { LogSettings } from './log-settings'
import { ProxySettings } from './proxy-settings-view'
import { RulesSettings } from './rules-settings'
import './style.css'

const Options = () => {
  const { t } = useTranslation()
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <Tabs defaultValue={location.hash.startsWith('#rule=') ? 'rulesTitle' : 'profiles'}>
        <TabsList
          aria-label={t('manage')}
          className="mb-6 grid w-full grid-cols-2 group-data-[orientation=horizontal]/tabs:h-auto sm:flex"
        >
          {['profiles', 'rulesTitle', 'backup', 'logs'].map((value) => (
            <TabsTrigger className="h-9" key={value} value={value}>
              {t(value)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profiles">
          <ProxySettings />
        </TabsContent>
        <TabsContent value="rulesTitle">
          <RulesSettings />
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
