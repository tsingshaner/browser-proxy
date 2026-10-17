type PanelApi = {
  sidebarAction?: { open(): Promise<void> }
  sidePanel?: { open(options: { windowId: number }): Promise<void> }
}

// Invoke the browser API synchronously so the click's user gesture is preserved.
export function openSidePanel(api: PanelApi, windowId?: number): Promise<void> {
  if (api.sidebarAction) {
    return api.sidebarAction.open()
  }
  if (api.sidePanel && windowId !== undefined) {
    return api.sidePanel.open({ windowId })
  }
  return Promise.reject(new Error('side-panel-unavailable'))
}
