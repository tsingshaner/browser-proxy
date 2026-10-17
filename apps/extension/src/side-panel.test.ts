import { describe, expect, test } from 'vitest'

import { openSidePanel } from './side-panel'

describe('opening settings in a browser side panel', () => {
  test('opens the Chromium panel in the popup window without deferring the user gesture', async () => {
    const opened: number[] = []
    const operation = openSidePanel(
      {
        sidePanel: {
          open: ({ windowId }) => {
            opened.push(windowId)
            return Promise.resolve()
          }
        }
      },
      7
    )
    expect(opened).toEqual([7])
    await expect(operation).resolves.toBeUndefined()
  })

  test('opens the Firefox sidebar synchronously without requiring a window lookup', async () => {
    let opened = false
    const operation = openSidePanel({
      sidebarAction: {
        open: () => {
          opened = true
          return Promise.resolve()
        }
      }
    })
    expect(opened).toBe(true)
    await expect(operation).resolves.toBeUndefined()
  })

  test('preserves browser failures so the UI can offer the existing tab entry', async () => {
    await expect(
      openSidePanel({
        sidebarAction: { open: () => Promise.reject(new Error('denied')) }
      })
    ).rejects.toThrow('denied')
  })

  test('rejects a Chromium request without a known window instead of targeting another window', async () => {
    const opened: number[] = []
    await expect(
      openSidePanel({
        sidePanel: {
          open: ({ windowId }) => {
            opened.push(windowId)
            return Promise.resolve()
          }
        }
      })
    ).rejects.toThrow('side-panel-unavailable')
    expect(opened).toEqual([])
  })

  test('rejects browsers without a panel API', async () => {
    await expect(openSidePanel({})).rejects.toThrow('side-panel-unavailable')
  })
})
