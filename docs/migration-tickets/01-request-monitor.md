Published as [#11](https://github.com/tsingshaner/browser-proxy/issues/11). Implementation deferred.

## Parent

https://github.com/tsingshaner/browser-proxy/issues/9

## What to build

在新版 popup 查看当前标签页的请求状态和失败域名，并从失败项进入域名规则编辑，便于定位代理问题。

## Acceptance criteria

- [ ] Chromium 与 Firefox 均展示当前页进行中、完成、失败及超时请求的数量，保留失败域名提示和规则编辑入口。
- [ ] 页面导航、标签页关闭和后台重新初始化后状态正确；已取消或由其他扩展阻断的请求不误报代理失败。
- [ ] 失败项允许新增精确域名或 *.domain 规则；配置修改遵循版本冲突检查，保存后实际路由生效。
- [ ] 每个标签页最多保留 1,000 条请求记录；只保留排障必要的域名、状态和耗时，不保存请求体、认证头或带查询参数的完整 URL。
- [ ] 使用有界原生 Map 和时间戳管理超时，不引入 heap；监控状态属于会话数据，旧运行时缓存不迁移。
- [ ] 如保留可注册域名自动推导，使用 tldts 等公共后缀解析器；不得用字符串切割冒充公共后缀解析。用户也可直接填写规则。
- [ ] 从浏览器事件到 popup 及规则保存的边界测试覆盖成功、失败、超时恢复、取消和缓存上限；真实双浏览器验证。

## Blocked by

- https://github.com/tsingshaner/browser-proxy/issues/6
- https://github.com/tsingshaner/browser-proxy/issues/8
