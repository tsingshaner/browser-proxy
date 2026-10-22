export const en = {
  dnrDisableSaveFailed:
    'Rules are disabled now, but this could not be saved. Retry disabling; reloading or restarting may restore the saved rules.',
  dnrInvalid: 'Invalid network rule configuration.',
  dnrRecoveryFailed: 'Could not restore network rules. Reload settings to reconcile them before continuing.',
  headersAny: 'All methods',
  headersDisabled: 'Header rules disabled for subsequent requests.',
  headersEnabled: 'Enable header rules after saving',
  headersHint:
    'Set or remove request and response headers. Higher rules take priority for the same header; changes to different headers can combine. Up to 100 rules, independent of proxy mode.',
  headersInvalid: 'Invalid header configuration. Check names, unique IDs, filters and the 100-rule limit.',
  headersInvalidHeader: 'Enter a valid HTTP header name without spaces or colons.',
  headersInvalidPattern:
    'Enter a domain, complete HTTP/HTTPS URL prefix without credentials or fragments, or a regular expression.',
  headersInvalidValue: 'Header value is too long or contains forbidden control characters.',
  headersLocal:
    'Saved locally, separately from proxy backups. Header values may contain credentials and are stored as plain text. An empty Set value sends an empty header; Remove deletes it.',
  headersMatch: 'Match by',
  headersMatches: {
    domain: 'Domain',
    prefix: 'URL prefix',
    regex: 'Regular expression'
  },
  headersMatchHint:
    'Domains match exactly; *.example.com matches subdomains only. URL prefixes and regular expressions are case-sensitive. Regular expressions require access to all HTTP/HTTPS sites. Browser restrictions still apply.',
  headersMethod: 'Request method',
  headersName: 'Header name',
  headersOperation: 'Operation',
  headersPattern: 'Match pattern',
  headersPermission: 'Grant access to the matching sites before enabling header rules.',
  headersRemove: 'Remove',
  headersRequest: 'Request headers',
  headersResource: 'Resource type',
  headersResources: {
    any: 'All HTTP resources',
    csp_report: 'CSP report',
    font: 'Font',
    image: 'Image',
    main_frame: 'Top-level page',
    media: 'Audio / video',
    object: 'Object',
    other: 'Other',
    ping: 'Beacon / ping',
    script: 'Script',
    stylesheet: 'Stylesheet',
    sub_frame: 'Embedded frame',
    xmlhttprequest: 'Fetch / XHR'
  },
  headersResponse: 'Response headers',
  headersRuleEnabled: 'Enable this rule',
  headersSaveFailed: 'Could not save header rules. Previous rules were restored.',
  headersSet: 'Set',
  headersTarget: 'Modify',
  headersTitle: 'Header rules',
  headersUnsupported: 'The browser does not support this regular expression.',
  headersValue: 'Header value (may be empty)'
}
export const zh: typeof en = {
  dnrDisableSaveFailed: '规则已关闭，但未能保存。请重试关闭；重新加载或重启可能恢复已保存的规则。',
  dnrInvalid: '网络规则配置无效。',
  dnrRecoveryFailed: '无法恢复网络规则，请重新加载设置以校准规则后再继续。',
  headersAny: '全部方法',
  headersDisabled: '已关闭头部规则，不再修改后续请求。',
  headersEnabled: '保存后启用头部规则',
  headersHint:
    '设置或删除请求头和响应头。同一个头由靠前的规则优先生效，不同头的修改可以叠加。最多 100 条，独立于代理模式。',
  headersInvalid: '头部配置无效，请检查名称、唯一 ID、过滤条件及 100 条数量限制。',
  headersInvalidHeader: '请输入有效的 HTTP 头部名称，不含空格或冒号。',
  headersInvalidPattern: '请输入域名、不含凭据或片段的完整 HTTP/HTTPS URL 前缀，或正则表达式。',
  headersInvalidValue: '头部值过长或包含不允许的控制字符。',
  headersLocal:
    '仅存本机，不包含在代理备份中。头部值可能包含凭据，以明文存储。“设置”空值会发送空头，“删除”会移除该头。',
  headersMatch: '匹配方式',
  headersMatches: {
    domain: '域名',
    prefix: 'URL 前缀',
    regex: '正则表达式'
  },
  headersMatchHint:
    '域名精确匹配；*.example.com 仅匹配子域名。URL 前缀和正则区分大小写，正则需要全部 HTTP/HTTPS 站点权限。修改仍受浏览器限制。',
  headersMethod: '请求方法',
  headersName: '头部名称',
  headersOperation: '操作',
  headersPattern: '匹配内容',
  headersPermission: '请授权匹配站点后启用头部规则。',
  headersRemove: '删除',
  headersRequest: '请求头',
  headersResource: '资源类型',
  headersResources: {
    any: '全部 HTTP 资源',
    csp_report: 'CSP 报告',
    font: '字体',
    image: '图片',
    main_frame: '顶层页面',
    media: '音视频',
    object: '嵌入对象',
    other: '其他',
    ping: 'Beacon / ping',
    script: '脚本',
    stylesheet: '样式表',
    sub_frame: '嵌入页面',
    xmlhttprequest: 'Fetch / XHR'
  },
  headersResponse: '响应头',
  headersRuleEnabled: '启用此规则',
  headersSaveFailed: '头部规则保存失败，已恢复之前的规则。',
  headersSet: '设置',
  headersTarget: '修改对象',
  headersTitle: '请求头与响应头',
  headersUnsupported: '浏览器不支持此正则表达式。',
  headersValue: '头部值（可为空）'
}
