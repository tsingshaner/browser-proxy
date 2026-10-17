import { api } from './browser-api';
import { useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import type { ProxyConfig, ProxyProfile } from '@browser-proxy/core';
import { BackupSettings } from './backup-settings';
import { RulesSettings } from './rules-settings';
import { translationsReady } from './i18n';
import { requestConfig, errorKey } from './client';
import './style.css';

const button = 'rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50';
const input = 'mt-2 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-zinc-500';

const ProxySettings = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ProxyConfig>();
  const [editing, setEditing] = useState<ProxyProfile | null>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const request = async (message?: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      setConfig(await requestConfig(message));
      setEditing(undefined);
    } catch (error) { setError(errorKey(error)); }
    finally { setBusy(false); }
  };
  useEffect(() => { void request(); }, []);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void request({ type: 'save-profile', revision: config?.revision, profile: {
      id: editing?.id ?? crypto.randomUUID(), name: data.get('name'),
      host: data.get('host'), scheme: data.get('scheme'), port: Number(data.get('port')),
      ...(data.get('username') ? { auth: { username: data.get('username'), password: data.get('password') } } : {}),
    } });
  };

  return <section>
    <header className="mb-8"><p className="text-sm text-zinc-500">Browser Proxy</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('profiles')}</h1></header>
    <div aria-live="polite" className="mb-5 text-sm">
      {error ? <div role="alert" className="rounded-lg border border-red-200 p-4 text-red-700">
        <p>{t(error)}</p><button className={`${button} mt-3`} disabled={busy} onClick={() => { void request(); }}>{t('retry')}</button>
      </div> : busy ? <p>{t('loading')}</p> : null}
    </div>
    {editing !== undefined ? <form key={editing?.id ?? 'new'} onSubmit={save} className="rounded-xl border border-zinc-200 p-6">
      <fieldset disabled={busy} className="space-y-5">
        <legend className="mb-4 font-medium">{t(editing ? 'edit' : 'add')}</legend>
        <label className="block text-sm font-medium">{t('name')}<input className={input} name="name" required maxLength={80} defaultValue={editing?.name} /></label>
        <label className="block text-sm font-medium">{t('scheme')}<select className={input} name="scheme" defaultValue={editing?.scheme ?? 'http'}>
          {['http', 'https', 'socks4', 'socks5'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select></label>
        <label className="block text-sm font-medium">{t('host')}<input className={input} name="host" required placeholder="proxy.example.com" defaultValue={editing?.host} /></label>
        <label className="block text-sm font-medium">{t('port')}<input className={input} name="port" type="number" required min={1} max={65535} step={1} defaultValue={editing?.port ?? 8080} /></label>
        <p className="text-xs text-zinc-500">{t('authHint')}</p>
        <label className="block text-sm font-medium">{t('username')}<input className={input} name="username" autoComplete="off" defaultValue={editing?.auth?.username} /></label>
        <label className="block text-sm font-medium">{t('password')}<input className={input} name="password" type="password" autoComplete="new-password" defaultValue={editing?.auth?.password} /></label>
        <div className="flex gap-3"><button className={`${button} bg-zinc-900 text-white hover:bg-zinc-800`} type="submit">{t('save')}</button>
          <button className={button} type="button" onClick={() => { setEditing(undefined); }}>{t('cancel')}</button></div>
      </fieldset>
    </form> : <>
      <button className={`${button} mb-5`} disabled={busy || !config} onClick={() => { setEditing(null); }}>{t('add')}</button>
      <ul className="space-y-3">{config?.profiles.map(profile => <li key={profile.id} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 p-5">
        <div className="min-w-0"><h2 className="truncate font-medium">{profile.name}</h2><p className="mt-1 break-all text-sm text-zinc-500">{profile.scheme.toUpperCase()} · {profile.host}:{profile.port}</p></div>
        <div className="flex shrink-0 gap-2"><button className={button} disabled={busy} onClick={() => { setEditing(profile); }}>{t('edit')}</button>
          <button className={button} disabled={busy} onClick={() => { void request({ type: 'delete-profile', id: profile.id, revision: config.revision }); }}>{t('remove')}</button></div>
      </li>)}</ul>
      {config && !config.profiles.length && <p className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">{t('empty')}</p>}
    </>}
  </section>;
};
const Options = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(location.hash.startsWith('#rule=') ? 'rulesTitle' : 'profiles');
  return <main className="mx-auto max-w-2xl px-6 py-12 text-zinc-950">
    <nav className="mb-8 flex gap-3">{['profiles', 'rulesTitle', 'backup'].map(value => <button key={value} className={button}
      aria-pressed={page === value} onClick={() => { setPage(value); }}>{t(value)}</button>)}</nav>
    {page === 'profiles' ? <ProxySettings /> : page === 'rulesTitle' ? <RulesSettings /> : <BackupSettings />}
  </main>;
};
void translationsReady.then(() => {
  document.documentElement.lang = api.i18n.getUILanguage();
  createRoot(document.getElementById('root')!).render(<Options />);
});
