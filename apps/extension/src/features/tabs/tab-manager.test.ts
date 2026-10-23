import { describe, expect, test } from 'vitest'

import { createTabManager, type TabInfo } from './tab-manager'

const tab = (id: number, extra: Partial<TabInfo> = {}): TabInfo => ({
  active: false,
  id,
  incognito: false,
  index: id,
  pinned: false,
  title: 'Example',
  url: 'https://example.com/',
  windowId: 1,
  ...extra
})

function browser(initial: TabInfo[], firefox = false) {
  let tabs = initial
  let stored: unknown
  const windows = [
    { id: 1, incognito: false, type: 'normal' },
    { id: 2, incognito: false, type: 'normal' }
  ]
  const io = {
    create: async (entry: { url: string; windowId: number; cookieStoreId?: string }) => {
      const created = tab(100 + tabs.length, entry)
      tabs.push(created)
    },
    firefox,
    read: async () => structuredClone(stored),
    remove: async (id: number) => {
      tabs = tabs.filter((t) => t.id !== id)
    },
    tabs: async () => structuredClone(tabs),
    windows: async () => windows,
    write: async (value: unknown) => {
      stored = structuredClone(value)
    }
  }
  return {
    io,
    manager: createTabManager(io),
    setTabs: (value: TabInfo[]) => {
      tabs = value
    }
  }
}

describe('duplicate tab cleanup', () => {
  test('previews exact duplicates in the source window and recommends keeping the recently used tab', async () => {
    const { manager } = browser([tab(1), tab(2, { lastAccessed: 10 }), tab(3), tab(4, { windowId: 2 })])
    const preview = await manager.scan(1)
    expect(preview.count).toBe(3)
    expect(preview.groups).toMatchObject([{ keepId: 2, tabs: [{ id: 1 }, { id: 2 }, { id: 3 }] }])
  })
})

test('closes only selected duplicates and exposes successful closures for reopening', async () => {
  const { manager, io } = browser([tab(1), tab(2), tab(3, { pinned: true })])
  const preview = await manager.scan(1)
  const result = await manager.close(preview.id, [{ closeIds: [1], keepId: 3 }])
  expect(result).toMatchObject({ failed: 0, skipped: 0, succeeded: 1 })
  expect((await io.tabs()).map((t) => t.id)).toEqual([2, 3])
  expect(await manager.recovery()).toMatchObject({ count: 1, uncertain: 0 })
})

test('reopens a successful batch after the manager restarts without creating duplicates on retry', async () => {
  const { manager, io } = browser([tab(1), tab(2)])
  const preview = await manager.scan(1)
  await manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])
  const restarted = createTabManager(io)
  expect(await restarted.reopen(1)).toMatchObject({ failed: 0, relocated: 0, succeeded: 1 })
  expect(await restarted.reopen(1)).toMatchObject({ failed: 0, succeeded: 0 })
  expect(await restarted.recovery()).toEqual({ count: 0, uncertain: 0 })
  expect((await io.tabs()).map((t) => t.url)).toEqual(['https://example.com/', 'https://example.com/'])
})

test('keeps protected pages and separates URLs, containers, private pages and non-web pages', async () => {
  const { manager } = browser(
    [
      tab(1, { cookieStoreId: 'firefox-default' }),
      tab(2, { active: true, cookieStoreId: 'firefox-default' }),
      tab(3, { audible: true, cookieStoreId: 'firefox-default' }),
      tab(4, { cookieStoreId: 'firefox-default', pinned: true }),
      tab(5, { cookieStoreId: 'firefox-container-1' }),
      tab(6, { cookieStoreId: 'firefox-default', url: 'https://example.com/#other' }),
      tab(7, { cookieStoreId: 'firefox-default', url: 'https://example.com/?q=other' }),
      tab(8, { cookieStoreId: 'firefox-default', incognito: true }),
      tab(9, { url: 'about:blank' }),
      tab(10)
    ],
    true
  )
  const preview = await manager.scan(1)
  expect(preview.count).toBe(7)
  expect(preview.groups).toMatchObject([{ keepId: 2, tabs: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }])
  await expect(manager.close(preview.id, [{ closeIds: [3], keepId: 2 }])).rejects.toThrow('tabsInvalid')
})

test.each([
  { url: 'https://example.com/changed' },
  { active: true },
  { pinned: true },
  { audible: true },
  { windowId: 2 },
  { pendingUrl: 'https://example.com/loading' },
  { incognito: true }
])('skips a candidate whose state changed: %j', async (change) => {
  const { manager, io, setTabs } = browser([tab(1), tab(2)])
  const preview = await manager.scan(1)
  setTabs([tab(1), tab(2, change)])
  expect(await manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])).toMatchObject({ skipped: 1, succeeded: 0 })
  expect(await io.tabs()).toHaveLength(2)
})

test('skips the group when the retained page disappeared', async () => {
  const { manager, setTabs } = browser([tab(1), tab(2), tab(3)])
  const preview = await manager.scan(1)
  setTabs([tab(2), tab(3)])
  expect(await manager.close(preview.id, [{ closeIds: [2, 3], keepId: 1 }])).toMatchObject({ skipped: 2, succeeded: 0 })
})

test('scans across normal windows and protects the active page in every window', async () => {
  const { manager, io } = browser([
    tab(1, { active: true }),
    tab(2, { active: true, windowId: 2 }),
    tab(3, { windowId: 2 })
  ])
  const preview = await manager.scan(null)
  expect(preview.count).toBe(3)
  expect(await manager.close(preview.id, [{ closeIds: [3], keepId: 1 }])).toMatchObject({ succeeded: 1 })
  expect((await io.tabs()).map((t) => t.id)).toEqual([1, 2])
})

test('keeps failed closures out of the reopening batch', async () => {
  const { manager, io } = browser([tab(1), tab(2), tab(3)])
  const remove = io.remove
  io.remove = async (id) => {
    if (id === 2) {
      throw new Error('denied')
    }
    await remove(id)
  }
  const preview = await manager.scan(1)
  expect(await manager.close(preview.id, [{ closeIds: [2, 3], keepId: 1 }])).toMatchObject({ failed: 1, succeeded: 1 })
  expect(await manager.recovery()).toEqual({ count: 1, uncertain: 0 })
  expect((await io.tabs()).map((t) => t.id)).toEqual([1, 2])
})

test('refuses to close anything if session storage is unavailable', async () => {
  const { manager, io } = browser([tab(1), tab(2)])
  io.write = async () => {
    throw new Error('storage unavailable')
  }
  const preview = await manager.scan(1)
  await expect(manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])).rejects.toThrow()
  expect(await io.tabs()).toHaveLength(2)
})

test('rejects a second concurrent operation and reuse of a consumed preview', async () => {
  const { manager, io } = browser([tab(1), tab(2)])
  const remove = io.remove
  let release!: () => void
  io.remove = async (id) => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
    await remove(id)
  }
  const preview = await manager.scan(1)
  const operation = manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])
  await expect(manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])).rejects.toThrow('tabsBusy')
  await expect.poll(() => typeof release).toBe('function')
  release()
  await operation
  await expect(manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])).rejects.toThrow('tabsStale')
})

test('does not retry an uncertain reopening after the session commit fails', async () => {
  const { manager, io } = browser([tab(1), tab(2)])
  const preview = await manager.scan(1)
  await manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])
  const write = io.write
  const create = io.create
  io.create = async (entry) => {
    await create(entry)
    io.write = async () => {
      throw new Error('storage failed')
    }
  }
  expect(await manager.reopen(1)).toMatchObject({ storageFailed: true, succeeded: 1 })
  io.write = write
  const restarted = createTabManager(io)
  expect(await restarted.recovery()).toEqual({ count: 0, uncertain: 1 })
  expect(await restarted.reopen(1)).toMatchObject({ succeeded: 0 })
  expect(await io.tabs()).toHaveLength(2)
})

test('recovers the closed URL if the background stops before committing the closure', async () => {
  const { manager, io } = browser([tab(1), tab(2)])
  const write = io.write
  const remove = io.remove
  io.remove = async (id) => {
    await remove(id)
    io.write = async () => {
      throw new Error('storage failed')
    }
  }
  const preview = await manager.scan(1)
  expect(await manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])).toMatchObject({
    storageFailed: true,
    succeeded: 1
  })
  io.write = write
  expect(await createTabManager(io).recovery()).toEqual({ count: 1, uncertain: 0 })
})

test('relocates reopening when the original window disappears and retries only failed entries', async () => {
  const { manager, io } = browser([tab(1), tab(2), tab(3)])
  const preview = await manager.scan(1)
  await manager.close(preview.id, [{ closeIds: [2, 3], keepId: 1 }])
  io.windows = async () => [{ id: 2, incognito: false, type: 'normal' }]
  const create = io.create
  let fail = true
  io.create = async (entry) => {
    if (fail) {
      fail = false
      throw new Error('denied')
    }
    await create(entry)
  }
  expect(await manager.reopen(2)).toMatchObject({ failed: 1, relocated: 1, succeeded: 1 })
  expect(await manager.recovery()).toMatchObject({ count: 1 })
  expect(await manager.reopen(2)).toMatchObject({ failed: 0, succeeded: 1 })
  expect((await io.tabs()).slice(1).map((t) => t.windowId)).toEqual([2, 2])
})

test('rejects a missing source window and expired previews after a background restart', async () => {
  const { manager, io } = browser([tab(1), tab(2)])
  await expect(manager.scan(99)).rejects.toThrow('tabsWindowMissing')
  const preview = await manager.scan(1)
  await expect(createTabManager(io).close(preview.id, [{ closeIds: [2], keepId: 1 }])).rejects.toThrow('tabsStale')
})

test('reports completed closures when a later browser query fails', async () => {
  const { manager, io } = browser([tab(1), tab(2), tab(3)])
  const preview = await manager.scan(1)
  const remove = io.remove
  io.remove = async (id) => {
    await remove(id)
    io.tabs = () => Promise.reject(new Error('query failed'))
  }
  expect(await manager.close(preview.id, [{ closeIds: [2, 3], keepId: 1 }])).toMatchObject({ failed: 1, succeeded: 1 })
})

test('refuses malformed saved URLs without creating a page', async () => {
  const { manager, io } = browser([tab(1)])
  await io.write({ entries: [{ id: 2, url: 'javascript:alert(1)', windowId: 1 }], uncertain: 0 })
  await expect(manager.reopen(1)).rejects.toThrow('tabsStorage')
  expect(await io.tabs()).toHaveLength(1)
})

test('reopens in the original Firefox container and preserves failures for retry', async () => {
  const { manager, io } = browser(
    [tab(1, { cookieStoreId: 'firefox-container-1' }), tab(2, { cookieStoreId: 'firefox-container-1' })],
    true
  )
  const preview = await manager.scan(1)
  await manager.close(preview.id, [{ closeIds: [2], keepId: 1 }])
  const create = io.create
  io.create = (entry) => {
    expect(entry.cookieStoreId).toBe('firefox-container-1')
    return Promise.reject(new Error('container removed'))
  }
  expect(await manager.reopen(1)).toMatchObject({ failed: 1, succeeded: 0 })
  expect(await manager.recovery()).toMatchObject({ count: 1 })
  io.create = create
  await manager.reopen(1)
  expect((await io.tabs()).map((t) => t.cookieStoreId)).toEqual(['firefox-container-1', 'firefox-container-1'])
})

test.each([
  null,
  [],
  [{ closeIds: [1, 2], keepId: 1 }],
  [{ closeIds: [2, 2], keepId: 1 }],
  [{ closeIds: [99], keepId: 1 }]
])('rejects malformed selections without closing pages: %j', async (selections) => {
  const { manager, io } = browser([tab(1), tab(2)])
  const preview = await manager.scan(1)
  await expect(manager.close(preview.id, selections)).rejects.toThrow('tabsInvalid')
  expect(await io.tabs()).toHaveLength(2)
})
