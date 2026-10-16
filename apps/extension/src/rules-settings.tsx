import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProxyConfig } from '@browser-proxy/core';
import { errorKey, requestConfig } from './client';

export const RulesSettings = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ProxyConfig>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const request = async (save = false) => {
    setBusy(true);
    setError('');
    try {
      setConfig(await requestConfig(save && config ? { type: 'save-rules', revision: config.revision,
        rules: config.rules, defaultTarget: config.defaultTarget } : undefined));
    } catch (error) { setError(errorKey(error)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void request(); }, []);
  const move = (index: number, direction: number) => {
    if (!config) return;
    const rules = [...config.rules];
    const next = index + direction;
    [rules[index], rules[next]] = [rules[next]!, rules[index]!];
    setConfig({ ...config, rules });
  };
  const input = 'rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm';
  const options = <><option value="direct">{t('direct')}</option>{config?.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</>;
  return <section className="space-y-4">
    <h2 className="text-xl font-semibold">{t('rulesTitle')}</h2>
    <p className="my-3 text-sm text-zinc-500">{t('rulesHint')}</p>
    {error && <p role="alert" className="my-3 text-sm text-red-700">{t(error)}</p>}
    <button className={`${input} mb-4`} disabled={busy} onClick={() => { void request(); }}>{t('reload')}</button>
    {config && <form onSubmit={event => { event.preventDefault(); void request(true); }}>
      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-center gap-3 text-sm">{t('defaultTarget')}
          <select className={input} value={config.defaultTarget} onChange={event => { setConfig({ ...config, defaultTarget: event.target.value }); }}>{options}</select></label>
        {config.rules.map((rule, index) => <div key={index} className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 p-3">
          <input className={`${input} min-w-0 flex-1`} required aria-label={`${t('domain')} ${index + 1}`} placeholder="example.com" value={rule.domain}
            onChange={event => { setConfig({ ...config, rules: config.rules.map((r, i) => i === index ? { ...r, domain: event.target.value } : r) }); }} />
          <select className={input} aria-label={`${t('target')} ${index + 1}`} value={rule.target}
            onChange={event => { setConfig({ ...config, rules: config.rules.map((r, i) => i === index ? { ...r, target: event.target.value } : r) }); }}>{options}</select>
          <button type="button" className={input} disabled={index === 0} aria-label={`${t('moveUp')} ${index + 1}`} onClick={() => { move(index, -1); }}>{t('moveUp')}</button>
          <button type="button" className={input} disabled={index === config.rules.length - 1} aria-label={`${t('moveDown')} ${index + 1}`} onClick={() => { move(index, 1); }}>{t('moveDown')}</button>
          <button type="button" className={input} onClick={() => { setConfig({ ...config, rules: config.rules.filter((_, i) => i !== index) }); }}>{t('remove')}</button>
        </div>)}
        <div className="flex gap-3"><button type="button" className={input} onClick={() => { setConfig({ ...config, rules: [...config.rules, { domain: '', target: 'direct' }] }); }}>{t('addRule')}</button>
          <button type="submit" className={`${input} bg-zinc-900 text-white`}>{t('saveRules')}</button></div>
      </fieldset>
    </form>}
  </section>;
};
