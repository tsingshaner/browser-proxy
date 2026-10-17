import { normalizeDomain, type ProxyConfig, type RuleProfile } from '@browser-proxy/core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { errorKey, requestConfig } from './client'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { NativeSelect } from './components/ui/native-select'

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
            {p.name}
          </option>
        ))}
    </>
  )
  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-xl">{t('rulesTitle')}</h2>
      <p className="my-3 text-muted-foreground text-sm">{t('rulesHint')}</p>
      {error && (
        <p className="my-3 text-destructive text-sm" role="alert">
          {t(error)}
        </p>
      )}
      <Button
        className="mb-4"
        disabled={busy}
        onClick={() => {
          void request()
        }}
        type="button"
        variant="outline"
      >
        {t('reload')}
      </Button>
      {dirty && <p className="text-muted-foreground text-sm">{t('unsavedRules')}</p>}
      {config && (
        <div className="flex flex-wrap gap-2">
          <label className="text-sm" htmlFor="rule-profile">
            {t('ruleProfile')}
            <NativeSelect
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
            {t('newRuleProfile')}
          </Button>
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
          <fieldset className="min-w-0 space-y-4" disabled={busy}>
            {selected !== 'auto' && (
              <label className="block text-sm" htmlFor="rule-name">
                {t('name')}
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
            <label className="flex flex-wrap items-center gap-3 text-sm" htmlFor="rule-default">
              {t('defaultTarget')}
              <NativeSelect
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
              <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3" key={index}>
                <Input
                  aria-label={`${t('domain')} ${index + 1}`}
                  className="min-w-40 flex-1"
                  onChange={(event) => {
                    updateGroup({
                      rules: group.rules.map((r, i) => (i === index ? { ...r, domain: event.target.value } : r))
                    })
                  }}
                  placeholder="example.com"
                  required
                  value={rule.domain}
                />
                <NativeSelect
                  aria-label={`${t('target')} ${index + 1}`}
                  onChange={(event) => {
                    updateGroup({
                      rules: group.rules.map((r, i) => (i === index ? { ...r, target: event.target.value } : r))
                    })
                  }}
                  value={rule.target}
                >
                  {options}
                </NativeSelect>
                <Button
                  aria-label={`${t('moveUp')} ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => {
                    move(index, -1)
                  }}
                  type="button"
                  variant="outline"
                >
                  {t('moveUp')}
                </Button>
                <Button
                  aria-label={`${t('moveDown')} ${index + 1}`}
                  disabled={index === group.rules.length - 1}
                  onClick={() => {
                    move(index, 1)
                  }}
                  type="button"
                  variant="outline"
                >
                  {t('moveDown')}
                </Button>
                <Button
                  onClick={() => {
                    updateGroup({ rules: group.rules.filter((_, i) => i !== index) })
                  }}
                  type="button"
                  variant="outline"
                >
                  {t('remove')}
                </Button>
              </div>
            ))}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  updateGroup({ rules: [...group.rules, { domain: '', target: 'direct' }] })
                }}
                type="button"
                variant="outline"
              >
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
