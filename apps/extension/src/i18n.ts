import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

export const translationsReady = i18next.use(initReactI18next).init({
  lng: chrome.i18n.getUILanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: {
      title: 'Browser Proxy', subtitle: 'Choose how you connect.', mode: 'Connection mode',
      direct: 'Direct connection', directHint: 'Connect without a proxy.',
      system: 'System proxy', systemHint: 'Use your system’s proxy settings.',
      loading: 'Loading settings…', saving: 'Applying…', saved: 'Settings applied',
      error: 'Could not apply or load settings. Check extension permissions and try again.',
      retry: 'Retry', footer: 'Changes apply to regular browsing.',
    } },
    zh: { translation: {
      title: 'Browser Proxy', subtitle: '选择你的网络连接方式。', mode: '连接模式',
      direct: '直接连接', directHint: '不通过代理访问网络。',
      system: '系统代理', systemHint: '跟随系统的代理设置。',
      loading: '正在读取设置…', saving: '正在应用…', saved: '设置已生效',
      error: '无法应用或读取设置，请检查扩展权限后重试。',
      retry: '重试', footer: '更改应用于常规浏览窗口。',
    } },
  },
});
