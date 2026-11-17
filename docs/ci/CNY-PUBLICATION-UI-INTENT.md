# PUB-T02 原版页面应用意图材料（待确认）

本材料保留授权前提案原范围；2026-11-17后续明确用户确认及实际执行已另记[执行记录](CNY-PUBLICATION-UI-EXECUTION.md)。下文“待确认/未授权”属于提案时点，不推翻后续授权，也不延伸为恢复授权。

这是 #20 / PUB-AC11 的具体本地测试提案，不是已经取得的保存授权。此前用户登录成功、后续测试身份登录维护许可及 #19/H 通过均不代替价格保存确认。先完成独立审查和fresh漂移检查，再由Planner取得具体意图；收到之前保持零价格写入。

## 固定目标与候选

- 宿主：MacBook Pro（3）；仅临时实例 `cny-ui20-e3d6b71ed592`，`http://127.0.0.1:53836`。
- 完整容器ID：`d08f09905ec5498a71b5305e9c87df8ffb6a58194b4e34a2170338271923660d`；StartedAt `2026-11-17T06:55:40.719764305Z`。2026-11-17只读结束再次inspect仍running、同ID/启动时间、仅127.0.0.1发布、`/data` tmpfs、无bind。
- 固定官方rc50：image `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9`，OCI `f2aa91232ed3e5878a614762ace6736a2b74257f`，页面v1.0.0-rc.50。
- 临时身份cnyui / id1 / SUPER_ADMIN；复用已登录受控浏览器。秘密仅留本机受限文件，不进入仓库、Issue、日志或审查附件。
- 测试包release `67249fee2a6946d6a4b1d8fe32aa3892a744e10f0cefbc922d2384bd4591e187`；manifest SHA256 `99982caa63031a33d17f53e28f3587a1a4be410e90ea254e405375acf709eb1e`；旧artifact `18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138` / file SHA `f2f6540a24b7730b1d2122c5cba1c5904d5797a715dcb97c2d75d6ee624ab914`。
- 完整页面输入URL：`http://host.docker.internal:53833/versions/67249fee2a6946d6a4b1d8fe32aa3892a744e10f0cefbc922d2384bd4591e187/ratio_config.json`。仅本机测试服务，非Pages或首发入口。
- 包含两模型、doubao插件和search_std工具分区，partial/test/complete=false；本提案**只保存两模型和单位前置**，插件/工具只查入口。测试选择不是首发选择。

准备进程来自a6d8538；d087536修复后，独立QA确认正常四项包所有文件字节、release与manifest完全相同。此次不把准备进程旧commit伪记为新代码执行；正式应用前再次按固定身份验证实际下载包。

## 拟批准的实际页面动作

1. fresh核对同宿主/完整ID/镜像/StartedAt/临时身份、完整配置与下列基线一致；任何实质漂移先停止并报告差异，不重建替代目标。
2. 原版“货币与展示”仅把美元汇率USDExchangeRate由7.3改为1并保存、读回。显示模式保持USD，QuotaPerUnit=500000、Group及其他options保持。CNY数值作为站内金额口径，不再次×7或使用页面乘除按钮。
3. 原版“模型定价 → 上游价格同步”重新粘贴上列URL、拉取，逐个选择且仅选择下表两模型。预览逐字段核对之后，点击“确认更改”，保留请求结果及页面证据。保持来源价格。
4. 原版页面刷新/重新打开并核对实际结果；辅助fresh GET精确核对configured、版本与完整未选字段，记录配置请求顺序。不得以成功提示或空diff代替两条完整值。

| 原生模型 | before | after：仅写mode/expr |
|---|---|---|
| kimi-k3.1-pro | configured `{}`，无mode/expr override | `tiered_expr`；`tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)` |
| claude-sonnet-4-5 | configured `{}`，无mode/expr override | `tiered_expr`；`tier("standard", p * 21 + cr * 2.1 + cc * 26.25 + cc1h * 42 + c * 105)` |

两模型原empty_version均为 `44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a`。原279项价格配置/版本保留，预计增加两项override；不修改其他模型、插件、工具、渠道/别名或分组。原工具override `{}`、Group default/vip/svip均1、channels0保持。请求以原版页面fresh版本与冲突机制为准，不用CLI/API代替保存，也不强盖409。

## 预检、失败与后续恢复

原完整pricing hash `b89dbb0d98f4226b04f61cdd9d0bb6f0f8ca9fb749c02fb85acbe30f1c2cefb6`；规范化options hash `83f452792752b553d3b44380b4474873ab8e71158c8d795aebd898a4f73a7cbb`。只读UI验证后再次GET仍完全相同。fresh检查应留全options数组顺序及安全字段，避免仅有规范化hash导致历史身份不可重算。

单位保存成功而模型失败属于部分成功；保存响应超时先读回，再决定状态，不能盲点重试或报整体成功。冲突先读回并提交实际差异。保留每次实际请求/返回及中间状态；任何额外写入需求重新确认。工具未纳入本次写入，无工具全表PUT；以后如纳入须独占窗口、fresh全表合并、无CAS限制另确认。

应用后先交既有QA独立验收，并形成fresh恢复预览：仅删除这两模型新增mode/expr override、验证恢复继承/未配置且原279项保持，然后才USD1→7.3；**恢复需要单独的新用户确认，本提案不自动执行恢复**。不销毁实例或清理旧I、不发起供应商/真实消费/生产/部署/定时。页面配置I完成也不等于业务stg、计费账单或O/R验收。

证据与阶段矩阵见[页面验收矩阵](CNY-PUBLICATION-PAGE-ACCEPTANCE.md)。#20保持OPEN、PR24保持draft，#21继续blocked；保存与读回及独立最终验收未完成前不得关闭或合并整票。
