import type { ProxyConfig } from '@browser-proxy/core';

type Challenge = { requestId: string; isProxy: boolean; challenger: { host: string; port: number } };

export function createProxyAuth(read: () => Promise<ProxyConfig>, feedback: (failed: boolean) => Promise<void>) {
  const attempted = new Map<string, { revision: number; failed: boolean }>();
  return {
    async respond(details: Challenge): Promise<{ authCredentials?: { username: string; password: string }; cancel?: boolean }> {
      if (!details.isProxy) return {};
      const config = await read();
      const profile = config.profiles.find(p => p.id === config.mode);
      if (!profile?.auth || !['http', 'https'].includes(profile.scheme) ||
          profile.host.toLowerCase() !== details.challenger.host.replace(/^\[|\]$/g, '').toLowerCase() ||
          profile.port !== details.challenger.port) return {};
      const previous = attempted.get(details.requestId);
      if (previous?.revision === config.revision) {
        previous.failed = true;
        await feedback(true);
        return { cancel: true };
      }
      attempted.set(details.requestId, { revision: config.revision, failed: false });
      return { authCredentials: { ...profile.auth } };
    },
    async complete(requestId: string, success: boolean) {
      const attempt = attempted.get(requestId);
      attempted.delete(requestId);
      if (success && attempt && !attempt.failed && (await read()).revision === attempt.revision) {
        await feedback(false);
      }
    },
  };
}
