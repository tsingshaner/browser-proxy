import { normalizeDomain, type ProxyConfig, type RuleProfile } from '@browser-tookits/core'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { NativeSelect } from '../../components/ui/native-select'
import { errorKey, requestConfig } from './client'

export const RulesSettings = () => {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ProxyConfig>()
  const [dirty, setDirty] = useState(false)
  const [selected, setSelected] = useState('auto')
  const group = selected === 'auto' ? config : config?.ruleProfiles?.find((p) => p.id === selected)
  const updateGroup = (changes: Partial<RuleProfile>) => {
    if (!config) {
      return
    }
    setDirty(true)
    setConfig(
      selected === 'auto'
        ? { ...config, ...changes }
        : { ...config, ruleProfiles: config.ruleProfiles?.map((p) => (p.id === selected ? { ...p, ...changes } : p)) }
    )
  }
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const request = async (save = false) => {
    setBusy(true)
    setError('')
    try {
      const value = await requestConfig(
        save && config && group
          ? selected === 'auto'
            ? { defaultTarget: group.defaultTarget, revision: config.revision, rules: group.rules, type: 'save-rules' }
            : { profile: group, revision: config.revision, type: 'save-rule-profile' }
          : undefined
      )
      setConfig(value)
      setDirty(false)
      if (selected !== 'auto' && !value.ruleProfiles?.some((p) => p.id === selected)) {
        setSelected('auto')
      }
    } catch (error) {
      setError(errorKey(error))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    void requestConfig()
      .then((value) => {
        if (location.hash.startsWith('#rule=')) {
          try {
            const domain = normalizeDomain(decodeURIComponent(location.hash.slice(6)))
            value.rules.push({ domain, target: 'direct' })
            setDirty(true)
            history.replaceState(null, '', location.pathname)
          } catch {
            setError('invalid-rule')
          }
        }
        setConfig(value)
      })
      .catch((error) => {
        setError(errorKey(error))
      })
      .finally(() => {
        setBusy(false)
      })
  }, [])
  const move = (index: number, direction: number) => {
    if (!group) {
      return
    }
    const rules = [...group.rules]
    const next = index + direction
    const current = rules[index]
    const adjacent = rules[next]
    if (!(current && adjacent)) {
      return
    }
    ;[rules[index], rules[next]] = [adjacent, current]
    updateGroup({ rules })
  }
  const options = (
    <>
      <option value="direct">{t('direct')}</option>
      {[{ id: 'auto', name: t('auto') }, ...(config?.profiles ?? []), ...(config?.ruleProfiles ?? [])]
        .filter((p) => p.id !== selected)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {config?.profiles.some((proxy) => proxy.id === p.id) ? p.name : t('ruleGroupOption', { name: p.name })}
          </option>
        ))}
    </>
  )
  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-xl tracking-tight">{t('rulesTitle')}</h2>
        <Button
          aria-label={t('reload')}
          disabled={busy}
          onClick={() => {
            void request()
          }}
          size="icon"
          title={t('reload')}
          type="button"
          variant="ghost"
        >
          <RefreshCwIcon aria-hidden="true" />
        </Button>
      </header>
      <p className="text-muted-foreground text-sm leading-relaxed">{t('ruleGroupHint')}</p>
      <details className="rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground text-xs">
        <summary className="cursor-pointer font-medium">{t('rulesGuide')}</summary>
        <p className="pt-2 leading-relaxed">{t('rulesHint')}</p>
      </details>
      {error && (
        <p className="my-3 text-destructive text-sm" role="alert">
          {t(error)}
        </p>
      )}
      {dirty && <p className="text-muted-foreground text-sm">{t('unsavedRules')}</p>}
      {config && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/20 p-4">
          <label
            className="grid min-w-0 basis-full gap-2 font-medium text-sm sm:flex-1 sm:basis-auto"
            htmlFor="rule-profile"
          >
            {t('ruleProfile')}
            <NativeSelect
              className="w-full"
              disabled={busy || dirty}
              id="rule-profile"
              onChange={(event) => {
                setSelected(event.target.value)
              }}
              value={selected}
            >
              <option value="auto">{t('auto')}</option>
              {config.ruleProfiles?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Button
            disabled={busy || dirty}
            onClick={() => {
              const id = crypto.randomUUID()
              setBusy(true)
              setError('')
              void requestConfig({
                profile: { defaultTarget: 'direct', id, name: t('newRuleProfile'), rules: [] },
                revision: config.revision,
                type: 'save-rule-profile'
              })
                .then((value) => {
                  setConfig(value)
                  setSelected(id)
                })
                .catch((error) => {
                  setError(errorKey(error))
                })
                .finally(() => {
                  setBusy(false)
                })
            }}
            type="button"
            variant="outline"
          >
            <PlusIcon aria-hidden="true" />
            {t('newRuleProfileAction')}
          </Button>
          <p className="basis-full text-muted-foreground text-xs leading-relaxed">{t('ruleGroupEditingHint')}</p>
          {selected !== 'auto' && (
            <Button
              disabled={busy || dirty}
              onClick={() => {
                setBusy(true)
                setError('')
                void requestConfig({ id: selected, revision: config.revision, type: 'delete-rule-profile' })
                  .then((value) => {
                    setConfig(value)
                    setSelected('auto')
                  })
                  .catch((error) => {
                    setError(errorKey(error))
                  })
                  .finally(() => {
                    setBusy(false)
                  })
              }}
              type="button"
              variant="outline"
            >
              {t('remove')}
            </Button>
          )}
        </div>
      )}
      {config && group && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void request(true)
          }}
        >
          <fieldset className="min-w-0 space-y-5" disabled={busy}>
            {selected !== 'auto' && (
              <label className="grid gap-2 font-medium text-sm" htmlFor="rule-name">
                {t('ruleGroupName')}
                <Input
                  id="rule-name"
                  maxLength={80}
                  onChange={(event) => {
                    updateGroup({ name: event.target.value })
                  }}
                  required
                  value={'name' in group ? group.name : ''}
                />
              </label>
            )}
            <label className="grid gap-2 font-medium text-sm" htmlFor="rule-default">
              {t('defaultTarget')}
              <NativeSelect
                className="w-full"
                id="rule-default"
                onChange={(event) => {
                  updateGroup({ defaultTarget: event.target.value })
                }}
                value={group.defaultTarget}
              >
                {options}
              </NativeSelect>
            </label>
            {group.rules.map((rule, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Rows are fully controlled; editing a domain must not remount its input.
              <div className="space-y-3 rounded-xl border border-border p-3 sm:p-4" key={index}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground text-xs">
                    {t('rulePosition', { number: index + 1 })}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label={`${t('moveUp')} ${index + 1}`}
                      disabled={index === 0}
                      onClick={() => {
                        move(index, -1)
                      }}
                      size="icon-sm"
                      title={t('moveUp')}
                      type="button"
                      variant="ghost"
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`${t('moveDown')} ${index + 1}`}
                      disabled={index === group.rules.length - 1}
                      onClick={() => {
                        move(index, 1)
                      }}
                      size="icon-sm"
                      title={t('moveDown')}
                      type="button"
                      variant="ghost"
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`${t('remove')} ${index + 1}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        updateGroup({ rules: group.rules.filter((_, i) => i !== index) })
                      }}
                      size="icon-sm"
                      title={t('remove')}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <label
                    className="grid min-w-0 gap-1.5 text-muted-foreground text-xs"
                    htmlFor={`rule-domain-${index}`}
                  >
                    {t('domain')}
                    <Input
                      aria-label={`${t('domain')} ${index + 1}`}
                      className="min-w-0 text-foreground"
                      id={`rule-domain-${index}`}
                      onChange={(event) => {
                        updateGroup({
                          rules: group.rules.map((r, i) => (i === index ? { ...r, domain: event.target.value } : r))
                        })
                      }}
                      placeholder="example.com"
                      required
                      value={rule.domain}
                    />
                  </label>
                  <label
                    className="grid min-w-0 gap-1.5 text-muted-foreground text-xs"
                    htmlFor={`rule-target-${index}`}
                  >
                    {t('target')}
                    <NativeSelect
                      aria-label={`${t('target')} ${index + 1}`}
                      className="w-full text-foreground"
                      id={`rule-target-${index}`}
                      onChange={(event) => {
                        updateGroup({
                          rules: group.rules.map((r, i) => (i === index ? { ...r, target: event.target.value } : r))
                        })
                      }}
                      value={rule.target}
                    >
                      {options}
                    </NativeSelect>
                  </label>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-border border-t pt-4">
              <Button
                onClick={() => {
                  updateGroup({ rules: [...group.rules, { domain: '', target: 'direct' }] })
                }}
                type="button"
                variant="outline"
              >
                <PlusIcon aria-hidden="true" />
                {t('addRule')}
              </Button>
              <Button type="submit">{t('saveRules')}</Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}
