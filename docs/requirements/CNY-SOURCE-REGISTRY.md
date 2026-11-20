# 统一 CNY：需求、决定与证据的唯一来源

现行增量以 [GitHub 规范 #34](https://github.com/naoshengyun/llm-metadata/issues/34) 为准。下方 v0.12 和 #29 材料保留各自的历史适用范围。需求记录：[需求记录：统一 CNY 官方价格源已批准基线与来源追溯](https://github.com/naoshengyun/llm-metadata/issues/5)；决策索引：[决策地图：统一 CNY 价格源的已确认选择与后续验收边界](https://github.com/naoshengyun/llm-metadata/issues/6)。本轮是既有批准的文档补充，不重访谈、不重造Spec、不重新派发T1—T7，也不改变业务选择。

## 历史 v0.12 维护来源与优先级

| 内容 | 唯一维护位置/责任 | 本仓库其他材料的用途 |
|---|---|---|
| 规范性需求、稳定AC及D/O/R适用性 | Planner维护obs专项Spec；当前批准基线v0.12 | [只读字节快照](snapshots/spec-v0.12.md)用于克隆后阅读；GitHub需求记录只索引，不维护第二份全文 |
| 原T1—T7拆解/Blocked by | Planner维护obs拆解v0.12 | [只读字节快照](snapshots/tickets-v0.12.md)及[追溯表](CNY-TRACEABILITY.md)；tickets/是历史实现记录，不是新增执行队列 |
| 原D01—D08及后续确认 | 原决策清单加本线程实际后续用户批准；[具名记录/状态索引](../planning/CNY-DECISION-INDEX.md)指向来源与GitHub记录 | 地图只作索引；已关闭确认记录不代替未定运营政策 |
| 领域词义 | 根[GLOSSARY.md](../../GLOSSARY.md) | 定义不承载实现细节、操作步骤或AC全文 |
| 难逆转架构选择的理由 | [ADR目录](../adr/)记录已确认选择与来源 | ADR不是另一个需求编辑入口；需求冲突交Planner，不由实现倒推批准 |
| 原价记录、来源URL/核对日期、候选选择 | [原价目录](../../data/cny/official-catalog.json)和[候选选择](../../data/cny/proposed-selection.json) | price-research文档是核对证据，不冒充自动持续现价；本次不更新价格 |
| 当前代码/托管/运行状态 | 固定PR/commit及独立QA、实际Actions/API回执 | 下方是2026-11-16核对点，不是永久实时状态 |
| 实际stg路径/确认 | [已审stg方案](../stg/CNY-INTEGRATION-ACCEPTANCE.md)及以后明确获批的路径级输入/意图 | [待定输入：所选 stg 目标、映射与实测条件](https://github.com/naoshengyun/llm-metadata/issues/10)和[待定确认：固定候选的实例应用与配置恢复意图](https://github.com/naoshengyun/llm-metadata/issues/11)保持开放；本轮不代填秘密或授权 |

原文件在`/Users/kohr/baymax_work/obs/outputs/qa/`；完整标题、实际版本/状态、SHA256及快照路径见[sources.json](sources.json)。Spec/Tickets快照与当前源文件逐字节相同，不能单独编辑；新需求由Planner更新唯一来源并产生新版本/新hash，随后追加新快照/审查，不改写已批准快照。需要改变AC时由Planner明确处理，禁止重编号覆盖旧义。

若原稿“未授权/未开工/owner待定”与后续已批准记录不一致，分别保留各自时点，使用明确后续批准判断当前授权。不得仅凭文件名含“草稿”否定已批准开发；也不得凭实现/PR已经存在反推未经记录的业务授权。原始不确定业务选择交Planner；纯状态以实际远程证据核对。

## 本轮读取的主材料

- Spec v0.12：[冻结副本](snapshots/spec-v0.12.md)，SHA256 `62af996b2d3136f34e17a86e5dd8887178addfee25cc572f355837ca5bf2af39`。
- 拆解 v0.12：[冻结副本](snapshots/tickets-v0.12.md)，SHA256 `fd4511a5ad5225d8b846f417035c24ac7879508fe0bb68ff0c6925ebbd1468f3`。
- 必要决策清单实际v0.12；覆盖矩阵实际v0.6；开发就绪差距报告实际v0.4。版本以文件读回为准，不把历史报告状态当当前完成状态。
- 找到的同步材料真实名称是`2026-11-16-脑生云llm-metadata-fork持续同步与维护边界.md`，状态proposed-for-planner。其定时、目录、发布及生成器参数示例是历史建议：当前实现先将原始USD归一为CNY，再用站内单位输出，不复制旧示例造成二次乘7；仅已确认布局和后续已审操作可作为当前决定。

快照内原Obsidian wikilink/frontmatter是原文的一部分，仍属于原vault上下文，不是本仓库待修复的相对Markdown链接；来源登记提供仓库可读入口。其余补充材料按原文件查询，不复制成另一套活正文。

## 后续用户批准的来源（不重新决定）

以下授权记录来自实施线程`8e06f49b-06f8-48e4-b20e-06b5092d3b46`实际原消息读回；messageId是内部追溯键，原消息访问受拥有者权限控制。PR/Actions只是执行证据，不能单独代替授权。

| 原消息/UTC时间 | 已批准内容 | 执行证据及界限 |
|---|---|---|
| `u9z3o25zqmdfbsyh2pmob53y` / 2026-11-16T09:55:54.610Z | “先做3吧，在这个组织仓库中做”并给出naoshengyun组织 | [组织fork与PR1](https://github.com/naoshengyun/llm-metadata/pull/1)；不是稳定价格源已经发布 |
| `cyknpwluwegdvceuplxa3j59` / 2026-11-16T10:25:57.076Z（宿主核实用户委派） | 按审查与规则集成原PR，独立配置，先审受控测试/候选CI；stg只准备方案 | [PR2](https://github.com/naoshengyun/llm-metadata/pull/2)、[PR3](https://github.com/naoshengyun/llm-metadata/pull/3)、[PR4](https://github.com/naoshengyun/llm-metadata/pull/4)；不部署/改价/付费调用 |
| `dkt89g3kod44n3jzkiwc1wja` / 2026-11-16T14:38:27.629Z | “如果PR审查没问题，就可以合并了” | 审查版本一致且规则满足可合并；不扩大为部署、价格发布/应用或付费调用授权 |

## 当前实现/证据核对点

- 业务分支基线`f3ec5b79121b6f165355b34da2d2865536abd9f3`，PR1—4均已合并；纯镜像main仍`d9f6cf3d1b643ac186f1be82dfcab754505a9343`。本次文档使用独立分支，不更改这些运行配置。
- 原D开发独立审查、原价维护及实际远程PR审查通过绑定各自固定版本，报告不外推新commit。62条可表达原价及53候选范围核验，不是116排除资料穷尽事实认证、全136可售或141差5已解释。
- 手动[CI run43855884901](https://github.com/naoshengyun/llm-metadata/actions/runs/43855884901)独立通过：54测试、离线固定候选构建/下载校验，绑定`f5e02bb28e93a2a57a25ff069ff267f9f98e4b5e`，不是后续文档提交的CI。仅手动测试/候选workflow，未启用PR/push/schedule/自动同步/价格发布。
- 原候选`18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138`绑定source`d5a84ca10d8599343370c1541828439a56b8dd1b`；CI候选`5390a70419ebf58e4b1fc3ca4844b3d2e946c97c04674881a6d80068f1f72ad3`绑定f5。二者身份不同，确认不可通用，完整包仍incomplete。
- D验收完成范围、原版离线算例、隔离I、实际供应商usage/真实消费/O/R分别解释；受控CI运行与代码合并都不是上线完成。实际stg/生产仍未执行。
- 当前工作流隔离、API409修订和真实运行细节只维护在[CI运行手册](../ci/CNY-CI-ACTIVATION.md)，不在本索引另造可执行步骤。[AC/Ticket/seam映射](CNY-TRACEABILITY.md)保留D/O/R边界。

本轮没有新增需用户重选的D业务问题。Planner已核对AC-24为Spec横向约束，原票未显式分配，不追加原票AC或新任务。尚未决定的运营策略和输入见决策索引；它们只阻止相应后续O执行，不回溯阻止T1—T7开发。

## 完整上游目录与合格CNY价格增量（Spec v2.0，2026-11-17）

用户已选择仅用固定上游、缺价明确标注，并同步发布全部合格价格。新规范正文/批准记录/固定b755基线及hash见[独立来源登记](catalog-publication-sources.json)，对应现有[#29](https://github.com/naoshengyun/llm-metadata/issues/29)，不另建实施任务、不为文档整理设阻塞。旧v0.12、PUB-AC和43模型首发仅保留历史，不覆盖；新CAT-AC适用本增量。目录完整50/616与合格原生API键数量分开，旧fixed永久保留。


## 统一完整目录与自有官方价目（#34）

当前需求、延期和条件放行分别由 [#34](https://github.com/naoshengyun/llm-metadata/issues/34)、[#35](https://github.com/naoshengyun/llm-metadata/issues/35) 与 [#32](https://github.com/naoshengyun/llm-metadata/issues/32) 维护。统一构建采用固定的完整上游目录和经明确选择的完整自有官方价目。上游起点、逐文件哈希、原价、选择与规则见下表。旧快照和固定发布保留原身份。

| 当前输入 | 存放位置 |
|---|---|
| 上游版本、英文/中文/日文目录与原生配置 | [固定 24d3f35c 输入](../../data/upstream/24d3f35c/source.json) |
| 自有官方原价与当前选价 | [原价目录](../../data/cny/official-catalog.json) · [明确选价](../../data/cny/proposed-selection.json) |
| 上游输入指针、精确延期、币种纠错与撤价历史 | [统一构建政策](../../data/cny/unified-policy.json) |
| 本增量构建行为与候选交接 | [ADR 0005](../adr/0005-unified-official-cny-candidate.md) |

## Naoshengyun service scope

2026-11-19，用户确认脑生云不提供上一轮列出的 34 个模型，因此停止逐一核价，并从对客价目及 New API 同步候选排除。范围绑定 [PR #58](https://github.com/naoshengyun/llm-metadata/pull/58) 复核后仍失败或缺适配器的 34 个原生计费模型名。精确清单维护在 [统一构建政策的 `notOfferedModels`](../../data/cny/unified-policy.json)。

核价结果与目录状态标记为 `not-offered`。同名供应商价目不参与自动或显式选价。模型目录保留名称和元数据并标明脑生云未提供，价格差异和既有证据保留审计用途。适用范围按脑生云业务决定执行。历史发布、厂商退役、正式撤价和 #35 延期各按原契约追溯。#42 与 #43 按更新后的范围验收，之后启动 #46。

2026-11-19，用户确认脑生云已停止提供 MiniMax `image-01`，且不售卖向量嵌入（embedding）模型。MiniMax 中国和国际站的 `image-01` 目录身份均标记未提供。当前固定目录内的六个向量嵌入模型同样标记未提供。此前已有同步价的六个原生计费键退出候选，既有报价和原生计量证据保留供查阅。精确原生计费键见 [统一构建政策](../../data/cny/unified-policy.json)。

用户同时确认停止提供 `devstral-latest` 和 `devstral-medium-latest`。两条别名标记未提供，旧同步价移除，结束本轮别名核价。

脑生云原则上只向客户提供厂商最新型号。按用户确认及智谱停用公告，将 `glm-4.5`、`glm-4.5-x` 记为已废弃。当前目录只收录 `glm-4.5`，未收录的 `glm-4.5-x` 同样记录在生命周期政策中，以备后续上游同步核对。用户确认 `glm-4.6` 停止提供，按服务范围移除现行报价。[智谱型号页](https://docs.bigmodel.cn/cn/guide/models/text/glm-4.5)

国内外 Coding Plan、Token Plan、Step Plan 等订阅套餐整体退出当前目录。统一候选按上游 `subscription` 标记移除供应商及其模型，覆盖清单、三语目录和供应商详情统一执行此范围，并跳过官方核价。同型号的官方按量价目继续按既有规则处理。固定上游输入和已归档发布按原身份保留。

`dashscope-anthropic` 归入阿里云百炼中国站 `alibaba-cn`，两条官方价目引用仍区分 Anthropic 端点和原始报价身份。[阿里云接入地址](https://help.aliyun.com/zh/model-studio/base-url)

旧混元平台已下线，`hunyuan` 和其 `hunyuan-a13b` 模型退出当前目录。腾讯 TokenHub 使用 `tencent-tokenhub`，旧 A13B 的报价留作历史证据。[腾讯下线公告](https://cloud.tencent.com/announce/detail/2287) · [TokenHub 迁移指南](https://cloud.tencent.com/document/product/1823/131382)

### 2026-11-20 Seedance 2.5 同步范围

用户确认 `doubao-seedance-2-5-260628` 仅同步 480p、720p 和 1080p。4K 官价继续展示，等待官方 New API 和 Doubao 插件适配该型号。真实计费纳入后续统一验收，原始 4K 验收条件见 [#32](https://github.com/naoshengyun/llm-metadata/issues/32)。

### 2026-11-19 已废弃模型复核

用户确认，官方标记已废弃的模型退出 New API 价格 JSON。当前三语目录保留模型身份，显示「已废弃」并隐藏现行价格。覆盖记录保留原价和生命周期证据，固定历史版本按原身份保留。已明确通过旧 ID 路由至另一模型的记录，按原模型身份处理，替代型号使用各自价目。

| 供应商 | 本轮去向 | 官方证据 |
| --- | --- | --- |
| MiniMax 中国 | 当前中国区按量文本价格目录省略 `MiniMax-M2`。按用户指定的收录口径停止同步，历史发布价留作参考。 | [中国区当前定价目录](https://platform.minimax.cn/docs/pricing/overview) |
| 火山方舟 | `doubao-seed-1-8-251228` 已下线，公告时间为北京时间 2026-09-21 14:00。 | [方舟模型下线公告](https://docs.volcengine.com/docs/ark/model-deprecation-notice?lang=zh) |
| Google | `gemini-2.5-flash` 已明确废弃，12 月 1 日起自动路由。原 `gemini-3.5-flash` 与 `gemini-3.7-flash` 已从 AI Studio 撤下，旧 API ID 路由至后续型号。其余八条保留现状，包括已公告最早停用日期的 `gemini-2.5-flash-image` 和 `gemini-3.1-flash-lite`。 | [Gemini API 生命周期](https://aistudio.google.com/docs/deprecations) |
| Mistral | 九个固定或具名 ID 和官方点名已废弃的 `magistral-medium-latest` 退出同步，包括已标记废弃、退役日为 2027-04-30 的 `mistral-large-2512`。三个滚动别名 `devstral-latest`、`devstral-medium-latest` 和 `mistral-medium-latest` 的当前指向仍需核实。两个 Voxtral Small ID 的模型卡仍标 GA。 | [废弃模型目录](https://docs.mistral.ai/models#legacy-models) · [生命周期与滚动别名](https://docs.mistral.ai/inference/model-lifecycle) · [Voxtral Small](https://docs.mistral.ai/models/voxtral-small-25-07) |
| OpenAI | 本轮八个旧 ID 均列在 2026-10-23 下线表。仍有效的 `gpt-realtime-2.1` 官方 Standard 音频输入、输出和缓存输入费率为每百万 Token 32、64 和 0.40 USD。价目已取得，独立音频缓存用量仍待原生计费支持。 | [OpenAI 下线公告](https://developers.openai.com/api/docs/deprecations) · [OpenAI 价格](https://developers.openai.com/api/docs/pricing) |
| Upstage | `solar-pro2` 与 `solar-pro3` 的官方价卡标记服务于 2026-10-30 韩国时间结束。 | [Upstage API 价格](https://www.upstage.ai/pricing/api) · [型号历史](https://console.upstage.ai/docs/models/history) |

逐原生键的证据网址及原始响应 SHA-256 记录在 [统一构建政策的 `lifecycle`](../../data/cny/unified-policy.json)。

### #61 发布后的 14 条价目复核

公网版本 `8ff03ab541ae38d166acaa6da2f92017e61768b7ff4f24758a99e4f42b48290b` 对应 #61 合并提交。24 个废弃型号在英、中、日目录均有标记，价格 JSON 只移除了这 24 个键与 `MiniMax-M2`，其余 216 条表达式和模式与 #60 逐键一致。

| 模型 | 核查结果 | 官方证据 |
| --- | --- | --- |
| `gemini-2.5-flash-image` | 价格页明确标记已废弃，停用日期为 2027-03-15。目录标记废弃，从候选同步 JSON 移除。 | [Google 价格页](https://aistudio.google.com/docs/pricing#gemini-2.5-flash-image) |
| `mistral-medium-latest` | 官方配置指南将滚动请求 ID 绑定到 Medium 3.5，模型卡同时列出该别名与废弃状态。退役日期为 2027-04-30。目录标记废弃，从候选同步 JSON 移除。 | [Vibe 配置](https://docs.mistral.ai/vibe/code/cli/configuration) · [Medium 3.5](https://docs.mistral.ai/models/mistral-medium-3-5-26-04) |
| `gemini-2.5-flash-lite`、`gemini-3-flash-preview`、`gemini-3.1-flash-lite` | 缓存音频分别为 0.03、0.10、0.05 USD／百万 Token。显式缓存存储另收 1 USD／百万 Token 小时。原生结算缺独立的音频缓存读及存储计量。 | [Google 价格页](https://aistudio.google.com/docs/pricing) |
| `gemini-3.1-flash-live-preview`、`gemini-embedding-2` | 各自独立的视频输入费率为 1、12 USD／百万 Token。当前结算参数不能区分视频输入用量。 | [Google 价格页](https://aistudio.google.com/docs/pricing) |
| `lyria-3-clip-preview`、`lyria-3-pro-preview` | 标准付费分别为 0.04、0.08 USD／首。上一版的零价表达式移除。原版没有这两个模型的生成歌曲计量。 | [Google 价格页](https://aistudio.google.com/docs/pricing#lyria) |
| `voxtral-small-2507`、`voxtral-small-latest` | 具体型号卡仍标 GA，官方列文本 Token、音频输入分钟及缓存分钟。原生同步缺分钟计量组合。 | [Voxtral Small](https://docs.mistral.ai/models/voxtral-small-25-07) · [Mistral Standard](https://docs.mistral.ai/inference/pricing) |
| `gpt-realtime-2.1` | 官方标准音频缓存输入为 0.40 USD／百万 Token。原版结算有合计缓存与单列图片缓存，缺单列音频缓存。 | [OpenAI 价格](https://developers.openai.com/api/docs/pricing) |
| `devstral-latest`、`devstral-medium-latest` | 退役的 Devstral 2 模型卡列出两个别名，公开工具调用指南仍列 `devstral-latest`。当时公开资料未能确认两者的 API 指向。用户现已确认停止提供，按服务范围移除价格。 | [Devstral 2](https://docs.mistral.ai/models/devstral-2-25-12) · [工具调用](https://docs.mistral.ai/inference/conversations/function-calling) |

已有官方费率的 10 条保留目录及独立的 USD 报价证据，标记为原生计费不支持并退出候选同步 JSON。能力证据采用固定 [New API rc.50 计量参数](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/pkg/billingexpr/types.go) 和[结算映射](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/service/tiered_settle.go)。#42 和 #43 仍有范围内价目缺口，#46 以两票验收为前提。

### #62 发布后的核价范围

用户确认，音频业务的核价和计量补证延期至脑生云计划接入时。现有官方报价证据保留，先前移出的音频价目继续排除在 New API 同步 JSON 外。混合模态模型的非音频计量条件仍按 #42 和 #43 的验收标准核对。

百炼 `qwen3.8-flash` 和 `qwen3.8-max` 使用各自的官方型号页，分别保留北京人民币和新加坡国际站原始美元费率及两种缓存模式。北京区域的在线隐式缓存报价进入统一候选。其他报价保留区域和缓存模式身份。完整来源和逐费率见 [官方报价目录](../../data/cny/official-catalog.json)。[北京 Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash) · [北京 Max](https://help.aliyun.com/zh/model-studio/qwen3-8-max) · [新加坡 Flash](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-flash#pricing) · [新加坡 Max](https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max#pricing) · [缓存条件](https://help.aliyun.com/zh/model-studio/context-cache)

OpenAI 已将 `gpt-image-1-mini` 标为废弃，并列出 2026-12-01 停用日期。目录采用统一的已废弃状态，该模型继续排除在同步 JSON 外。[OpenAI 下线公告](https://developers.openai.com/api/docs/deprecations)
