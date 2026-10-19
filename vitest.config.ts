import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@browser-tookits/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname } },
  test: { include: ['tests/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.{ts,tsx}'] }
})
