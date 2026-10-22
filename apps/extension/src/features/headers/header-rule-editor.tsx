import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { NativeSelect } from '../../components/ui/native-select'
import { type HeaderRule, METHODS, RESOURCES } from './config'

type Props = {
  rule: HeaderRule
  index: number
  count: number
  onChange(update: Partial<HeaderRule>): void
  onRemove(): void
  onMove(direction: -1 | 1): void
}

export const HeaderRuleEditor = ({ rule, index, count, onChange, onRemove, onMove }: Props) => {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1">{t('rulePosition', { number: index + 1 })}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2">
          <input
            checked={rule.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
            type="checkbox"
          />
          {t('headersRuleEnabled')}
        </label>
        <Button disabled={index === 0} onClick={() => onMove(-1)} type="button" variant="outline">
          {t('moveUp')}
        </Button>
        <Button disabled={index === count - 1} onClick={() => onMove(1)} type="button" variant="outline">
          {t('moveDown')}
        </Button>
        <Button onClick={onRemove} type="button" variant="outline">
          {t('remove')}
        </Button>
      </div>
      <div className="space-y-1">
        <label htmlFor={`header-${rule.id}-name`}>{t('name')}</label>
        <Input
          id={`header-${rule.id}-name`}
          maxLength={80}
          onChange={(event) => onChange({ name: event.target.value })}
          required
          value={rule.name}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-match`}>{t('headersMatch')}</label>
          <NativeSelect
            id={`header-${rule.id}-match`}
            onChange={(event) => onChange({ match: event.target.value as HeaderRule['match'] })}
            value={rule.match}
          >
            {(['domain', 'prefix', 'regex'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`headersMatches.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-pattern`}>{t('headersPattern')}</label>
          <Input
            autoComplete="off"
            id={`header-${rule.id}-pattern`}
            maxLength={1500}
            onChange={(event) => onChange({ pattern: event.target.value })}
            placeholder={
              rule.match === 'domain'
                ? 'api.example.com'
                : rule.match === 'prefix'
                  ? 'https://api.example.com/v1/'
                  : '^https://api\\.example\\.com/'
            }
            required
            spellCheck={false}
            value={rule.pattern}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-method`}>{t('headersMethod')}</label>
          <NativeSelect
            id={`header-${rule.id}-method`}
            onChange={(event) => onChange({ method: event.target.value as HeaderRule['method'] })}
            value={rule.method}
          >
            {METHODS.map((value) => (
              <option key={value} value={value}>
                {value === 'any' ? t('headersAny') : value.toUpperCase()}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-resource`}>{t('headersResource')}</label>
          <NativeSelect
            id={`header-${rule.id}-resource`}
            onChange={(event) => onChange({ resource: event.target.value as HeaderRule['resource'] })}
            value={rule.resource}
          >
            {RESOURCES.map((value) => (
              <option key={value} value={value}>
                {t(`headersResources.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-target`}>{t('headersTarget')}</label>
          <NativeSelect
            id={`header-${rule.id}-target`}
            onChange={(event) => onChange({ target: event.target.value as HeaderRule['target'] })}
            value={rule.target}
          >
            <option value="request">{t('headersRequest')}</option>
            <option value="response">{t('headersResponse')}</option>
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-operation`}>{t('headersOperation')}</label>
          <NativeSelect
            id={`header-${rule.id}-operation`}
            onChange={(event) => onChange({ operation: event.target.value as HeaderRule['operation'] })}
            value={rule.operation}
          >
            <option value="set">{t('headersSet')}</option>
            <option value="remove">{t('headersRemove')}</option>
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={`header-${rule.id}-header`}>{t('headersName')}</label>
        <Input
          autoComplete="off"
          id={`header-${rule.id}-header`}
          maxLength={256}
          onChange={(event) => onChange({ header: event.target.value })}
          placeholder="X-Environment"
          required
          spellCheck={false}
          value={rule.header}
        />
      </div>
      {rule.operation === 'set' && (
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-value`}>{t('headersValue')}</label>
          <Input
            autoComplete="off"
            id={`header-${rule.id}-value`}
            maxLength={8192}
            onChange={(event) => onChange({ value: event.target.value })}
            spellCheck={false}
            value={rule.value}
          />
        </div>
      )}
    </fieldset>
  )
}
