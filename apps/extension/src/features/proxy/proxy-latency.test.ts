import { parseConfig } from '@browser-tookits/core'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createProxyLatency, probeUrl } from './proxy-latency'

const setup = () => {
  const state = {
    config: parseConfig({
      defaultTarget: 'direct',
      mode: 'office',
      profiles: [{ host: 'proxy.example', id: 'office', name: 'Office', port: 8080, scheme: 'http' }],
      revision: 0,
      rules: [],
      version: 1
    }),
    controlled: true,
    generation: 0
  }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
  return { fetcher, run: createProxyLatency({ fetch: fetcher, read: async () => structuredClone(state) }), state }
}
const message = { profileId: 'office', revision: 0 }

afterEach(() => {
  vi.useRealTimers()
})

describe('current fixed proxy latency', () => {
  test('measures the uncached HTTPS response without changing configuration', async () => {
    const { run, fetcher, state } = setup()
    const original = structuredClone(state)
    vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValueOnce(142.4)
    expect(await run(message)).toEqual({ milliseconds: 42, ok: true })
    expect(fetcher).toHaveBeenCalledWith(
      probeUrl,
      expect.objectContaining({ cache: 'no-store', credentials: 'omit', redirect: 'error' })
    )
    expect(state).toEqual(original)
    vi.restoreAllMocks()
  })
  test.each(['direct', 'system', 'auto'])('rejects %s without making a request', async (mode) => {
    const { run, fetcher, state } = setup()
    state.config.mode = mode
    expect(await run(message)).toEqual({ code: 'pingChanged', ok: false })
    expect(fetcher).not.toHaveBeenCalled()
  })
  test('rejects stale requests and lost control before sending traffic', async () => {
    const { run, fetcher, state } = setup()
    expect(await run({ ...message, revision: 2 })).toEqual({ code: 'pingChanged', ok: false })
    state.controlled = false
    expect(await run(message)).toEqual({ code: 'pingChanged', ok: false })
    expect(fetcher).not.toHaveBeenCalled()
  })
  test.each(['revision', 'generation', 'control'])(
    'discards results when %s changes during the request',
    async (change) => {
      const { run, fetcher, state } = setup()
      fetcher.mockImplementation(() => {
        if (change === 'revision') {
          state.config.revision++
        }
        if (change === 'generation') {
          state.generation++
        }
        if (change === 'control') {
          state.controlled = false
        }
        return Promise.resolve(new Response(null, { status: 204 }))
      })
      expect(await run(message)).toEqual({ code: 'pingChanged', ok: false })
    }
  )
  test('reports HTTP and network failures without leaking errors', async () => {
    const { run, fetcher } = setup()
    fetcher.mockResolvedValueOnce(new Response(null, { status: 407 }))
    expect(await run(message)).toEqual({ code: 'pingFailed', ok: false })
    fetcher.mockRejectedValueOnce(new Error('private details'))
    expect(await run(message)).toEqual({ code: 'pingFailed', ok: false })
  })
  test('times out, rejects concurrent tests, and allows retry', async () => {
    vi.useFakeTimers()
    const { run, fetcher } = setup()
    fetcher.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        })
    )
    const pending = run(message)
    expect(await run(message)).toEqual({ code: 'pingBusy', ok: false })
    await vi.advanceTimersByTimeAsync(8000)
    expect(await pending).toEqual({ code: 'pingTimeout', ok: false })
    expect(await run(message)).toMatchObject({ ok: true })
  })
})
