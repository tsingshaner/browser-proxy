import { parseConfig } from '@browser-proxy/core'

import { api } from './browser-api'

export async function requestConfig(message: Record<string, unknown> = { type: 'get-config' }) {
  const response = await api.runtime.sendMessage(message)
  if (!response?.ok) {
    throw new Error(response?.code ?? 'error')
  }
  return parseConfig(response.config)
}

export function errorKey(error: unknown): string {
  return error instanceof Error &&
    [
      'conflict',
      'invalid-profile',
      'active-profile',
      'invalid-rule',
      'referenced-profile',
      'invalid-backup',
      'import-warning',
      'private-permission'
    ].includes(error.message)
    ? error.message
    : 'error'
}
