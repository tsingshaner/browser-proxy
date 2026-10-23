export type TabInfo = Pick<
  chrome.tabs.Tab,
  | 'id'
  | 'windowId'
  | 'index'
  | 'url'
  | 'title'
  | 'favIconUrl'
  | 'active'
  | 'pinned'
  | 'audible'
  | 'incognito'
  | 'lastAccessed'
  | 'pendingUrl'
> & { cookieStoreId?: string }
type WindowInfo = { id?: number; type?: string; incognito: boolean }
type Entry = { id: number; url: string; windowId: number; cookieStoreId?: string }
type Io = {
  firefox: boolean
  tabs(): Promise<TabInfo[]>
  windows(): Promise<WindowInfo[]>
  remove(id: number): Promise<void>
  create(entry: Omit<Entry, 'id'>): Promise<unknown>
  read(): Promise<unknown>
  write(value: unknown): Promise<void>
}
type EligibleTab = TabInfo & { id: number; url: string }
type Group = { keepId: number; tabs: EligibleTab[] }
export type Preview = { id: string; windowId: number | null; count: number; groups: Group[] }
export type Selection = { keepId: number; closeIds: number[] }
type Recovery = {
  entries: Entry[]
  uncertain: number
  pending?: { kind: 'close' | 'reopen'; entry: Entry; replace?: boolean }
}

export function protectedTab(tab: TabInfo) {
  return tab.active || tab.pinned || !!tab.audible
}
const normalWindow = (window: WindowInfo) => window.type === 'normal' && !window.incognito
const validId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0
function webUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}
function groupTabs(tabs: EligibleTab[]): Group[] {
  const groups = new Map<string, EligibleTab[]>()
  for (const tab of tabs) {
    const key = JSON.stringify([tab.url, tab.cookieStoreId])
    const group = groups.get(key) ?? []
    group.push(tab)
    groups.set(key, group)
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const keep =
        group.find(protectedTab) ?? [...group].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0]
      return { keepId: keep.id, tabs: group }
    })
}
function validateSelections(preview: Preview, selections: unknown): Selection[] {
  if (!Array.isArray(selections) || selections.length !== preview.groups.length) {
    throw new Error('tabsInvalid')
  }
  return selections.map((value, index) => {
    const group = preview.groups[index]
    if (!(value && validId(value.keepId) && Array.isArray(value.closeIds))) {
      throw new Error('tabsInvalid')
    }
    const valid =
      group.tabs.some((tab) => tab.id === value.keepId) && new Set(value.closeIds).size === value.closeIds.length
    const safe = value.closeIds.every(
      (id: unknown) =>
        validId(id) && id !== value.keepId && group.tabs.some((tab) => tab.id === id && !protectedTab(tab))
    )
    if (!(valid && safe)) {
      throw new Error('tabsInvalid')
    }
    return value as Selection
  })
}
function validateRecovery(value: unknown, firefox: boolean): Recovery {
  const state = (value ?? { entries: [], uncertain: 0 }) as Recovery
  const validEntry = (entry: Entry) =>
    entry &&
    validId(entry.id) &&
    validId(entry.windowId) &&
    webUrl(entry.url) &&
    (!firefox || typeof entry.cookieStoreId === 'string')
  if (!(Array.isArray(state.entries) && state.entries.every(validEntry) && validId(state.uncertain))) {
    throw new Error('tabsStorage')
  }
  if (state.pending && !(['close', 'reopen'].includes(state.pending.kind) && validEntry(state.pending.entry))) {
    throw new Error('tabsStorage')
  }
  return state
}

function closeJobs(preview: Preview, selected: Selection[]) {
  return selected.flatMap((selection, index) => {
    const group = preview.groups[index]
    const keeper = group.tabs.find((tab) => tab.id === selection.keepId)
    if (!keeper) {
      throw new Error('tabsInvalid')
    }
    return group.tabs.filter((tab) => selection.closeIds.includes(tab.id)).map((original) => ({ keeper, original }))
  })
}
function operationFailed(error: unknown, result: { storageFailed: boolean; failed: number }) {
  if (error instanceof Error && error.message === 'tabsStorage') {
    result.storageFailed = true
    return true
  }
  result.failed += 1
  return false
}

export function createTabManager(io: Io) {
  const previews = new Map<string, Preview>()
  let busy = false
  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    if (busy) {
      throw new Error('tabsBusy')
    }
    busy = true
    try {
      return await work()
    } finally {
      busy = false
    }
  }
  async function scan(windowId: number | null): Promise<Preview> {
    if (windowId !== null && !validId(windowId)) {
      throw new Error('tabsInvalid')
    }
    const windows = (await io.windows()).filter(normalWindow)
    if (windowId !== null && !windows.some((w) => w.id === windowId)) {
      throw new Error('tabsWindowMissing')
    }
    const eligible = (tab: TabInfo): tab is EligibleTab =>
      validId(tab.id) &&
      webUrl(tab.url) &&
      !tab.incognito &&
      windows.some((w) => w.id === tab.windowId) &&
      (!io.firefox || !!tab.cookieStoreId)
    const tabs = (await io.tabs())
      .filter(eligible)
      .filter((tab) => windowId === null || tab.windowId === windowId)
      .sort((a, b) => a.windowId - b.windowId || a.index - b.index)
    const preview: Preview = { count: tabs.length, groups: groupTabs(tabs), id: crypto.randomUUID(), windowId }
    const oldest = previews.keys().next().value
    if (previews.size >= 20 && oldest) {
      previews.delete(oldest)
    }
    previews.set(preview.id, structuredClone(preview))
    return preview
  }
  async function save(state: Recovery) {
    try {
      await io.write(state)
    } catch {
      throw new Error('tabsStorage')
    }
  }
  async function readRecovery(): Promise<Recovery> {
    const state = validateRecovery(await io.read(), io.firefox)
    if (!state.pending) {
      return state
    }
    const { kind, entry, replace } = state.pending
    if (kind === 'close') {
      const exists = (await io.tabs()).some((tab) => tab.id === entry.id)
      if (!exists) {
        state.entries = [...(replace ? [] : state.entries), entry]
        state.uncertain = 0
      }
    } else {
      // shortcut: an interrupted create cannot be confirmed; require manual inspection instead of risking duplicates.
      state.entries = state.entries.filter((e) => e.id !== entry.id)
      state.uncertain += 1
    }
    delete state.pending
    await save(state)
    return state
  }
  function recovery() {
    return exclusive(async () => {
      const state = await readRecovery()
      return { count: state.entries.length, uncertain: state.uncertain }
    })
  }
  async function safeToClose(original: EligibleTab, keeper: EligibleTab) {
    const windows = (await io.windows()).filter(normalWindow)
    const tabs = await io.tabs()
    const unchanged = (old: EligibleTab) =>
      tabs.find(
        (tab) =>
          tab.id === old.id &&
          tab.url === old.url &&
          !tab.pendingUrl &&
          tab.windowId === old.windowId &&
          !tab.incognito &&
          (!io.firefox || tab.cookieStoreId === old.cookieStoreId) &&
          windows.some((w) => w.id === tab.windowId)
      )
    const candidate = unchanged(original)
    return !!unchanged(keeper) && !!candidate && !protectedTab(candidate)
  }
  async function closeOne(original: EligibleTab, keeper: EligibleTab, state: Recovery, replace: boolean) {
    if (!(await safeToClose(original, keeper))) {
      return 'skipped' as const
    }
    const entry: Entry = {
      id: original.id,
      url: original.url,
      windowId: original.windowId,
      ...(io.firefox ? { cookieStoreId: original.cookieStoreId } : {})
    }
    state.pending = { entry, kind: 'close', replace }
    await save(state)
    let closed = false
    try {
      await io.remove(entry.id)
      closed = true
    } catch {
      /* Preserve the old batch when closing fails. */
    }
    if (closed) {
      state.entries = [...(replace ? [] : state.entries), entry]
      state.uncertain = 0
    }
    delete state.pending
    return closed ? ('succeeded' as const) : ('failed' as const)
  }
  async function close(previewId: unknown, selections: unknown) {
    const preview = typeof previewId === 'string' ? previews.get(previewId) : undefined
    if (!preview) {
      throw new Error('tabsStale')
    }
    const selected = validateSelections(preview, selections)
    previews.delete(preview.id)
    const state = await readRecovery()
    await save(state)
    const result = { failed: 0, skipped: 0, storageFailed: false, succeeded: 0 }
    const jobs = closeJobs(preview, selected)
    for (const { original, keeper } of jobs) {
      try {
        result[await closeOne(original, keeper, state, result.succeeded === 0)] += 1
        await save(state)
      } catch (error) {
        if (operationFailed(error, result)) {
          break
        }
      }
    }
    return result
  }
  async function reopenOne(entry: Entry, state: Recovery, fallbackWindowId: number) {
    const windows = (await io.windows()).filter(normalWindow)
    const originalExists = windows.some((w) => w.id === entry.windowId)
    const windowId = originalExists ? entry.windowId : fallbackWindowId
    if (!windows.some((w) => w.id === windowId)) {
      return { opened: false, relocated: false }
    }
    state.pending = { entry, kind: 'reopen' }
    await save(state)
    let opened = false
    try {
      await io.create({ url: entry.url, windowId, ...(io.firefox ? { cookieStoreId: entry.cookieStoreId } : {}) })
      opened = true
    } catch {
      /* Keep failed pages available for retry. */
    }
    if (opened) {
      state.entries = state.entries.filter((e) => e.id !== entry.id)
    }
    delete state.pending
    return { opened, relocated: opened && !originalExists }
  }
  async function reopen(fallbackWindowId: number) {
    if (!validId(fallbackWindowId)) {
      throw new Error('tabsInvalid')
    }
    const state = await readRecovery()
    const result = { failed: 0, relocated: 0, storageFailed: false, succeeded: 0 }
    for (const entry of [...state.entries]) {
      try {
        const outcome = await reopenOne(entry, state, fallbackWindowId)
        result[outcome.opened ? 'succeeded' : 'failed'] += 1
        result.relocated += Number(outcome.relocated)
        await save(state)
      } catch (error) {
        if (operationFailed(error, result)) {
          break
        }
      }
    }
    return result
  }
  return {
    close: (id: unknown, selections: unknown) => exclusive(() => close(id, selections)),
    recovery,
    reopen: (windowId: number) => exclusive(() => reopen(windowId)),
    scan
  }
}
