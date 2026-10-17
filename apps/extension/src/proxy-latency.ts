import type { ProxyConfig } from '@browser-proxy/core'

export const probeUrl = 'https://www.gstatic.com/generate_204'

type ProbeResult =
  | { ok: true; milliseconds: number }
  | { ok: false; code: 'pingBusy' | 'pingChanged' | 'pingFailed' | 'pingTimeout' }

const measureLatency = async (fetcher: typeof fetch, signal: AbortSignal): Promise<ProbeResult> => {
  const start = performance.now()
  let result: ProbeResult
  try {
    const response = await fetcher(probeUrl, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal
    })
    const milliseconds = Math.max(0, Math.round(performance.now() - start))
    void response.body?.cancel().catch(() => undefined)
    result = response.status === 204 ? { milliseconds, ok: true } : { code: 'pingFailed', ok: false }
  } catch {
    result = { code: signal.aborted ? 'pingTimeout' : 'pingFailed', ok: false }
  }
  return result
}

export const createProxyLatency = (io: {
  read: () => Promise<{ config: ProxyConfig; controlled: boolean; generation: number }>
  fetch: typeof fetch
}) => {
  let busy = false
  return async (message: { profileId?: unknown; revision?: unknown }): Promise<ProbeResult> => {
    if (busy) {
      return { code: 'pingBusy', ok: false }
    }
    busy = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const abort = new AbortController()
    try {
      const before = await io.read()
      const valid = ({ config, controlled }: typeof before) =>
        controlled &&
        config.revision === message.revision &&
        config.mode === message.profileId &&
        config.profiles.some((profile) => profile.id === message.profileId)
      if (!valid(before)) {
        return { code: 'pingChanged', ok: false }
      }
      timer = setTimeout(() => {
        abort.abort()
      }, 8000)
      const result = await measureLatency(io.fetch, abort.signal)
      clearTimeout(timer)
      const after = await io.read()
      return valid(after) && after.generation === before.generation ? result : { code: 'pingChanged', ok: false }
    } catch {
      return { code: 'pingFailed', ok: false }
    } finally {
      clearTimeout(timer)
      busy = false
    }
  }
}
