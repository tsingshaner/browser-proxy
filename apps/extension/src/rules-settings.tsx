import { normalizeDomain, type ProxyConfig, type RuleProfile } from '@browser-proxy/core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const input = 'rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm'
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
      <p className="my-3 text-sm text-zinc-500">{t('rulesHint')}</p>
      {error && (
        <p className="my-3 text-red-700 text-sm" role="alert">
          {t(error)}
        </p>
      )}
      <button
        className={`${input} mb-4`}
        disabled={busy}
        onClick={() => {
          void request()
        }}
        type="button"
      >
        {t('reload')}
      </button>
      {dirty && <p className="text-sm text-zinc-500">{t('unsavedRules')}</p>}
      {config && (
        <div className="flex flex-wrap gap-2">
          <label className="text-sm">
            {t('ruleProfile')}
            <select
              className={input}
              disabled={busy || dirty}
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
            </select>
          </label>
          <button
            className={input}
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
          >
            {t('newRuleProfile')}
          </button>
          {selected !== 'auto' && (
            <button
              className={input}
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
            >
              {t('remove')}
            </button>
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
          <fieldset className="space-y-4" disabled={busy}>
            {selected !== 'auto' && (
              <label className="block text-sm">
                {t('name')}
                <input
                  className={input}
                  maxLength={80}
                  onChange={(event) => {
                    updateGroup({ name: event.target.value })
                  }}
                  required
                  value={'name' in group ? group.name : ''}
                />
              </label>
            )}
            <label className="flex items-center gap-3 text-sm">
              {t('defaultTarget')}
              <select
                className={input}
                onChange={(event) => {
                  updateGroup({ defaultTarget: event.target.value })
                }}
                value={group.defaultTarget}
              >
                {options}
              </select>
            </label>
            {group.rules.map((rule, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Rows are fully controlled; editing a domain must not remount its input.
              <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 p-3" key={index}>
                <input
                  aria-label={`${t('domain')} ${index + 1}`}
                  className={`${input} min-w-0 flex-1`}
                  onChange={(event) => {
                    updateGroup({
                      rules: group.rules.map((r, i) => (i === index ? { ...r, domain: event.target.value } : r))
                    })
                  }}
                  placeholder="example.com"
                  required
                  value={rule.domain}
                />
                <select
                  aria-label={`${t('target')} ${index + 1}`}
                  className={input}
                  onChange={(event) => {
                    updateGroup({
                      rules: group.rules.map((r, i) => (i === index ? { ...r, target: event.target.value } : r))
                    })
                  }}
                  value={rule.target}
                >
                  {options}
                </select>
                <button
                  aria-label={`${t('moveUp')} ${index + 1}`}
                  className={input}
                  disabled={index === 0}
                  onClick={() => {
                    move(index, -1)
                  }}
                  type="button"
                >
                  {t('moveUp')}
                </button>
                <button
                  aria-label={`${t('moveDown')} ${index + 1}`}
                  className={input}
                  disabled={index === group.rules.length - 1}
                  onClick={() => {
                    move(index, 1)
                  }}
                  type="button"
                >
                  {t('moveDown')}
                </button>
                <button
                  className={input}
                  onClick={() => {
                    updateGroup({ rules: group.rules.filter((_, i) => i !== index) })
                  }}
                  type="button"
                >
                  {t('remove')}
                </button>
              </div>
            ))}
            <div className="flex gap-3">
              <button
                className={input}
                onClick={() => {
                  updateGroup({ rules: [...group.rules, { domain: '', target: 'direct' }] })
                }}
                type="button"
              >
                {t('addRule')}
              </button>
              <button className={`${input} bg-zinc-900 text-white`} type="submit">
                {t('saveRules')}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  )
}
