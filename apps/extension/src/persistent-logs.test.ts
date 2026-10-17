import { describe, expect, test } from 'vitest'

import { pruneLogs, safeLog } from './persistent-logs'

describe('persistent diagnostic log boundaries', () => {
  test('retains only the last 30 days and newest 5,000 entries', () => {
    const now = 31 * 86400_000
    const entries = Array.from({ length: 5001 }, (_, i) => ({ level: 'info', message: String(i), timestamp: now - i }))
    const result = pruneLogs([{ level: 'info', message: 'expired', timestamp: 0 }, ...entries], now)
    expect(result).toHaveLength(5000)
    expect(result[0]?.message).toBe('4999')
    expect(result.at(-1)?.message).toBe('0')
  })
  test('measures serialized UTF-8 bytes including non-ASCII text', () => {
    const entries = Array.from({ length: 100 }, (_, timestamp) => ({
      level: 'info',
      message: '日志'.repeat(20_000),
      timestamp
    }))
    const result = pruneLogs(entries, 100)
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThanOrEqual(5 * 1024 * 1024)
    expect(result.length).toBeLessThan(entries.length)
    expect(result.at(-1)?.timestamp).toBe(99)
  })
  test('never persists arbitrary messages, credentials, or structured properties', () => {
    const record = safeLog({
      level: 'error',
      message: ['secret'],
      properties: { auth: 'secret' },
      rawMessage: 'password=secret token=secret',
      timestamp: 1
    })
    expect(record).toEqual({ level: 'error', message: 'Diagnostic details omitted.', timestamp: 1 })
  })
})
