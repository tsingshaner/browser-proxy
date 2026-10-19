import { describe, expect, test, vi } from 'vitest'

import type { LogRecord } from '@logtape/logtape'

import { createLogControl } from './log-control'

const record = { level: 'info', rawMessage: 'Background initialized.', timestamp: 1 } as LogRecord

describe('diagnostic logging preference', () => {
  test('defaults on, stops both sinks when disabled, and resumes without clearing history', async () => {
    const write = vi.fn<(enabled: boolean) => Promise<void>>().mockResolvedValue(undefined)
    const control = createLogControl({ read: () => Promise.resolve(undefined), write })
    const history: LogRecord[] = []
    const consoleSink = vi.fn()
    const persist = control.sink((entry) => {
      history.push(entry)
    })
    const consoleLog = control.sink(consoleSink)
    await control.ready
    persist(record)
    await control.setEnabled(false)
    persist(record)
    consoleLog(record)
    expect(history).toEqual([record])
    expect(consoleSink).not.toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith(false)
    await control.setEnabled(true)
    persist(record)
    expect(history).toHaveLength(2)
  })
  test('restores disabled preference before any startup records', async () => {
    const control = createLogControl({ read: () => Promise.resolve(false), write: () => Promise.resolve() })
    const target = vi.fn()
    const sink = control.sink(target)
    sink(record)
    await control.ready
    sink(record)
    expect(control.enabled).toBe(false)
    expect(target).not.toHaveBeenCalled()
  })
  test('keeps previous state on save failure and rejects invalid input', async () => {
    const write = vi
      .fn<(enabled: boolean) => Promise<void>>()
      .mockRejectedValueOnce(new Error('storage failed'))
      .mockResolvedValue(undefined)
    const control = createLogControl({ read: () => Promise.resolve(undefined), write })
    await control.ready
    await expect(control.setEnabled(false)).rejects.toThrow('storage failed')
    expect(control.enabled).toBe(true)
    await expect(control.setEnabled('false')).rejects.toThrow('invalid-log-setting')
    expect(write).toHaveBeenCalledTimes(1)
    await control.setEnabled(false)
    expect(control.enabled).toBe(false)
  })
  test('keeps logging off after a startup read failure and can retry', async () => {
    const read = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('storage failed'))
      .mockResolvedValue(true)
    const control = createLogControl({ read, write: () => Promise.resolve() })
    await control.ready
    expect(control.enabled).toBe(false)
    await control.restore()
    expect(control.enabled).toBe(true)
  })
  test('serializes concurrent changes in request order', async () => {
    const writes: boolean[] = []
    const control = createLogControl({
      read: () => Promise.resolve(undefined),
      write: (value) => {
        writes.push(value)
        return Promise.resolve()
      }
    })
    await control.ready
    await Promise.all([control.setEnabled(false), control.setEnabled(true)])
    expect(writes).toEqual([false, true])
    expect(control.enabled).toBe(true)
  })
})
