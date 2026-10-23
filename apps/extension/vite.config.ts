import { copyFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { crx } from '@crxjs/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import zipPack from 'vite-plugin-zip-pack'

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox'
  const outDir = firefox ? 'dist-firefox' : 'dist'
  const source = new URL(`./${outDir}/`, import.meta.url)
  return {
    build: { outDir },
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
          name: 'Browser Tookits',
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
                  default_panel: 'src/options/index.html',
                  default_title: 'Browser Tookits',
                  open_at_install: false
                }
              }
            : { minimum_chrome_version: '120', side_panel: { default_path: 'src/options/index.html' } }),
          action: {
            default_icon: {
              16: 'public/icon-16.png',
              32: 'public/icon-32.png',
              48: 'public/icon-48.png'
            },
            default_popup: 'src/popup/index.html',
            default_title: 'Browser Tookits'
          },
          background: firefox
            ? { scripts: ['src/background.ts'], type: 'module' }
            : { service_worker: 'src/background.ts', type: 'module' },
          host_permissions: ['<all_urls>'],
          icons: {
            16: 'public/icon-16.png',
            32: 'public/icon-32.png',
            48: 'public/icon-48.png',
            128: 'public/icon-128.png'
          },
          options_ui: { open_in_tab: true, page: 'src/options/index.html' },
          permissions: [
            'proxy',
            'declarativeNetRequestWithHostAccess',
            'storage',
            'webRequest',
            'webRequestAuthProvider',
            'webNavigation',
            ...(firefox ? ['cookies'] : ['sidePanel'])
          ]
        }
        // biome-ignore-end lint/style/useNamingConvention: Browser manifest schema ends here.
      }),
      {
        apply: 'build',
        closeBundle: {
          async handler() {
            const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'))
            if (manifest.manifest_version !== 3) {
              throw new Error('Invalid extension manifest')
            }
            for (const name of ['COPYING', 'AUTHORS']) {
              await copyFile(new URL(`../../${name}`, import.meta.url), new URL(name, source))
            }
          },
          sequential: true
        },
        enforce: 'post',
        name: 'prepare-extension-package'
      },
      zipPack({
        done(error) {
          if (error) {
            throw error
          }
        },
        inDir: fileURLToPath(source),
        outDir: fileURLToPath(new URL('../../dist/', import.meta.url)),
        outFileName: `${firefox ? 'firefox' : 'chromium'}-release.zip`
      })
    ],
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } }
  }
})
