import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeDomain, type ProxyConfig, type RuleProfile } from '@browser-proxy/core';
import { errorKey, requestConfig } from './client';

export const RulesSettings = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ProxyConfig>();
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState('auto');
  const group = selected === 'auto' ? config : config?.ruleProfiles?.find(p => p.id === selected);
  const updateGroup = (changes: Partial<RuleProfile>) => {
    if (!config) return;
    setDirty(true);
    setConfig(selected === 'auto' ? { ...config, ...changes } : { ...config, ruleProfiles: config.ruleProfiles?.map(p => p.id === selected ? { ...p, ...changes } : p) });
  };
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const request = async (save = false) => {
    setBusy(true);
    setError('');
    try {
      const value = await requestConfig(save && config && group ? (selected === 'auto'
        ? { type: 'save-rules', revision: config.revision, rules: group.rules, defaultTarget: group.defaultTarget }
        : { type: 'save-rule-profile', revision: config.revision, profile: group }) : undefined);
      setConfig(value); setDirty(false);
      if (selected !== 'auto' && !value.ruleProfiles?.some(p => p.id === selected)) setSelected('auto');
    } catch (error) { setError(errorKey(error)); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    void requestConfig().then(value => {
      if (location.hash.startsWith('#rule=')) {
        try {
          const domain = normalizeDomain(decodeURIComponent(location.hash.slice(6)));
          value.rules.push({ domain, target: 'direct' });
          setDirty(true);
          history.replaceState(null, '', location.pathname);
        } catch { setError('invalid-rule'); }
      }
      setConfig(value);
    }).catch(error => { setError(errorKey(error)); }).finally(() => { setBusy(false); });
  }, []);
  const move = (index: number, direction: number) => {
    if (!group) return;
    const rules = [...group.rules];
    const next = index + direction;
    [rules[index], rules[next]] = [rules[next]!, rules[index]!];
    updateGroup({ rules });
  };
  const input = 'rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm';
  const options = <><option value="direct">{t('direct')}</option>{[{ id: 'auto', name: t('auto') }, ...(config?.profiles ?? []), ...(config?.ruleProfiles ?? [])].filter(p => p.id !== selected).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</>;
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">{t('rulesTitle')}</h2>
    <p className="my-3 text-sm text-zinc-500">{t('rulesHint')}</p>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{t(error)}</p>}
    <button className={`${input} mb-4`} disabled={busy} onClick={() => { void request(); }}>{t('reload')}</button>
    {dirty && <p className="text-sm text-zinc-500">{t('unsavedRules')}</p>}
    {config && <div className="flex flex-wrap gap-2">
      <label className="text-sm">{t('ruleProfile')}<select className={input} value={selected} disabled={busy || dirty} onChange={event => { setSelected(event.target.value); }}>
        <option value="auto">{t('auto')}</option>{config.ruleProfiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
      <button className={input} disabled={busy || dirty} onClick={() => {
        const id = crypto.randomUUID();
        setBusy(true); setError('');
        void requestConfig({ type: 'save-rule-profile', revision: config.revision, profile: { id, name: t('newRuleProfile'), rules: [], defaultTarget: 'direct' } })
          .then(value => { setConfig(value); setSelected(id); }).catch(error => { setError(errorKey(error)); }).finally(() => { setBusy(false); });
      }}>{t('newRuleProfile')}</button>
      {selected !== 'auto' && <button className={input} disabled={busy || dirty} onClick={() => {
        setBusy(true); setError('');
        void requestConfig({ type: 'delete-rule-profile', id: selected, revision: config.revision })
          .then(value => { setConfig(value); setSelected('auto'); }).catch(error => { setError(errorKey(error)); }).finally(() => { setBusy(false); });
      }}>{t('remove')}</button>}
    </div>}
    {config && group && <form onSubmit={event => { event.preventDefault(); void request(true); }}>
      <fieldset disabled={busy} className="space-y-4">
        {selected !== 'auto' && <label className="block text-sm">{t('name')}<input required maxLength={80} className={input} value={'name' in group ? group.name : ''} onChange={event => { updateGroup({ name: event.target.value }); }} /></label>}
        <label className="flex items-center gap-3 text-sm">{t('defaultTarget')}
          <select className={input} value={group.defaultTarget} onChange={event => { updateGroup({ defaultTarget: event.target.value }); }}>{options}</select></label>
        {group.rules.map((rule, index) => <div key={index} className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 p-3">
          <input className={`${input} min-w-0 flex-1`} required aria-label={`${t('domain')} ${index + 1}`} placeholder="example.com" value={rule.domain}
            onChange={event => { updateGroup({ rules: group.rules.map((r, i) => i === index ? { ...r, domain: event.target.value } : r) }); }} />
          <select className={input} aria-label={`${t('target')} ${index + 1}`} value={rule.target}
            onChange={event => { updateGroup({ rules: group.rules.map((r, i) => i === index ? { ...r, target: event.target.value } : r) }); }}>{options}</select>
          <button type="button" className={input} disabled={index === 0} aria-label={`${t('moveUp')} ${index + 1}`} onClick={() => { move(index, -1); }}>{t('moveUp')}</button>
          <button type="button" className={input} disabled={index === group.rules.length - 1} aria-label={`${t('moveDown')} ${index + 1}`} onClick={() => { move(index, 1); }}>{t('moveDown')}</button>
          <button type="button" className={input} onClick={() => { updateGroup({ rules: group.rules.filter((_, i) => i !== index) }); }}>{t('remove')}</button>
        </div>)}
        <div className="flex gap-3"><button type="button" className={input} onClick={() => { updateGroup({ rules: [...group.rules, { domain: '', target: 'direct' }] }); }}>{t('addRule')}</button>
          <button type="submit" className={`${input} bg-zinc-900 text-white`}>{t('saveRules')}</button></div>
      </fieldset>
    </form>}
  </section>;
};
