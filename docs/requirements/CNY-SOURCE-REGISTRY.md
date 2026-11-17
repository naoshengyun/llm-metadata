# 统一 CNY：需求、决定与证据的唯一来源

先读本登记，再解释范围、AC或决定状态。需求记录：[需求记录：统一 CNY 官方价格源已批准基线与来源追溯](https://github.com/naoshengyun/llm-metadata/issues/5)；决策索引：[决策地图：统一 CNY 价格源的已确认选择与后续验收边界](https://github.com/naoshengyun/llm-metadata/issues/6)。本轮是既有批准的文档补充，不重访谈、不重造Spec、不重新派发T1—T7，也不改变业务选择。

## 唯一维护来源与优先级

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

## 独立发布增量（2026-11-17；下列版本说明保留历史时点）

新发布正文由Planner维护于obs outputs/qa，v1.0的Spec、拆解、设计/授权及运营接入路径与hash见[发布来源登记](publication-sources.json)。仓库只留字节一致的固定快照与索引，不维护第二份活正文；原v0.12和AC-01—30不改。发布增量沿用PUB-AC-01—10。

[开发方案批准#17](https://github.com/naoshengyun/llm-metadata/issues/17)确认三票/S-H/D4可作为开发依据；实际Pages/许可/启用/部署/首发名单及实例/供应商操作仍未授权。GitHub执行票承载工作状态和依赖，规范变更先回obs升版本；不得用票实现结果倒改批准范围。

发布增量v1.1追加用户确认的PUB-AC-11页面全流程效果，原PUB-AC-01—10及v1.0快照不改。当前路径/hash/历史版本见publication-sources.json；#20页面适配待证为needs-info，#19独立格式开发保持ready，#21不新增页面AC。既有开发批准不等于运营页面端到端已验收。

v1.2后续决定：用户接受每次粘贴URL、保留原版，#22已关闭；#20需求齐备恢复ready，原票依赖不变。PUB-AC-11页面运行/实际应用仍未验收，写入仍需独立目标/selection与确认；关闭决定不等于关闭实现票。

发布v1.3技术事实修正：PUB-AC-02编号不变、原文明确修订（不是旧AC原文未变）。固定rc50对空message错误envelope可能标success却无可用所选价格；发布侧严格校验且valid H逐项核对全部选择/值，保留空message负例。历史快照不改，业务范围及无价格写入等边界不变。

发布来源登记v1.4仅提升运营接入正文至v1.4，其余正式正文仍v1.3并保持原hash。工具附加费显式零价已从原用户消息追溯确认，只授权文档记录/后续政策，非目标写入；官方quote/artifact非零报价保留。#19/#20已合并关闭，恢复不是#20原验收门槛；当前执行状态详见登记的executionObservation，不倒改历史快照。

## 发布开发阶段收口（2026-11-17）

发布开发完成，尚未真实部署。#18/#19/#20/#21均已合并对应实现并关闭；[原AC与父汇总回执](https://github.com/naoshengyun/llm-metadata/issues/18#issuecomment-6946813733)，[既有地图回执](https://github.com/naoshengyun/llm-metadata/issues/6#issuecomment-6946855090)。当前版本/hash及固定QA报告见[发布登记](publication-sources.json)的executionObservation；Spec/Tickets/design/UI事实仍v1.3、运营v1.4，本轮未改正文或冻结快照。#6/#10/#11仍OPEN；真实O余项不否定开发完成。恢复非原开发门槛，不授权恢复/清理；既有发布前待项见[当前入口](../planning/CNY-PUBLICATION-FRONTIER.md)。
