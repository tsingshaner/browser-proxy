# GitHub 浏览器扩展机会调研

调研日期：2026-10-20。范围：项目官方仓库、issue、维护日志和 Chrome 官方 API 文档。本文不把 GitHub star、issue 数量等同于付费需求；issue 仅证明有人报告过痛点，不证明市场规模。状态以本次检索页面为准，搜索索引可能有延迟。所有 MVP、优先级、商业判断均为研究者推断。

## 判断

对个人开发者，最值得继续验证的是「可恢复、可自托管的浏览器工作区」和「解释为什么请求没有按预期走的代理诊断」。若希望沿用 browser-proxy 的积累，后者更匹配；若寻找独立产品，前者的需求证据更完整。

网页存档可以做，但必须限制目标场景。普通 AI 对话导出、一般翻译、一般书签同步已经有相当完整的开源替代品；单独再加一个 AI 按钮不构成切口。

## 1. 可恢复、可自托管的浏览器工作区

**一手证据**

- Tab Session Manager 的 [#1645](https://github.com/sienori/Tab-Session-Manager/issues/1645)（2026-08-18，检索时 open）明确请求 WebDAV/Nextcloud，理由是避免 Google OAuth、保有会话数据控制权；评论继续要求上传前压缩与加密。
- [#1656](https://github.com/sienori/Tab-Session-Manager/issues/1656)（2026-09-18，open）请求客户端加密、S3 兼容存储与保留多个备份版本。提交者还表示可能自行提 PR，因此不能把这个缺口当长期护城河。
- [#1653](https://github.com/sienori/Tab-Session-Manager/issues/1653) 的标题是 Sessions Disappearing, Erased。它是可靠性问题的线索，不足以据此认定普遍丢数据或根因。
- [现有项目](https://github.com/sienori/Tab-Session-Manager) 已经覆盖保存、恢复窗口和标签页；旧 [#521](https://github.com/sienori/Tab-Session-Manager/issues/521) 中维护者早在 2020 年就宣布实现云同步。不能将「云同步」本身当创新。

**产品推断**

- 用户：多电脑工作的研究者、开发者、自托管用户。
- 切口：以数据恢复能力为第一卖点，展示最近成功备份、版本差异、冲突处理和恢复预览；WebDAV 为首个自带存储目标。
- MVP：本地自动快照、显式恢复预览、JSON 导入导出、一个 WebDAV 目标、同步失败可见。端到端加密和跨浏览器组映射应经过专门验证后再宣传。
- 比「漂亮的标签页管理器」更具体，但仍需检验用户是否愿意为可靠恢复付费，而非仅要求免费开源。
- 可先给现有项目补同步能力，观察真实使用和支持成本，再决定独立产品。

## 2. 面向开发者的代理与规则诊断

**一手证据**

- Requestly [#4779](https://github.com/requestly/requestly/issues/4779)（2026-07-01，open）描述公司 Windows/PAC 场景：用户无法分辨规则没有命中，还是重定向目标被公司代理阻止；请求在弹窗展示有效网络配置。
- [Requestly Interceptor](https://github.com/requestly/interceptor) 已是 HTTP 拦截与 mocking 工具，完整复制它没有明显必要。
- [Chrome proxy API](https://developer.chrome.com/docs/extensions/reference/api/proxy) 可读写代理配置，提供 direct、auto_detect、pac_script、fixed_servers、system 等模式，并要求 proxy 权限。API 对配置的可见性不等于可观察任意请求最终走过的全部网络路径。

**产品推断**

- 用户：同时使用公司代理、开发环境重写规则和多个调试扩展的前端、QA。
- 切口：「这个 URL 为什么没走预期代理？」一屏呈现本扩展规则命中解释、配置控制状态、PAC/固定代理模式、最近代理错误，以及可导出的脱敏诊断包。
- MVP：只解释自己管理的规则和官方 API 可读到的状态；提供用户主动触发的连通性探测。不能根据一个 probe 就声称知道每个请求最终使用的代理，更不能把 issue 作者建议当作 API 能力保证。
- 与现有 browser-proxy 更接近，适合作为产品差异化功能先上线。
- 证据强度有限：目前直接证据是一个具体 issue。应先找数名公司网络环境的用户复现痛点，不能据此宣称广泛市场空缺。

## 3. 登录态网页的可靠存档与采集验收

**一手证据**

- Linkwarden [#1019](https://github.com/linkwarden/linkwarden/issues/1019) 报告浏览器端剪藏长页面失败，有时留下空截图。作者解释本地采集对已登录页面、已关闭提示条的页面和服务器不可访问的内网有用。
- SingleFile [#1932](https://github.com/gildas-lormeau/SingleFile/issues/1932) 报告 LinkedIn 改版后无法保存职位描述的文本选区，体现站点变化带来的维护成本。
- [SingleFile](https://github.com/gildas-lormeau/SingleFile) 已提供完整网页单 HTML 保存，不能把「保存网页」称为新功能。
- [Linkwarden](https://github.com/linkwarden/linkwarden) 已列出全文搜索、SingleFile 上传、Floccus 浏览器同步，故「存档后能搜索」「接入 SingleFile」也不是空白。

**产品推断**

- 用户：需要留存网页版本的采购、求职、研究工作者。
- 切口：限定一种工作流，例如职位页面快照或供应商规格采集。保存时明确列出实际抓取的标题、正文、图片数量、未加载部分，保存后即时预览，失败可重试。
- MVP：当前页面或选区 → HTML + 文本 + 元数据清单 → 本地目录；记录 URL、时间和摘要校验值；不承诺法律证据效力。
- 可扩展为同一 URL 的版本对比，但本次材料仅直接支持采集可靠性痛点，版本对比的需求仍需访谈。
- 风险：长页面、虚拟列表、登录态及每个站点改版均增加支持成本。先适配一两个场景，比通用存档平台更适合个人。

## 4. 自托管收藏服务的浏览器工作台

**一手证据**

- Linkwarden [#1573](https://github.com/linkwarden/linkwarden/issues/1573) 请求保存链接时直接创建标签；作者描述不得不打开 web app 导致把整理推迟。
- [#1826](https://github.com/linkwarden/linkwarden/issues/1826) 请求修改已保存链接的标签和集合；页面同时关联 #1840，说明上游可能正在实现，不能假定缺口会持续。
- [官方扩展](https://github.com/linkwarden/browser-extension) 已有单击保存、截图上传、保存窗口全部标签等能力，仓库注明已迁移主仓库。
- [官方文档](https://github.com/linkwarden/docs/blob/main/docs/getting-started/browser-extension.md) 区分「保存链接」与浏览器书签同步，并为需登录的页面提供浏览器截图选项。

**产品推断**

- 切口：侧边栏显示「这个页面是否已经收过、收在哪里、有哪些备注」，直接更新已有记录；本地离线队列、失败重试、重复 URL 处理。
- 若独立做，可逐步接多种自托管收藏服务，价值在统一工作流。仅为 Linkwarden 增加一两个按钮，更适合上游 PR，不足以支撑独立收费产品。
- MVP 应先支持一个后端，证明重复访问与重新整理是高频任务。多后端会成倍增加认证、标签模型和同步支持成本。
- 证据支持交互摩擦；跨后端需求与付费意愿尚未证实。

## 5. AI 对话的长期归档：仅作为有条件机会

**一手证据**

- [Chat2Note](https://github.com/shiquda/chat2note) 已支持多个 AI 平台，导出本地文件及 Notion、Obsidian、思源、Joplin，提供选择消息和模板。
- [AI Exporter](https://github.com/sisodiabhumca/AI-Exporter) 宣称本地运行、六个平台，并覆盖 ChatGPT Projects、知识文件等；仓库说明商店提交尚在审核，因此仓库出现不等于商店已可用。
- [ChatArchive](https://github.com/Weiykong/ChatArchive) 已宣称包含提取策略诊断、置信度、测试样本和定期兼容性检查。
- [pionxzh/chatgpt-exporter 的维护日志](https://github.com/pionxzh/chatgpt-exporter/blob/master/CHANGELOG.md) 持续包含界面改版、公式、附件、引用、项目筛选和批量导出的兼容修复。这是维护成本的直接证据。

**产品推断**

- 普通「一键导出 Markdown」「多平台」「本地隐私」「导入 Obsidian」已经不足以差异化。
- 尚可验证的方向是一个项目的长期知识档案：增量归档、稳定去重、原始结构保存、附件完整性报告，以及导出后全文检索。
- 但本次并未找到足够直接的一手用户需求证明用户愿为这一组合付费，不能推荐为首选。
- 必须先验证已有项目是否已满足这些需求。依赖各平台内部接口和 DOM 的方案会持续产生适配工作；产品不能以一次完成开发来估算成本。

## 被否定的常见切口：普通翻译与术语库

沉浸式翻译 [#4031](https://github.com/immersive-translate/immersive-translate/issues/4031) 记录卸载后术语库丢失，维护者回复术语库保存在扩展中、卸载后无法找回。这个 issue 已关闭，不能称为待修复 bug。它证明备份与可迁移的重要性。

但 [官方 terms 仓库](https://github.com/immersive-translate/terms) 已提供 CSV 术语格式、领域/站点规则；[KISS Translator](https://github.com/fishjar/kiss-translator) 也已提供个人术语库、WebDAV/自建同步和广泛翻译功能。因此，做另一个支持自带 key、双语显示、术语表的翻译扩展不值得优先投入。更窄的行业术语审校仍需独立寻找需求证据。

## 建议验证顺序

1. 若沿用本仓库：用代理诊断原型，验证用户是否能更快定位真实网络问题；避免先做大型规则管理平台。
2. 若独立选题：访谈已有会话管理器用户，验证恢复失败经历、存储偏好及付费意愿；以恢复演练成功率而非功能数验收。
3. 若有行业资源：挑一个登录态网页存档工作流，用真实页面样本测成功率与维护成本。
4. 收藏工作台优先上游贡献；AI 对话导出和一般翻译暂不作为首选。

本文没有创建 GitHub issue、发送外部消息或对这些项目做产品运行测试；结论是基于官方描述和用户报告的初筛，不是完整竞争审计。
