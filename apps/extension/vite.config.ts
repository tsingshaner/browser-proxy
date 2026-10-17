import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';

export default defineConfig(({ mode }) => {
  const firefox = mode === 'firefox';
  return {
    build: { outDir: firefox ? 'dist-firefox' : 'dist' },
    plugins: [react(), tailwindcss(), crx({ browser: firefox ? 'firefox' : 'chrome', manifest: {
      manifest_version: 3,
      name: 'Browser Proxy',
      version: '0.1.0',
      description: '__MSG_description__',
      default_locale: 'en',
      ...(firefox ? { browser_specific_settings: { gecko: {
        id: 'browser-proxy@tsingshaner', strict_min_version: '140.0',
        data_collection_permissions: { required: ['none'] },
      } } } : { minimum_chrome_version: '120' }),
      permissions: ['proxy', 'storage', 'webRequest', 'webRequestAuthProvider', 'webNavigation'],
      host_permissions: ['<all_urls>'],
      options_ui: { page: 'options.html', open_in_tab: true },
      action: { default_popup: 'popup.html', default_title: 'Browser Proxy' },
      background: firefox ? { scripts: ['src/background.ts'], type: 'module' } : { service_worker: 'src/background.ts', type: 'module' },
    } })],
  };
});
