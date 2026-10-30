export const settingsSections = [
  'mode',
  'profiles',
  'rulesTitle',
  'redirectTitle',
  'headersTitle',
  'tabsTitle',
  'backup',
  'logs'
] as const

export const sectionFromHash = (hash: string) => {
  const section = hash.slice(1).split('&')[0]
  if (section === 'tabs') {
    return 'tabsTitle'
  }
  if (section?.startsWith('rule=')) {
    return 'rulesTitle'
  }
  return settingsSections.find((value) => value === section) ?? 'profiles'
}
