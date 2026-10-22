# 浏览器插件机会调研

调研日期：2026-10-20。面向个人开发者、小团队；关注有明确工作流价值、可维护、可验证的产品切口。

## 方法与边界

抽样检索 GitHub 项目及具体 Issues、Chrome Web Store、Firefox Add-ons、Edge Add-ons、Safari App Store，并补查 Opera 推荐目录。不是市场全量普查，没有收入、留存或付费转化数据。商店用户数不是付费人数，不跨商店直接比较；网页和搜索索引有更新时间差异。下文“建议”“商业化”均为研究判断或待验证假设。

GitHub 细分调查见 [GitHub 证据笔记](github-extension-opportunities.md)。

## 市场样本

| 市场 | 一手证据 | 对选题的启发（判断） |
| --- | --- | --- |
| Chrome | [Requestly](https://chromewebstore.google.com/detail/requestly-intercept-modif/mdnleldcmiljblolnjhpnblkcekpdkpa?hl=en-GB) 检索页面显示 300,000 用户；[Environment Marker](https://chromewebstore.google.com/detail/environment-marker/ahjhdebcnlgmojdmjnhikhakkghcchkk?hl=en) 显示 40,000 用户；[Distill](https://chromewebstore.google.com/detail/distill-web-monitor/inlikjemeeknofckkjolnjbpehgadgge) 实时打开显示 400,000 用户 | 开发调试、环境辨识、变化监测有现成需求，但简单复制功能没有明显优势 |
| Firefox | [Tab Session Manager](https://addons.mozilla.org/en-US/firefox/addon/tab-session-manager/) 检索页面显示 167,837 用户；[评论](https://addons.mozilla.org/en-CA/firefox/addon/tab-session-manager/reviews/) 存在同步失败、检索旧会话困难、工作区兼容反馈 | 会话恢复可靠性值得验证；个别评论不能代表整体故障率 |
| Edge | [生产力集合](https://microsoftedge.microsoft.com/addons/collections/productivity_extensions?hl=en-US) 覆盖翻译、截图、AI 助手等成熟类别；[Obsidian 安装说明](https://obsidian.md/help/web-clipper) 给出 Edge 官方版本 | 可作为 Chromium 产品的增量渠道；本次未取得可靠安装量，不能判断竞争更小 |
| Safari | [StopTheMadness Pro](https://apps.apple.com/us/app/stopthemadness-pro/id6471380298) 美国区检索页面显示 $14.99、197 条评分；[Obsidian Web Clipper](https://apps.apple.com/us/app/obsidian-web-clipper/id6720708363?platform=mac) 免费，覆盖 Mac/iPhone/iPad | 存在独立付费工具，但不能据此推算收入或整个市场付费意愿；移动网页体验可研究，通用剪藏已有免费强竞品 |
| Opera | [推荐扩展目录](https://addons.opera.com/en/extensions/?language=en&order=recommended) 包含下载、剪藏等类别 | 本次仅浅层目录核查，没有足够证据把它列为独立首发市场 |

## 候选机会与排序

### 1. 环境诊断与规则解释：最适合本仓库

事实：

- [Requestly #4779](https://github.com/requestly/requestly/issues/4779) 用户要求显示系统/公司代理状态，帮助区分规则没命中与代理阻断目标站点。
- Environment Marker 已提供环境颜色标识、规则和配置导入导出；不能把“生产环境加红条”当创新。
- 本仓库 README 已描述代理配置、嵌套路由、请求监控、Header 规则、路径重定向和诊断日志。

建议切口：围绕“为什么当前页面没按预期连接”，展示本插件配置下的规则匹配过程、优先级冲突、浏览器代理控制状态、权限缺失与已观测错误，导出经预览的诊断摘要。随后再验证项目级环境配置与临时规则到期恢复。

技术边界：[Chrome proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy) 返回的是代理配置，system 模式没有具体服务器参数；onProxyError 是错误通知。不能照搬 Issue 作者的实现猜想，将配置、推演路径、探测结果冒充每条请求的实际网络路径。MVP 应从自己管理的规则解释开始。

商业化假设：个人本地版免费；团队共享环境模板、配置审阅与诊断流程可能有付费价值。单条 Issue 只说明痛点存在，尚未证明付费需求。第一轮找 5—10 位经常切换测试环境的前端/QA，观察他们真实排障。

### 2. 可验证的浏览器会话备份：独立项目优先候选

事实：

- [TSM #1645](https://github.com/sienori/Tab-Session-Manager/issues/1645) 请求 WebDAV/Nextcloud 自托管同步，评论补充上传前加密。
- [TSM #1656](https://github.com/sienori/Tab-Session-Manager/issues/1656) 请求客户端加密、S3 和历史版本，作者亦表示可能自己提交实现。
- 商店评论存在同步和恢复方面的负面反馈，也有大量正面评价。

建议切口：以“备份可检查、恢复前能预览、旧版本不会被同步覆盖”为核心。MVP 做本地版本快照、备份校验、差异预览、选择性恢复和单一远端存储；不要先做复杂实时双向同步。

竞争与边界：TSM 已有自动保存和云同步；上游可能补齐存储后端。跨浏览器的标签组、容器、专有工作区不能承诺完全复原，更不能把恢复 URL 宣传成恢复网页全部运行状态。

商业化假设：高级备份/恢复能力买断或自带存储；托管服务另收费。验证指标应是成功恢复率、是否持续启用和真实付费选择，而不是快照数量。

### 3. 面向富文本编辑器的草稿恢复

事实：[Typio Form Recovery Reboot](https://github.com/tsukumijima/typio-form-recovery-reboot) 已迁移 MV3 并重新提供商店安装，因此“旧插件死了，做个替代”已不充分。其 README 仍说明 contentEditable 宜用恢复对话框、动态 SPA 和 iframe 编辑器存在局限。

建议切口：专门解决长评论、工单、后台富文本在刷新、登录失效或误关闭后丢失。先支持普通 textarea 加两类明确编辑器，按页面和字段保留版本，支持恢复预览与复制兜底。

差异必须用兼容性证明：中文输入法、SPA 换页、富文本结构、同页多编辑器、恢复到错误字段等都要验证。默认只在允许的网站启用，敏感字段排除、短期保留和一键清除属于产品基本能力。

商业化假设：个人买断较容易表达价值，但发生频率、信任成本和编辑器维护成本需实测；还没有付费证据。

### 4. 内网可用的故障资料包

事实：[Jam](https://jam.dev/) 已聚合录屏、请求、日志、设备信息和 AI 上下文；[Chrome DevTools](https://developer.chrome.com/docs/devtools/network/reference) 已有 HAR sanitized 导出。不要把日志加截图或删 Cookie 当新产品。

建议切口：明确服务无法上传业务资料的小团队，输出本地可查看的资料包，支持业务字段脱敏、脱敏前后预览、手工复现步骤和内部工单模板。是否“必须离线”应先访谈，不应凭技术偏好推断。

本仓库已有监控只提供部分基础，不能据此假定已有完整响应体、console 或会话录制能力。先通过用户提供的 HAR 验证资料包工作流，再评估实时捕获权限与开销。

商业化假设：团队规则和内部流程集成；竞争强、信任要求高，优先级低于环境诊断。

### 5. 垂直网页变化监测

事实：[Distill 商店页](https://chromewebstore.google.com/detail/distill-web-monitor/inlikjemeeknofckkjolnjbpehgadgge) 已有区域选择、历史差异、条件提醒和多种通知；[官方说明](https://distill.io/docs/web-monitor/what-is-distill/) 明确本地监测要求浏览器或应用保持打开。

建议切口：只选一种高价值对象，例如供应商公告、开发文档变更或特定行业招标；提供现成字段规则、去重、噪声过滤和变更前后证据。差异是开箱即用的垂直配置和准确性，不能只是“加 AI 摘要”。

MVP 先支持一个领域、少量网站和本地运行。24 小时监测需要另行解决运行环境，云成本和登录态维护不能忽略。本轮证据仅支持大类需求，未验证上述垂直领域的实际付费。

## 暂不优先

- 通用 AI 对话导出：[AI Chat Exporter](https://chromewebstore.google.com/detail/ai-chat-exporter/dfkonbknfdohjkabbajhghecgjpbmphc?hl=en) 已提供多平台、Markdown/JSON/PDF、选择消息、本地处理。若做，需先找到批量完整性、增量归档或特定工作流的明确缺口。
- 通用网页剪藏：[Obsidian 官方](https://obsidian.md/help/web-clipper) 已覆盖四大市场、本地 Markdown、模板和高亮。
- 普通环境角标：Environment Marker 已覆盖，适合作为完整环境工具的组成部分。
- 泛 AI 侧边栏：Edge 集合已有多个成熟产品。仅换模型或提示词不足以形成定位。
- 泛网站修复工具：StopTheMadness 已覆盖大量浏览行为修复；若进入，应先找到特定移动网站群的适配优势。

## 建议决策

若继续投入 browser-proxy，先验证“规则解释 + 网络配置诊断”；若独立做新产品，先比较“可验证会话备份”和“富文本草稿恢复”。

下一步用两周做选题验证，而非同时实现五个项目：

1. 每个候选访谈 5 位真正遇到过问题的人，要求描述最近一次事件、频率、当前替代方案和损失。
2. 为排名第一的痛点制作一个最小可演示流程，让用户带自己的场景试用。
3. 记录是否愿意持续启用、是否再次主动使用、愿意为何种能力支付多少钱。
4. 若只能得到“挺有意思”，或现成产品配置一下即可解决，则停止该方向。

以上是研究备忘录，不是已批准的功能规格；没有创建 GitHub Issue。
