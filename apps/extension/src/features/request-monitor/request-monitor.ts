export interface RequestSummary {
  pending: number
  completed: number
  failed: number
  timeout: number
  domains: string[]
}
type Request = { domain: string; started: number; status: 'pending' | 'completed' | 'failed' | 'ignored' }

export function createRequestMonitor() {
  const tabs = new Map<number, Map<string, Request>>()
  const navigating = new Map<number, string>()
  return {
    commit(tabId: number, network: boolean) {
      if (!(network && navigating.has(tabId))) {
        tabs.delete(tabId)
      }
      navigating.delete(tabId)
    },
    finish(tabId: number, id: string, error?: string) {
      if (error && navigating.get(tabId) === id) {
        navigating.delete(tabId)
      }
      const request = tabs.get(tabId)?.get(id)
      if (request) {
        request.status = !error
          ? 'completed'
          : /ABORT|CANCEL|BLOCKED|NS_BINDING|NS_ERROR_TRACKING|NS_ERROR_CONTENT_BLOCKED/i.test(error)
            ? 'ignored'
            : 'failed'
      }
    },
    read(tabId: number, now = Date.now()): RequestSummary {
      const summary: RequestSummary = { completed: 0, domains: [], failed: 0, pending: 0, timeout: 0 }
      const domains = new Set<string>()
      for (const request of tabs.get(tabId)?.values() ?? []) {
        const status = request.status === 'pending' && now - request.started >= 30_000 ? 'timeout' : request.status
        if (status !== 'ignored') {
          summary[status]++
        }
        if (status === 'failed' || status === 'timeout') {
          domains.add(request.domain)
        }
      }
      summary.domains = [...domains]
      return summary
    },
    remove(tabId: number) {
      tabs.delete(tabId)
      navigating.delete(tabId)
    },
    start(details: { tabId: number; requestId: string; url: string; type: string; timeStamp: number }) {
      if (details.tabId < 0) {
        return
      }
      let domain: string
      try {
        domain = new URL(details.url).hostname
      } catch {
        return
      }
      if (!domain) {
        return
      }
      if (details.type === 'main_frame' && !tabs.get(details.tabId)?.has(details.requestId)) {
        tabs.delete(details.tabId)
      }
      if (details.type === 'main_frame') {
        navigating.set(details.tabId, details.requestId)
      }
      const requests = tabs.get(details.tabId) ?? new Map<string, Request>()
      requests.set(details.requestId, { domain, started: details.timeStamp, status: 'pending' })
      const oldest = requests.keys().next()
      if (requests.size > 1000 && !oldest.done) {
        requests.delete(oldest.value)
      }
      tabs.set(details.tabId, requests)
    }
  }
}
