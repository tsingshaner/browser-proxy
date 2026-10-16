const browserApi = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser;
export const api = browserApi ?? chrome;
export const isFirefox = api.runtime.getURL('').startsWith('moz-extension://');
