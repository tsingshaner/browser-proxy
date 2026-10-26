import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { type HeaderRule, METHODS, RESOURCES } from './config'

type Props = {
  busy: boolean
  rule: HeaderRule
  index: number
  count: number
  onChange(update: Partial<HeaderRule>): void
  onRemove(): void
  onMove(direction: -1 | 1): void
}

export const HeaderRuleEditor = ({ busy, rule, index, count, onChange, onRemove, onMove }: Props) => {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1">{t('rulePosition', { number: index + 1 })}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2" htmlFor={`header-${rule.id}-enabled`}>
          <Checkbox
            checked={rule.enabled}
            disabled={busy}
            id={`header-${rule.id}-enabled`}
            onCheckedChange={(checked) => onChange({ enabled: checked })}
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
          <Select
            disabled={busy}
            items={Object.fromEntries(
              (['domain', 'prefix', 'regex'] as const).map((value) => [value, t(`headersMatches.${value}`)])
            )}
            onValueChange={(value) => {
              if (value !== null) {
                onChange({ match: value as HeaderRule['match'] })
              }
            }}
            value={rule.match}
          >
            <SelectTrigger id={`header-${rule.id}-match`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['domain', 'prefix', 'regex'] as const).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`headersMatches.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            disabled={busy}
            items={Object.fromEntries(
              METHODS.map((value) => [value, value === 'any' ? t('headersAny') : value.toUpperCase()])
            )}
            onValueChange={(value) => {
              if (value !== null) {
                onChange({ method: value as HeaderRule['method'] })
              }
            }}
            value={rule.method}
          >
            <SelectTrigger id={`header-${rule.id}-method`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value === 'any' ? t('headersAny') : value.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-resource`}>{t('headersResource')}</label>
          <Select
            disabled={busy}
            items={Object.fromEntries(RESOURCES.map((value) => [value, t(`headersResources.${value}`)]))}
            onValueChange={(value) => {
              if (value !== null) {
                onChange({ resource: value as HeaderRule['resource'] })
              }
            }}
            value={rule.resource}
          >
            <SelectTrigger id={`header-${rule.id}-resource`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOURCES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`headersResources.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-target`}>{t('headersTarget')}</label>
          <Select
            disabled={busy}
            items={{ request: t('headersRequest'), response: t('headersResponse') }}
            onValueChange={(value) => {
              if (value !== null) {
                onChange({ target: value as HeaderRule['target'] })
              }
            }}
            value={rule.target}
          >
            <SelectTrigger id={`header-${rule.id}-target`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="request">{t('headersRequest')}</SelectItem>
              <SelectItem value="response">{t('headersResponse')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`header-${rule.id}-operation`}>{t('headersOperation')}</label>
          <Select
            disabled={busy}
            items={{ remove: t('headersRemove'), set: t('headersSet') }}
            onValueChange={(value) => {
              if (value !== null) {
                onChange({ operation: value as HeaderRule['operation'] })
              }
            }}
            value={rule.operation}
          >
            <SelectTrigger id={`header-${rule.id}-operation`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set">{t('headersSet')}</SelectItem>
              <SelectItem value="remove">{t('headersRemove')}</SelectItem>
            </SelectContent>
          </Select>
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
