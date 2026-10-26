import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { MAX_RULES } from './config'
import { HeaderRuleEditor } from './header-rule-editor'
import { useHeaderSettings } from './use-header-settings'

export const HeaderSettings = () => {
  const { t } = useTranslation()
  const { config, feedback, actions } = useHeaderSettings()
  return (
    <section aria-busy={feedback.busy} className="space-y-4">
      <h1 className="font-semibold text-2xl">{t('headersTitle')}</h1>
      <p className="text-muted-foreground text-sm">{t('headersHint')}</p>
      <p className="text-muted-foreground text-sm">{t('headersMatchHint')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void actions.save()
        }}
      >
        <fieldset className="space-y-4" disabled={feedback.busy}>
          <label className="flex items-center gap-2" htmlFor="headers-enabled">
            <Checkbox
              checked={config.enabled}
              disabled={feedback.busy}
              id="headers-enabled"
              onCheckedChange={actions.enable}
            />
            {t('headersEnabled')}
          </label>
          {config.rules.map((rule, index) => (
            <HeaderRuleEditor
              busy={feedback.busy}
              count={config.rules.length}
              index={index}
              key={rule.id}
              onChange={(update) => actions.update(rule.id, update)}
              onMove={(direction) => actions.move(index, direction)}
              onRemove={() => actions.remove(rule.id)}
              rule={rule}
            />
          ))}
          <Button disabled={config.rules.length >= MAX_RULES} onClick={actions.add} type="button" variant="outline">
            {t('addRule')}
          </Button>
          <p className="text-muted-foreground text-sm">{t('headersLocal')}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t('saveRules')}</Button>
            <Button
              onClick={() => {
                void actions.disable()
              }}
              type="button"
              variant="outline"
            >
              {t('redirectDisable')}
            </Button>
            <Button
              onClick={() => {
                void actions.reload()
              }}
              type="button"
              variant="outline"
            >
              {t('reload')}
            </Button>
          </div>
        </fieldset>
      </form>
      <p
        aria-live="polite"
        className={feedback.failed ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'}
        role={feedback.failed ? 'alert' : 'status'}
      >
        {feedback.status ? t(feedback.status) : ''}
      </p>
    </section>
  )
}
