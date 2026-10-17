Published as [#12](https://github.com/tsingshaner/browser-proxy/issues/12). Implemented and validated.

## Parent

https://github.com/tsingshaner/browser-proxy/issues/9

## What to build

在新版管理多个可互相引用的情景模式，保留规则优先级，并完整迁移旧配置中支持的嵌套路由。

## Acceptance criteria

- [ ] 设置页可创建、编辑和选择多个规则情景模式，规则及默认策略可指向固定代理、直连或其他规则情景模式。
- [ ] 第一条命中生效，嵌套默认策略可预测；不引入任意 PAC 脚本、IP/CIDR 或高级匹配表达式。
- [ ] 保存和导入拒绝循环引用、缺失目标及过深嵌套；删除被引用模式前明确提示并保护现有配置。
- [ ] 迁移已有新版单一自动模式，不丢失规则顺序和默认目标；配置版本和过期页面保存检查保持有效。
- [ ] 旧 JSON 中多个 SwitchProfile 和可支持的 VirtualProfile 引用关系可恢复；不支持的订阅、PAC 和条件仍逐项报告并要求部分导入确认。
- [ ] Chromium PAC、Firefox 路由及认证选择使用同一语义；代理凭据只发送给实际匹配的代理。
- [ ] 验证多层命中、默认策略、循环拒绝、引用删除、旧配置迁移、JSON 往返和真实双浏览器路由。

## Blocked by

- https://github.com/tsingshaner/browser-proxy/issues/7
- https://github.com/tsingshaner/browser-proxy/issues/8
