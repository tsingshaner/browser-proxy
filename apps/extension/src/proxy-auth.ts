import { resolveTarget, type ProxyConfig } from '@browser-proxy/core';

type Challenge = { url?: string; requestId: string; isProxy: boolean; challenger: { host: string; port: number } };

export function createProxyAuth(read: () => Promise<ProxyConfig>, feedback: (failed: boolean) => Promise<void>) {
  const attempted = new Map<string, Map<string, { revision: number; failed: boolean }>>();
  return {
    async respond(details: Challenge): Promise<{ authCredentials?: { username: string; password: string }; cancel?: boolean }> {
      if (!details.isProxy) return {};
      const config = await read();
      const target = details.url ? resolveTarget(config, new URL(details.url).hostname) : config.mode;
      const profile = config.profiles.find(p => p.id === target);
      if (!profile?.auth || !['http', 'https'].includes(profile.scheme) ||
          profile.host.toLowerCase() !== details.challenger.host.replace(/^\[|\]$/g, '').toLowerCase() ||
          profile.port !== details.challenger.port) return {};
      const attempts = attempted.get(details.requestId) ?? new Map<string, { revision: number; failed: boolean }>();
      const previous = attempts.get(profile.id);
      if (previous?.revision === config.revision) {
        previous.failed = true;
        await feedback(true);
        return { cancel: true };
      }
      attempts.set(profile.id, { revision: config.revision, failed: false });
      attempted.set(details.requestId, attempts);
      return { authCredentials: { ...profile.auth } };
    },
    async complete(requestId: string, success: boolean) {
      const attempts = [...(attempted.get(requestId)?.values() ?? [])];
      attempted.delete(requestId);
      const currentRevision = success && attempts.length ? (await read()).revision : undefined;
      if (success && attempts.length && attempts.every(attempt => !attempt.failed) &&
          attempts.some(attempt => attempt.revision === currentRevision)) {
        await feedback(false);
      }
    },
  };
}
