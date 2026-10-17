import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './browser-api';
import type { RequestSummary } from './request-monitor';

export const RequestStatus = () => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<RequestSummary>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        if (tab?.id === undefined) return;
        const response = await api.runtime.sendMessage({ type: 'get-requests', tabId: tab.id });
        if (!response?.ok) throw new Error();
        if (!disposed) { setSummary(response.summary); setFailed(false); }
      } catch { if (!disposed) setFailed(true); }
    };
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 1000);
    return () => { disposed = true; clearInterval(timer); };
  }, []);
  return <section className="mb-4 rounded-lg border border-zinc-200 p-3 text-xs">
    <h2 className="font-medium">{t('requests')}</h2>
    <p className="mt-1 text-zinc-500">{t('requestsHint')}</p>
    {failed && <p role="alert">{t('monitorError')}</p>}
    {summary && <>
      <dl className="my-2 grid grid-cols-2 gap-2">{(['pending', 'completed', 'failed', 'timeout'] as const).map(key => <div key={key}><dt>{t(key)}</dt><dd>{summary[key]}</dd></div>)}</dl>
      <ul className="max-h-40 space-y-2 overflow-auto">{summary.domains.map(domain => <li key={domain}>
        <button className="break-all text-left underline" onClick={() => { void api.tabs.create({ url: api.runtime.getURL(`options.html#rule=${encodeURIComponent(domain)}`) }); }}>{t('ruleForDomain', { domain })}</button>
      </li>)}</ul>
    </>}
  </section>;
};
