import { describe, expect, test } from 'vitest'

import { sectionFromHash, settingsSections } from './navigation'

describe('settings navigation', () => {
  test.each(settingsSections)('opens the requested %s section', (section) => {
    expect(sectionFromHash(`#${section}`)).toBe(section)
  })

  test('preserves tab management links with a source window', () => {
    expect(sectionFromHash('#tabs&window=42')).toBe('tabsTitle')
  })

  test('preserves domain rule links', () => {
    expect(sectionFromHash('#rule=example.com')).toBe('rulesTitle')
  })

  test.each(['', '#unknown', '#tabs-invalid'])('falls back to proxies for %s', (hash) => {
    expect(sectionFromHash(hash)).toBe('profiles')
  })
})
