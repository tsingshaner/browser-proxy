import type { LogRecord, Sink } from '@logtape/logtape';

export interface StoredLog { timestamp: number; level: string; message: string }
const messages = new Set([
  'Background initialized.', 'Proxy configuration applied.',
  'Could not restore proxy mode.', 'Could not complete proxy mode request.',
  'Proxy authentication failed. Check the saved credentials.', 'Diagnostic details omitted.',
]);

// Only fixed diagnostic messages cross the persistence boundary; interpolation and properties never do.
export function safeLog(record: Pick<LogRecord, 'timestamp' | 'level' | 'rawMessage'> & Partial<LogRecord>): StoredLog {
  return { timestamp: record.timestamp, level: record.level,
    message: typeof record.rawMessage === 'string' && messages.has(record.rawMessage) ? record.rawMessage : 'Diagnostic details omitted.' };
}

export function pruneLogs(entries: StoredLog[], now = Date.now()): StoredLog[] {
  const recent = entries.filter(e => Number.isFinite(e.timestamp) && e.timestamp >= now - 30 * 86400_000 && e.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp).slice(-5000);
  const encoder = new TextEncoder();
  let bytes = 2;
  let start = recent.length;
  for (let i = recent.length - 1; i >= 0; i--) {
    const size = encoder.encode(JSON.stringify(recent[i])).byteLength + (start < recent.length ? 1 : 0);
    if (bytes + size > 5 * 1024 * 1024) break;
    bytes += size; start = i;
  }
  return recent.slice(start);
}

export function createPersistentLogs(factory: IDBFactory = indexedDB) {
  let database: Promise<IDBDatabase> | undefined;
  const open = () => database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('browser-proxy-diagnostics', 1);
    let rejected = false;
    request.onupgradeneeded = () => { request.result.createObjectStore('logs'); };
    request.onerror = () => { rejected = true; database = undefined; reject(request.error); };
    request.onblocked = () => { rejected = true; database = undefined; reject(new Error('logs-unavailable')); };
    request.onsuccess = () => {
      const db = request.result;
      if (rejected) { db.close(); return; }
      db.onclose = () => { database = undefined; };
      db.onversionchange = () => { db.close(); database = undefined; };
      resolve(db);
    };
  }).catch(error => { database = undefined; throw error; });
  const change = async (entry?: StoredLog, clear = false): Promise<StoredLog[]> => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('logs', 'readwrite');
      const store = tx.objectStore('logs');
      const request = store.get('entries');
      let result: StoredLog[] = [];
      tx.onabort = tx.onerror = () => { reject(tx.error ?? new Error('logs-unavailable')); };
      tx.oncomplete = () => { resolve(result); };
      request.onsuccess = () => {
        try {
          const raw: unknown = request.result;
          const existing = Array.isArray(raw) ? raw.filter((e): e is StoredLog => !!e && typeof e === 'object' &&
            typeof e.timestamp === 'number' && typeof e.level === 'string' && typeof e.message === 'string')
            .map(e => ({ timestamp: e.timestamp, level: ['trace', 'debug', 'info', 'warning', 'error', 'fatal'].includes(e.level) ? e.level : 'info',
              message: messages.has(e.message) ? e.message : 'Diagnostic details omitted.' })) : [];
          result = clear ? [] : pruneLogs([...existing, ...(entry ? [entry] : [])]);
          store.put(result, 'entries');
        } catch { tx.abort(); }
      };
    });
  };
  let pending = Promise.resolve();
  let failed = false;
  const sink: Sink = record => {
    const entry = safeLog(record);
    pending = pending.then(async () => {
      try { await change(entry); failed = false; } catch { failed = true; }
    });
  };
  return {
    sink,
    async read() { await pending; const entries = await change(); failed = false; return { entries, failed }; },
    async clear() { await pending; await change(undefined, true); failed = false; },
  };
}
