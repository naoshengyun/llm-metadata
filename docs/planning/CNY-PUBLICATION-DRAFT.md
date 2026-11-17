# 稳定 CNY 价格源：发布增量与决定地图草稿

状态：2026-11-17 planning-only，待用户确认业务选择、测试位置及拆票粒度。不是 ready-for-agent Spec，不授权实施/部署/公开端点/定时/改价。主地图仍为[统一CNY决策地图](https://github.com/naoshengyun/llm-metadata/issues/6)。

## 来源与新增范围

原规范仍为[来源登记](../requirements/CNY-SOURCE-REGISTRY.md)所指 obs Spec/Tickets v0.12；AC-01—30、T1—T7及冻结副本不改。本轮用户经Planner明确授权：先整理地图，再准备稳定发布规划/执行票，发布后推进运营真实配置与调用验收。**稳定发布从旧地图的out-of-scope移入本轮新增规划范围**，没有倒算为原T1—T7已批准内容。本文为待Planner核对的派生增量草稿，批准后由Planner确定其正式维护位置及tracker入口，避免产生另一份原Spec。

## 已完成与后续余项

| 路径 | 当前证据 / 关闭条件 |
|---|---|
| 原价格源开发、原价维护、手动候选CI | 已审固定版本；仍保留完整包incomplete及来源缺口，非全136可售 |
| 本地配置I | 四项应用→读回→新确认→恢复/读回均独立QA PASS；原279项、配额/组保持；实例原基线留存，不清理 |
| 真实业务输入 | [所选stg目标与实测条件](https://github.com/naoshengyun/llm-metadata/issues/10)继续OPEN；关闭需获选真实目标/版本/协议/渠道/alias/schema、受控身份及对应调用条件，不要求全136 |
| 真实业务意图与执行 | [实例应用与恢复意图](https://github.com/naoshengyun/llm-metadata/issues/11)本地子集闭环，真实业务余项OPEN；需对应目标/固定候选/选择/新确认与实际结果，不复用本地授权 |
| 稳定发布 | 新增规划；托管、首版选择与发布授权尚未决定，不依赖前两项O全部关闭才开发 |

I独立证据：应用报告 `calm-cohen/qa-evidence/local-I-application-20261117/REVIEW.md` SHA256 `4ccf1a72dd566f5c92eafa8831bda8e13ffe7bc2cbb89aa044474da9d04cf857`；恢复报告 `calm-cohen/qa-evidence/local-I-restoration-20261117/REVIEW.md` SHA256 `1d5b6d11c213c13295e3ebfb52563bae68f4ebc18fddcd206f564c9896b6f432`。完整回执在[恢复记录](https://github.com/naoshengyun/llm-metadata/issues/11#issuecomment-6934368738)。I不等于真实usage/消费/账单/O/R。

## 发布决定地图（草稿，未替人作答）

| 决定 | 类型 / 状态 | 必要前提 | 建议及后续依赖 |
|---|---|---|---|
| PUB-D1 托管与稳定入口 | HITL，待定 | [事实清单](CNY-PUBLICATION-FACTS.md) | 推荐现有组织仓库的GitHub Pages，不用新外部服务/自定义域；D4权限取决于此选择 |
| PUB-D2 版本、选择及完整性 | HITL，待定 | 已有manifest/固定候选能力 | 推荐显式选中子集，保留全参考/排除项，标partial；首版精确条目与hash在发布前另展示确认 |
| PUB-D3 更新方式与核价 | HITL，待定 | 原币/核价日期政策已定 | 推荐人工核价PR、手动发布，无cron；核价责任/频率/SLA待运营细化，不先造永久新鲜度承诺 |
| PUB-D4 权限与运营接入 | HITL，建议可描述，待D1 | D1及原生格式事实 | 审查后单独审批发布权限/部署保护；实例应用与发布分开，模型URL与插件/工具步骤分开 |

依赖：D1→D4；D2/D3可独立选择。D1/D2/D3及测试位置/票粒度明确后，才能形成可执行发布Spec/Tickets。发布后运营验收仍回原#10/#11，不能把其整体OPEN变为开发硬前置。

### 推荐的可评审方案（尚未选择）

托管建议使用现有public仓库Pages，候选入口形状 `https://naoshengyun.github.io/llm-metadata/cny/v1/`，**现在不存在且本轮不创建/请求该端点**。备选为现有GitHub Releases下载包（无需Pages，但需另定稳定指针与重定向/缓存契约）；已有公司域名只有查得归属和部署约定后才纳入，不默认存在Cloudflare账户或上游站点权限。

版本目录建议以releaseId固定：绑定原artifactId、sourceSha、全分区hash、发布选择、适配器版本及输出文件hash；适配器改变必须产生新的releaseId。旧版本禁止覆盖、删改；GitHub管理员技术上仍可修改托管内容，消费者必须校验hash，不能把URL称为密码学不可篡改。

建议入口区分：`current.json`是稳定发现指针；`versions/<releaseId>/`是固定内容；模型原生同步专用稳定JSON是另一个消费入口。new-api不认识current指针，不能直接把它当倍率源。稳定模型JSON与指针应在同一部署快照中由同一已验证版本生成；缓存可能让不同请求读到不同部署，严格绑定时从指针取得固定版本URL，不承诺跨请求全球原子。回退提升旧已验版本，保留历史目录；回退发布入口不等于恢复任何实例价格。

首版不直接沿用“53候选=发布53项”，也不把四项I测试视为可售名单。推荐支持显式子集发布，保留全18平台136原参考、缺5资料注记及全部excluded；缺字段/混币/无schema条目拒绝。若用户要求全平台完整发布，则complete=false必须阻止该模式；子集模式也必须显示complete=false及selection，不制造全量成功。核价日期仍为来源日期，构建/发布不能刷新它。

## Spec 增量草稿

### Problem Statement

运营已有可追溯候选和本地导入证据，但没有已确认的长期公开源、稳定版本发现、受控提升/回退及分区接入说明。短期Actions附件不是稳定价格源。

### Solution

提供由明确选择和审阅记录产生的固定版本包、稳定发现及模型消费入口；运营先预览差异再选择应用。插件与工具随同一版本包交付，按已有原生接口独立配置。发布过程不写采购渠道、别名或分组倍率。

### User Stories

1. 作为运营，我要看到版本、来源日期及选中条目，判断适用范围。
2. 作为运营，我要按固定版本URL读取模型价，避免确认期间内容变化。
3. 作为运营，我要知道哪些插件/工具需另行配置，避免漏费误成功。
4. 作为维护者，我要显式选择子集并保留排除项，避免complete=false被隐藏。
5. 作为审阅者，我要看到新旧语义diff和来源/输出hash，核对发布意图。
6. 作为维护者，我要候选通过后人工提升稳定入口，失败时保留旧入口。
7. 作为维护者，我要可回退到已验版本，保留发布/回退记录。
8. 作为运营，我要将源回退与实例恢复分开，避免错误重放配置。
9. 作为维护者，我要核价与上游代码同步分开，避免自动变成最新官方价。
10. 作为安全负责人，我要发布权限独立于只读测试，避免继承上游定时路径。

### Implementation Decisions

沿用固定候选、原价政策、native rc50和三分区契约；模型源发布适配需补齐原生success envelope，不能默改旧artifact。发布manifest覆盖原候选身份及实际HTTP输出hash，明确full/partial模式；完整包语义和来源日期保持。发布环境、触发和权限在D1—D4确定后固化；不以本草稿代为批准。

### 新验收编号（草稿，不覆盖AC-01—30）

| 新AC | 可观察结果 | 拟测试位置 / 依赖 |
|---|---|---|
| PUB-AC-01 | 同一固定输入/选择/适配器得到同一releaseId与内容；旧版本拒覆写 | S；复用原AC-21身份，不重定义 |
| PUB-AC-02 | 原版URL消费接受success/data和模型expr，错误envelope/缺分区拒绝；不冒称插件/工具已导入 | S+H（新位置待确认） |
| PUB-AC-03 | 子集显式列selected/excluded/complete；full模式拒绝incomplete；保留136参考及缺5状态 | S；原AC-24横向D不变 |
| PUB-AC-04 | 文件inventory/hash/manifest一一绑定，缺文件/错字节/混版本拒绝 | S+H |
| PUB-AC-05 | 稳定指针和模型源来自同一版本；失败保留旧入口；固定URL内容不变 | H |
| PUB-AC-06 | 新版本提升、旧版本回退都有确认身份/diff/读回，不向实例写配置 | S+H |
| PUB-AC-07 | 默认只手动、最低权限；无push/cron发布/上游自动合入；缺确认不能提升 | S/确定性平台mock；真实托管运行另获授权 |
| PUB-AC-08 | 运营说明分别给出模型URL、插件对象、工具千次单位/独占及目标CNY预检 | S/文档；已有A/I证据关联 |
| PUB-AC-09 | 发布保留原始核价时间，发布/构建/同步不刷新官网核价状态 | S |
| PUB-AC-10 | 来源回退不标实例已恢复；接入结果区分下载/配置/调用/可售 | S/H及文档；真实O不在开发闭环 |

### Testing Decisions（待用户确认）

复用S：固定产物/schema/语义diff、拒覆写与负例；现有官方快照和CI包完整性测试可提供先例。**新增H建议**：本地静态HTTP fixture下载固定版/稳定入口并由隔离原版rc50的上游fetch/preview路径读取，验证源URL与完整envelope；这不是供应商调用，也不是旧I保存读回已覆盖的新结论。HTTP失败/缓存混版/缺文件用确定性响应；平台提升/权限用mock。原I仍只按获准配置导入读回范围解释。真实Pages部署/公开GET、运营目标应用和消费测试分别另获执行授权，不算已通过。H位置与票粒度未确认前不发布ready-for-agent票。

### Out of Scope

原Spec改写；new-api核心/升级/新插件meter/业务代理；全136补价/调用与泛化异步恢复；采购渠道/alias/组管理；本轮部署/定时/公开价格端点/真实供应商和生产；实例清理。不能从方向批准推断首版条目、长期核价承诺或发布执行权。

### Further Notes

[候选执行票](publication-tickets/README.md)只供粒度确认；[运营接入草稿](CNY-PUBLICATION-OPERATIONS-DRAFT.md)供核对。批准后由Planner形成正式增量记录，再发已配置GitHub tracker；建议后续implement-spec/tdd，完成独立审查后再申请真实发布动作。
