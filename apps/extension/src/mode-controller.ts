export type ProxyMode = 'direct' | 'system';

export function createModeController(io: {
  read(): Promise<unknown>;
  write(mode: ProxyMode): Promise<void>;
  apply(mode: ProxyMode): Promise<void>;
}) {
  let mode: ProxyMode = 'system';
  let initialized = false;
  async function restore() {
    if (initialized) return;
    const saved = await io.read();
    if (saved !== undefined && saved !== 'direct' && saved !== 'system') {
      throw new Error('invalid-config');
    }
    mode = saved ?? 'system';
    await io.apply(mode);
    initialized = true;
  }
  const ready = restore();
  let pending = ready.catch(() => undefined);

  function handle(message: unknown): Promise<{ mode: ProxyMode }> {
    const operation = pending.then(async () => {
      await restore();
      if (!message || typeof message !== 'object' || !('type' in message)) {
        throw new Error('invalid-request');
      }
      if (message.type === 'get-mode') return { mode };
      if (message.type !== 'set-mode' || !('mode' in message) ||
          (message.mode !== 'direct' && message.mode !== 'system')) {
        throw new Error('invalid-request');
      }
      const next = message.mode;
      await io.apply(next);
      try {
        await io.write(next);
      } catch {
        await io.apply(mode);
        throw new Error('save-failed');
      }
      mode = next;
      return { mode };
    });
    pending = operation.then(() => undefined, () => undefined);
    return operation;
  }

  return { ready, handle };
}
