import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox'
  return {
    build: { outDir: firefox ? 'dist-firefox' : 'dist' },
    plugins: [
      react(),
      tailwindcss(),
      crx({
        browser: firefox ? 'firefox' : 'chrome',
        // biome-ignore-start lint/style/useNamingConvention: Browser manifest keys must follow the external schema.
        manifest: {
          default_locale: 'en',
          description: '__MSG_description__',
          manifest_version: 3,
          name: 'Browser Proxy',
          version: '0.1.0',
          ...(firefox
            ? {
                browser_specific_settings: {
                  gecko: {
                    data_collection_permissions: { required: ['none'] },
                    id: 'browser-proxy@tsingshaner',
                    strict_min_version: '140.0'
                  }
                },
                sidebar_action: {
                  default_panel: 'options.html',
                  default_title: 'Browser Proxy',
                  open_at_install: false
                }
              }
            : { minimum_chrome_version: '120', side_panel: { default_path: 'options.html' } }),
          action: { default_popup: 'popup.html', default_title: 'Browser Proxy' },
          background: firefox
            ? { scripts: ['src/background.ts'], type: 'module' }
            : { service_worker: 'src/background.ts', type: 'module' },
          host_permissions: ['<all_urls>'],
          options_ui: { open_in_tab: true, page: 'options.html' },
          permissions: [
            'proxy',
            'storage',
            'webRequest',
            'webRequestAuthProvider',
            'webNavigation',
            ...(firefox ? [] : ['sidePanel'])
          ]
        }
        // biome-ignore-end lint/style/useNamingConvention: Browser manifest schema ends here.
      })
    ],
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } }
  }
})
