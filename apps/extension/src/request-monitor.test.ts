import { describe, expect, test } from 'vitest'

import { createRequestMonitor } from './request-monitor'

describe('request monitoring', () => {
  test('reports a domain without retaining URL secrets and recovers a timeout', () => {
    const monitor = createRequestMonitor()
    monitor.start({
      requestId: 'a',
      tabId: 1,
      timeStamp: 0,
      type: 'main_frame',
      url: 'https://example.com/?token=secret'
    })
    expect(monitor.read(1, 30_001)).toEqual({
      completed: 0,
      domains: ['example.com'],
      failed: 0,
      pending: 0,
      timeout: 1
    })
    monitor.finish(1, 'a')
    expect(monitor.read(1, 30_002)).toEqual({ completed: 1, domains: [], failed: 0, pending: 0, timeout: 0 })
  })
  test('bounds records and resets navigation, closed tabs, and new background sessions', () => {
    const monitor = createRequestMonitor()
    for (let i = 0; i < 1002; i++) {
      monitor.start({ requestId: String(i), tabId: 1, timeStamp: 0, type: 'image', url: 'https://example.com/' })
    }
    expect(monitor.read(1, 0).pending).toBe(1000)
    monitor.start({ requestId: 'navigation', tabId: 1, timeStamp: 0, type: 'main_frame', url: 'https://next.example/' })
    expect(monitor.read(1, 0).pending).toBe(1)
    monitor.remove(1)
    expect(monitor.read(1, 0).pending).toBe(0)
    expect(createRequestMonitor().read(1, 0).pending).toBe(0)
  })
  test.each(['net::ERR_ABORTED', 'net::ERR_BLOCKED_BY_CLIENT', 'NS_BINDING_ABORTED', 'NS_ERROR_TRACKING_URI'])(
    'does not call cancellation or blocking a failure: %s',
    (error) => {
      const monitor = createRequestMonitor()
      monitor.start({ requestId: 'a', tabId: 1, timeStamp: 0, type: 'image', url: 'https://example.com/' })
      monitor.finish(1, 'a', error)
      expect(monitor.read(1, 100_000)).toEqual({ completed: 0, domains: [], failed: 0, pending: 0, timeout: 0 })
    }
  )
  test('reports network failures without claiming their cause', () => {
    const monitor = createRequestMonitor()
    monitor.start({ requestId: 'a', tabId: 1, timeStamp: 0, type: 'image', url: 'https://example.com/' })
    monitor.finish(1, 'a', 'net::ERR_CONNECTION_REFUSED')
    expect(monitor.read(1, 0).failed).toBe(1)
    expect(monitor.read(1, 0).domains).toEqual(['example.com'])
  })
  test('preserves a network history navigation but clears a restored cached page', () => {
    const monitor = createRequestMonitor()
    monitor.start({ requestId: 'document', tabId: 1, timeStamp: 0, type: 'main_frame', url: 'https://example.com/' })
    monitor.commit(1, true)
    expect(monitor.read(1, 1).pending).toBe(1)
    monitor.finish(1, 'document')
    monitor.commit(1, true)
    expect(monitor.read(1, 2).completed).toBe(0)
  })
})
