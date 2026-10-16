import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { translationsReady } from './i18n';
import type { ProxyConfig } from '@browser-proxy/core';
import { requestConfig, errorKey } from './client';
import './style.css';

const ModeSwitcher = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ProxyConfig>();
  const mode = config?.mode;
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const request = async (next?: string) => {
    setBusy(true);
    setError('');
    try {
      setConfig(await requestConfig(next
        ? { type: 'set-mode', mode: next, revision: config?.revision } : undefined));
    } catch (error) {
      setError(errorKey(error));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { void request(); }, []);

  return <>
    <fieldset disabled={busy} className="space-y-3">
      <legend className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">{t('mode')}</legend>
      {['direct', 'system', ...(config?.profiles.map(p => p.id) ?? [])].map((value) => <label key={value}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-zinc-500 ${mode === value ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:bg-zinc-50'} ${busy ? 'opacity-60' : ''}`}>
        <input type="radio" name="mode" value={value} checked={mode === value}
          onChange={() => { void request(value); }} className="size-4 accent-zinc-900" />
        <span><span className="block text-sm font-medium">{config?.profiles.find(p => p.id === value)?.name ?? t(value)}</span>
          <span className="mt-1 block text-xs text-zinc-500">{config?.profiles.find(p => p.id === value)?.host ?? t(`${value}Hint`)}</span></span>
      </label>)}
    </fieldset>
    <div className="mt-4 min-h-10 text-xs" aria-live="polite">
      {error ? <div role="alert" className="text-red-700">
        <p>{t(error)}</p>
        <button onClick={() => { void request(); }} className="mt-2 rounded-md border border-red-200 px-3 py-1.5 font-medium focus-visible:outline-2">{t('retry')}</button>
      </div> : <p className="text-zinc-500">{t(busy ? (mode ? 'saving' : 'loading') : 'saved')}</p>}
    </div>
  </>;
};

const Popup = () => {
  const { t } = useTranslation();
  return <main className="w-80 bg-white p-5 text-zinc-950">
    <header className="mb-6"><h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p></header>
    <ModeSwitcher />
    <button className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50" onClick={() => { void chrome.runtime.openOptionsPage(); }}>{t('manage')}</button>
    <footer className="mt-2 border-t border-zinc-100 pt-4 text-[11px] text-zinc-400">{t('footer')}</footer>
  </main>;
};

void translationsReady.then(() => {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  createRoot(document.getElementById('root')!).render(<Popup />);
});
