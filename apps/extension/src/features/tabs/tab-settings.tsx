import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import { NativeSelect } from '../../components/ui/native-select'
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group'
import { protectedTab } from './tab-manager'
import { useTabManager } from './use-tab-manager'

export const TabSettings = () => {
  const { t } = useTranslation()
  const { preview, selections, scope, recovery, busy, error, result, actions } = useTabManager()
  const selected = selections.reduce((total, item) => total + item.closeIds.length, 0)
  return (
    <section aria-busy={busy} aria-label={t('tabsTitle')} className="space-y-4">
      <h2 className="font-semibold text-lg">{t('tabsOpen')}</h2>
      <p className="text-sm">{t('tabsWarning')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm" htmlFor="tab-scope">
          <span>{t('tabsScope')}</span>
          <NativeSelect
            disabled={busy}
            id="tab-scope"
            onChange={(event) => actions.scope(event.target.value)}
            value={scope}
          >
            <option value="current">{t('tabsCurrent')}</option>
            <option value="all">{t('tabsAll')}</option>
          </NativeSelect>
        </label>
        <Button disabled={busy} onClick={() => void actions.refresh()} variant="outline">
          {t('tabsRefresh')}
        </Button>
      </div>
      {busy && <p role="status">{t('tabsLoading')}</p>}
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {t(error)}
        </p>
      )}
      {result && <p role="status">{t(result.key, result.values)}</p>}
      {preview && (
        <p className="text-muted-foreground text-sm">
          {t('tabsSummary', { count: preview.count, groups: preview.groups.length, selected })}
        </p>
      )}
      {preview && selected === 0 && <p>{t('tabsEmpty')}</p>}
      {preview?.groups.map((group, index) => (
        <fieldset
          className="min-w-0 space-y-3 rounded-lg border border-border p-3"
          disabled={busy}
          key={group.tabs[0].id}
        >
          <legend className="max-w-full truncate px-1 text-sm" title={group.tabs[0].url}>
            {group.tabs[0].url}
          </legend>
          <RadioGroup
            aria-label={`${t('tabsKeep')}: ${group.tabs[0].url}`}
            disabled={busy}
            onValueChange={(value) => actions.keep(index, Number(value))}
            value={selections[index]?.keepId}
          >
            {group.tabs.map((tab) => (
              <div className="space-y-2 border-border border-b pb-3 last:border-0 last:pb-0" key={tab.id}>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="relative size-4 shrink-0">
                    <Globe aria-hidden="true" className="absolute size-4" />
                    {tab.favIconUrl && (
                      <img
                        alt=""
                        className="absolute size-4 bg-background"
                        onError={(event) => {
                          event.currentTarget.hidden = true
                        }}
                        src={tab.favIconUrl}
                      />
                    )}
                  </span>
                  <span className="truncate text-sm" title={tab.title || tab.url}>
                    {tab.title || tab.url}
                  </span>
                </div>
                <p className="break-all text-muted-foreground text-xs">{tab.url}</p>
                <p className="text-muted-foreground text-xs">
                  {t('tabsWindow', { id: tab.windowId })}
                  {tab.cookieStoreId && ` · ${tab.cookieStoreId}`}
                  {tab.pinned && ` · ${t('tabsPinned')}`}
                  {tab.active && ` · ${t('tabsActive')}`}
                  {tab.audible && ` · ${t('tabsAudible')}`}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-1" htmlFor={`keep-${tab.id}`}>
                    <RadioGroupItem id={`keep-${tab.id}`} value={tab.id} />
                    {t('tabsKeep')}
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      checked={selections[index]?.closeIds.includes(tab.id) ?? false}
                      disabled={protectedTab(tab) || selections[index]?.keepId === tab.id}
                      onChange={(event) => actions.toggle(index, tab.id, event.target.checked)}
                      type="checkbox"
                    />
                    {t('tabsCloseItem')}
                  </label>
                  <Button onClick={() => void actions.visit(tab.id)} size="sm" variant="outline">
                    {t('tabsVisit')}
                  </Button>
                </div>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || selected === 0 || !preview} onClick={() => void actions.close()}>
          {t('tabsClose', { count: selected })}
        </Button>
        <Button disabled={busy || recovery.count === 0} onClick={() => void actions.reopen()} variant="outline">
          {t('tabsReopen', { count: recovery.count })}
        </Button>
      </div>
      {recovery.uncertain > 0 && (
        <p className="text-destructive text-sm" role="alert">
          {t('tabsUncertain', { count: recovery.uncertain })}
        </p>
      )}
      {recovery.count === 0 && <p className="text-muted-foreground text-xs">{t('tabsRecoverEmpty')}</p>}
      <p className="text-muted-foreground text-xs">{t('tabsLocal')}</p>
    </section>
  )
}
