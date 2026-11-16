# #10：最小配置集成输入与 #11 确认材料

记录日期：2026-11-17（Asia/Shanghai）。对应[输入记录 #10](https://github.com/naoshengyun/llm-metadata/issues/10)与[应用/恢复确认 #11](https://github.com/naoshengyun/llm-metadata/issues/11)。本文件落实[已审 stg 方案](CNY-INTEGRATION-ACCEPTANCE.md)中的配置集成子集，不改[唯一需求来源](../requirements/CNY-SOURCE-REGISTRY.md)、原 AC 或 T1—T7；不是新的可售清单。

用户经 Planner 批准先查隔离目标与最小条件，并允许既有授权内可逆本地验证。本轮亲自准备本地 I 夹具、初始化临时身份并只读核验；没有应用候选价格。是否采用此目标执行下一批应用仍交 #11 明确确认，#10/#11 均不因本材料存在而自动关闭。

## 已查明的环境事实

开始时 `docker ps -a` 无实例：旧随机端口 I 容器已经清理，不能复用为现存业务 stg。缓存官方镜像可复用，故在本机准备下列全新、独占的本地 I 夹具。环境回执与脱敏原生结果见[固定证据](evidence/2026-11-17-local-I-inputs.json)。

| 输入 | 现场值 / 边界 |
|---|---|
| 执行电脑 | MacBook Pro (3)；远程操控客户端 Mac mini 的 localhost 不是此目标 |
| 实例名 / 完整 ID | `cny-input-b6c04a124f63` / `d78bb43d13ec8b974b8d9c827bc4a0f2fa9d0de1ce64b357c5e98f09ae1de16f` |
| 原生 origin | `http://127.0.0.1:51678`，仅宿主 loopback 暴露 `3000/tcp` |
| 运行版本 | `/api/status` 读回 `v1.0.0-rc.50`；OCI revision `f2aa91232ed3e5878a614762ace6736a2b74257f` |
| registry reference | `calciumion/new-api@sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9` |
| 实际 Image.Id | `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9`；独立读取该字段，不由 digest 推算 |
| 数据与副本 | 单容器；`HostConfig.Tmpfs={"/data":"rw"}`，SQLite `/data/new-api.db`；无 bind mount、无共享数据库、restart=no |
| 网络 | 独立 bridge `cny-input-net-b6c04a124f63`；它有出网能力，**未宣称网络断网**。不创建供应商渠道、上游 Key 或中继请求；原生渠道数实际为 0 |
| 可用测试身份 | 全新实例的 `cnyinput`，user id=1、role=100；凭证仅在本机受控临时文件（0600），不进仓库、Issue 或报告 |
| 使用者 / 独占 | 本任务 Dev 使用；不共享凭证、不允许其他写入者。QA可独立读取脱敏证据；需要 live 读回时走受控本机方式 |
| 生命周期 | 目前保留运行以等待具体确认。停止/删除会丢失 tmpfs；实例、端口或配置变化均使本次目标/基线失效，必须重查，不复用旧确认 |

这不是业务 stg 的发现或部署证明，也没有对其他电脑、远程服务器或生产实例作否定断言。本机只读参照 new-api 工作树实际为 `f36c460f0e86bb814c88642daf3e4764a3886a8a`，不是本次固定原版；本轮未修改它，契约查询均显式取固定 `f2aa912...` Git 对象。

本轮探索中 internal network 未能提供发布端口；随后 network=none 的客户端探测发现镜像无 `/bin/busybox`。失败临时容器及专用网络均已清理。最终采用既有 I 的 loopback/tmpfs 条件；没有把失败的断网方案记为通过。只读选项比较先按 key 排序，避免把 Go map 返回顺序变化误判成配置改变。

## 固定候选及四项建议选择

使用原已审候选，不重建、不换为 CI 产物：

- sourceSha：`d5a84ca10d8599343370c1541828439a56b8dd1b`。
- artifactId：`18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138`。
- artifact.json 文件 SHA256：`f2f6540a24b7730b1d2122c5cba1c5904d5797a715dcb97c2d75d6ee624ab914`。
- dataHash `4e0f8d173d474ab557ea2478b83cab79c440ca7ce7319943d787ecace51df0fe`；quotesHash `3ca6ce10b2cece6dd905769d8358ab8333b9f8a384e83ff87a8a63010a9c981b`。
- policyHash `9f0b4e409d6d48fd4c6955f2693010df0edf70d022143edb2509e96c8a577ec7`；三个完整分区 hash 见固定证据。`verifyArtifact=true`，`complete=false` 原样保留；原 136 参考与排除项不裁成四项。

CI 候选 `5390a704...` 绑定另一 sourceSha，不能通用确认。本批只验证固定历史报价的配置契约，不认证 2026-11-17 官网现价、供应商仍可调用或可售状态；后续真实调用仍须重核时效、退役和促销条件。

| 分区 / 原生计费名 | 明确选用官方记录 | 拟验证内容 |
|---|---|---|
| model `kimi-k3.1-pro` | `cn-moonshot-kimi-k3.1-pro-standard` | 原始 CNY13/68；cache read1.3、write5m13/1h26；不做二次×7 |
| model `claude-sonnet-4-5` | `us-anthropic-claude-sonnet-4-5-standard` | 原始 USD3/15 单次×7→CNY21/105；cache read2.1、write5m26.25/1h42 |
| plugin `doubao-seedance-2-0-fast-260128` → `doubao` | `volcengine--doubao-seedance-2-0-fast-260128--cn-beijing-task-online-original` | 原生现存 profile：480p/720p、tokens 单位 token、video_input=none/video；金额22/37 CNY/M，`u("tokens") / 1000000` |
| tool `search_std` | `cn-zhipu-search-std-standard` | CNY0.01/次→10/千次；与模型 Token、插件表达式分区 |

两模型只拟选 `billing_setting.billing_mode` 与 `billing_setting.billing_expr`；插件只拟选该 model 的 `billing_setting.plugin_billing_expr.doubao`，管理输入为 `plugin→expression` 对象；工具只拟选 `tool_price_setting.prices.search_std`。完整原生表达式及 profile 见证据，按字节/结构核对，不重新手抄生成另一价格包。

本批没有中继流量：模型名直接作为原生配置主键，任务型号到 doubao 的声明已实际 GET 核实。渠道、上游账户、对客 alias 和分组绑定不参与这条配置 I 路径，也不写入；这些真实业务映射仍未知，不能凭本批填为已完成。无需生产路由、全136配置、供应商账单或付费预算才能准备这条路径。供应商调用预算为零。

## 单位、字段基线与预期读回

| 项目 | 实际基线 | 下一批拟动作 / 成功判据 |
|---|---|---|
| `USDExchangeRate` | `7.3` | #11 须明确包含此临时夹具的前置配置 `7.3→1`，随后 GET 确认。价格适配器本身不改单位 |
| `QuotaPerUnit` | `500000` | 只读保持；不得改为别值 |
| `GroupRatio` | `default=1,vip=1,svip=1` | 全程保持；本批不建0.8组、不验证真实消费或 A＜B＜C |
| 三个原生 model 的 configured | 显式 `?model=` 查询均为 `{}`，不是“默认免费” | 两模型读回所选 mode/expr；视频模型只增加 doubao 插件价，未选配置键不变 |
| 三个版本 | `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a` | 应用时用 fresh GET 版本，不把本表旧版本当可重放写凭证 |
| `tool_price_setting.prices` | 已配置全表 `{}`；不据此推断内置 effective 价格为0 | 取得独占后 fresh GET/合并/PUT，拟读回 `{"search_std":10}`，其余键保留 |

已执行 `previewArtifact`：因单位7.3按契约拒绝，消息为 `target unit settings require USDExchangeRate=1 and QuotaPerUnit=500000`。这证明当前不是可直接应用状态；未绕开检查、未手工制造成功 planId。另经原版 `POST /api/option/model_pricing/preview` 分别验证三个完整草稿可接受且 effective 包含原值；该端点在固定源码中无写副作用。两个检查目的不同，原生草稿能解析不等于 CNY 应用预检已通过。

## #11 的具体操作提案（尚未获执行确认）

请 Planner 就以下一项完整意图向用户确认：**采用上表这个临时本地 I 目标，在零供应商调用下，允许把其 USDExchangeRate 从7.3设为1，并将固定候选的两模型、一个 doubao 插件变体与 search_std 四项价格应用、逐项读回。** 不包含其他实例、渠道/别名、分组、全53项或价格源发布。对本地夹具选择也不冒充真实业务 stg 选择。

确认后 Dev 应按以下边界执行；当前仅准备：

1. 重新检查执行宿主、容器完整 ID/运行镜像/origin/tmpfs/端口/零渠道/身份及完整价格/选项基线；任何目标或配置漂移先停并重呈差异，不沿用确认。检查原候选文件与全部身份 hash。
2. 在确认明确覆盖单位前置动作后，单独设置 USDExchangeRate=1 并读回。QuotaPerUnit 和 GroupRatio 不写；单位操作不混称为 T7 价格字段写入。若单位失败/未知，先读回，停止后续价格应用。
3. 再以 fresh GET 调用 `previewArtifact`，固定实际 planId、目标、候选、选择集合及授权消息/运行时 actor。用户意图必须明确覆盖此目标/四项/单位动作；不把“继续准备”转成 confirmed。预览出现超出所列基线/预期的变化则另行确认。
4. 模型及插件逐项 PATCH 完整合并草稿、携带 fresh expected_version；工具由 Dev 保持覆盖最后 GET→PUT→读回的独占窗口，凭证只由此任务使用、无其他写入客户端。独占不能保证则停工具分区并报告部分完成，不伪称全成功。`prices` 必须全表 fresh 合并，不能只拿候选表覆盖。
5. 模型、插件、工具及单位不构成全局原子事务。逐项记录 applied/conflict/failed/mismatch/unknown；409先 GET、不强盖；超时先读回是否已提交，不盲重试；未能判明则保留 unknown。未选键、GroupRatio、QuotaPerUnit 逐项对比保持。

## 恢复准备与未决边界

应用完成后先展示实际结果与 fresh 恢复预览，**配置恢复需要新的明确确认**，不因这份预案自动执行。保留此目标以便核对；若用户仅选择销毁夹具，则销毁是测试环境清理，不能报告为价格字段恢复演练通过。

- 两模型：从恢复时 fresh 完整 configured 中只移除本次选中 mode/expr，恢复原“未配置/继承”状态；保留新出现的未选键。插件：仅移除本次 doubao override，保留其他插件；空映射按原版语义移除相应字段。使用 fresh expected_version，不能重放旧 version，也不用0或空表达式冒充 unset。
- 固定原版 `model/model_pricing_config.go` 的 PricingValues 注释与 replaceModelPricing 明确缺 key 继承、显式0免费、完整 draft 替换；这是已核对的**静态契约**。本目标动态 unset/恢复尚未运行，是后续恢复验收项，不写成通过；若原生实际删除不符，停止并保留现场/差异，不自行扩展接口。
- 工具：独占窗口内 fresh 全表只删除本次新增 search_std，恢复其原先未配置状态，保留别人的未选键；本基线全表原为 `{}`，但不能把旧 `{}` 盲 PUT 到发生漂移的新表。无 CAS 限制不变。
- USDExchangeRate：若后续明确确认恢复整个测试前口径，应在价格恢复并读回之后，独立恢复7.3并读回；不得在仍有本次 CNY 覆盖生效时先改回。恢复完成不重算历史消费，也不涉及软件镜像回滚。
- 真实业务 stg 的目标/渠道/alias/usage/TTL归一化、消费/钱包/账单关联仍未知；这些只阻止对应真实调用/O路径，不阻止本次配置 I 准备。以后启用真实流量须独立明确目标与预算，本批不扩展到它们。

## 检查、AC 与接续责任

执行源码固定于已合并 `fa00f2263dec29308edfad9e4fa3899f3f56ba66`；本轮只新增文档与脱敏证据，不改该源码、报价或候选。个人执行证据目录 `/tmp/cny-stg-inputs-20261117/`，manifest 只枚举非秘密文件，排除 `runtime-private.json`；不要打包该目录全部内容上传。

| 检查 | 本轮结果 / 证据强度 |
|---|---|
| `npm run test:cny` | 本机54/54；不是新 GitHub Actions run |
| 固定候选校验 | verifyArtifact=true；原 source/id/file/manifest hash 核对；未重新生成或覆写 |
| rc50 / plugin profile / 目标身份 / 三草稿 preview | 真实本地原生 GET/只读 POST 通过；准备阶段全价格与选项按规范化 key 比较不变 |
| CNY 应用 preview | 正确拒绝默认7.3；未设置单位，未产生可应用成功确认 |
| 应用/保存读回、工具 PUT、409/超时、动态恢复 | 本目标均未执行；既有固定版本 I/A 证据不冒充本轮执行 |
| 消费、供应商调用、账单、生产 | 均未执行；调用数0，无 O/R 通过结论 |

沿用 [G/S/A/I 与 AC 追溯](../requirements/CNY-TRACEABILITY.md)：候选身份/选择/原币及单位为 AC-01/02/03/04/08/13/16/21/26 的适用配置部分；拟应用/逐项读回为 AC-11/22；工具为 AC-15/30，视频插件为 AC-28。这里是本批覆盖说明，不新增原票 AC 归属、不把所有这些 AC 的 O 部分标完成；本轮没有新增测试 seam。AC-09/10 的真实10500/8400扣费不在本批，原18平台136参考、141差5和 packageComplete=false 原样保留。

接续：Planner核对本批配置 I 范围并取得上述具体 #11 意图；Dev在原任务执行获准动作、保留可复核证据；既有 QA 任务独立审查本材料及以后真实执行结果。#10 保持输入待确认状态，#11 保持未应用/未恢复状态；仅准备好文档不关闭记录。
