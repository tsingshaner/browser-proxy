import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

export const translationsReady = i18next.use(initReactI18next).init({
  lng: chrome.i18n.getUILanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: {
      manage: 'Manage proxies', profiles: 'Fixed proxies', add: 'New proxy', edit: 'Edit', remove: 'Delete',
      name: 'Name', host: 'Server address', port: 'Port', scheme: 'Protocol', save: 'Save proxy', cancel: 'Cancel',
      empty: 'No proxies yet. Add a server to get started.',
      conflict: 'Settings changed in another page. Reload before saving again.',
      'invalid-profile': 'Enter a name, valid server address, protocol, and port (1–65535).',
      'active-profile': 'Switch to another connection before deleting this proxy.',
      title: 'Browser Proxy', subtitle: 'Choose how you connect.', mode: 'Connection mode',
      direct: 'Direct connection', directHint: 'Connect without a proxy.',
      system: 'System proxy', systemHint: 'Use your system’s proxy settings.',
      loading: 'Loading settings…', saving: 'Applying…', saved: 'Settings applied',
      error: 'Could not apply or load settings. Check extension permissions and try again.',
      retry: 'Retry', footer: 'Changes apply to regular browsing.',
    } },
    zh: { translation: {
      manage: '管理代理', profiles: '固定代理', add: '新建代理', edit: '编辑', remove: '删除',
      name: '名称', host: '服务器地址', port: '端口', scheme: '协议', save: '保存代理', cancel: '取消',
      empty: '还没有代理，添加服务器即可开始使用。',
      conflict: '其他页面已更新配置，请重新加载后再保存。',
      'invalid-profile': '请填写名称、有效的服务器地址、协议和端口（1–65535）。',
      'active-profile': '请先切换连接方式，再删除当前代理。',
      title: 'Browser Proxy', subtitle: '选择你的网络连接方式。', mode: '连接模式',
      direct: '直接连接', directHint: '不通过代理访问网络。',
      system: '系统代理', systemHint: '跟随系统的代理设置。',
      loading: '正在读取设置…', saving: '正在应用…', saved: '设置已生效',
      error: '无法应用或读取设置，请检查扩展权限后重试。',
      retry: '重试', footer: '更改应用于常规浏览窗口。',
    } },
  },
});
