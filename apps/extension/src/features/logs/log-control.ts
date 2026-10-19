import type { Sink } from '@logtape/logtape'

export const createLogControl = (io: { read: () => Promise<unknown>; write: (enabled: boolean) => Promise<void> }) => {
  let enabled = false
  let loaded = false
  const restore = async () => {
    if (!loaded) {
      enabled = (await io.read()) !== false
      loaded = true
    }
  }
  const ready = restore().catch(() => undefined)
  let pending = ready
  return {
    get enabled() {
      return enabled
    },
    ready,
    restore,
    setEnabled(value: unknown) {
      const operation = pending.then(async () => {
        if (typeof value !== 'boolean') {
          throw new Error('invalid-log-setting')
        }
        await io.write(value)
        enabled = value
        loaded = true
      })
      pending = operation.catch(() => undefined)
      return operation
    },
    sink(target: Sink): Sink {
      return (record) => {
        if (enabled) {
          target(record)
        }
      }
    }
  }
}
