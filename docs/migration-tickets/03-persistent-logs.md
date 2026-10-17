Published as [#13](https://github.com/tsingshaner/browser-proxy/issues/13). Implementation deferred.

## Parent

https://github.com/tsingshaner/browser-proxy/issues/9

## What to build

用 LogTape 记录可持久化、可读取、可导出和清理的诊断日志，后台或浏览器重启后仍可排查问题。

## Acceptance criteria

- [ ] 设置页可查看、导出和清空日志；后台重新初始化后保留未过期记录，存储失败不会阻断代理切换。
- [ ] 默认保留最近 30 天，同时最多保留 5,000 条且序列化 UTF-8 总量不超过 5 MB；写入和读取时清理超限记录。
- [ ] 使用 LogTape 自定义持久化 sink 和原生 IndexedDB / Promise，不新增 idb-keyval；不占用代理配置的 storage.local 配额。
- [ ] 不记录密码、令牌、完整认证头或完整配置；日志和导出经过统一脱敏，只保留排障必需信息。
- [ ] 新版日志与旧库隔离，不自动复制可能包含敏感内容的旧文本日志；迁移说明引导用户在旧版手动导出，升级不删除旧历史日志。
- [ ] 多事件连续写入、并发清理、过期和容量上限、Unicode 字节计量、存储失败恢复及敏感信息脱敏有边界测试。
- [ ] 在 Chromium 和 Firefox 验证重启后读取、导出及清空；最终清理旧实现时删除 idb-keyval 和旧日志覆盖 console 的实现。

## Blocked by

- https://github.com/tsingshaner/browser-proxy/issues/4
- https://github.com/tsingshaner/browser-proxy/issues/8
