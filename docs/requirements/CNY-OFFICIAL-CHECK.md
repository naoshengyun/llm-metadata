# 官方核价入口

在仓库根目录构建固定候选，再运行官方核价。输出目录须尚不存在。核价时传入要检查的已发布版本所对应的固定候选。本地验收可以传入待验证候选。

```sh
npm run cny:unified:build -- /tmp/cny-unified
npm run cny:official:check -- /tmp/cny-unified /tmp/cny-official-check
npm run cny:official:check -- /tmp/cny-unified /tmp/cny-official-recheck /tmp/cny-official-check/official-check.json
```

`official-check.json` 关联统一候选 ID、源码提交及覆盖文件哈希。`results` 逐价目记录覆盖状态、是否选中、已发布报价证据、本次核查状态以及最近尝试和成功时间。传入同一固定候选的上次报告，可以在失败后保留该价目的成功时间。跨版本和晚于本次尝试的上次报告会被拒绝。响应原始内容保存在 `responses/`，报告记录请求 URL、最终 URL、响应哈希及取得时间。HTTP 错误、无响应、价目缺行和无法验证收费条件均记为失败。

`changes` 提供可审查的原价、派生 CNY 基础价、计费单位、收费条件及正式生效时间。完整且可表达的报价附 `candidate.record` 供统一构建验证。新增上游外的自有价目仍需明确审查及选价。未来价和有证据的撤价分别记录。撤价需要按统一构建政策审查并登记持久撤价事件。检查成功时间和响应哈希变化本身不产生改价候选。

## 新增适配器

为每份官方响应在 `scripts/official-sources/` 添加独立模块并导出 `adapter`。模块声明唯一的 `id`、官方公开 GET `url`、可选的重定向 URL 清单 `allowedFinalUrls`，以及 `targets`。目标填写固定覆盖清单里的 `quoteId`、`providerId`、`endpoint`、`modelId`、`priceList`、`currency` 和共享收费表的 `group`。`baselineIdentity` 可以声明经过核实的旧目录映射，例如同一官方端点的上游通用价目名。`baselineConditions` 可以声明旧版本仅以文字保留的收费条件。 同一厂商的独立官方型号页也可以由一个模块导出 `adapter` 数组。每个适配器分别获取和校验响应，单页不可用只影响该页的目标。

`parse({ body, evidence })` 从响应字节静态提取，返回以 `quoteId` 为键的 `Map`。每条报价包含精确 `identity`、完整 `sourcePrice`、`sourceUnit`、适用收费项 `required` 和结构化 `conditions`。金额保留官方币种。任务价按现有任务用量契约提供完整收费阶梯。`effectiveAt` 必须带时区。正式撤价须返回精确身份及 `withdrawal.statement`，引文须能在实际响应中找到并明确撤销该价目。某条解析失败可以返回 `{ error }`，缺行也会被核价入口判为失败。一个共享收费表的选中报价验证失败时，该表的候选整体被拒绝，独立的报价仍可参与核查。

适配器应以新的固定官方响应测试正常与异常情况。当前 Kimi 适配器通过 TypeScript 语法树读取官方页面内嵌表格中的静态属性，从中国站标准同步价目提取六个精确型号，并保留 Batch 价目为独立覆盖记录。其他适配未接入的记录显示 `not-registered`。延期、订阅及既定币种排除沿用覆盖清单。

## Kimi 固定响应

两份 Gzip 夹具解压后都是 [Kimi 中国官方同步价格页](https://platform.kimi.com/docs/pricing/chat) 的完整历史响应字节。

| 核对日 | 解压后 SHA-256 |
| --- | --- |
| 2026-11-16 | `9afe502615e0e0b9568f46545dd5fb5b4fb442b30e6c090ae0ba0d1373a63ffa` |
| 2026-11-18 | `a19a8f3f9c0a456384a58ea85d88081b2b80c065a34ad488cc5324850467529a` |

运行 `npm run test:cny` 可复现两份真实响应的同价回归，以及从固定响应构造的改价、缺字段、结构变化和错误场景。正式未来价与明确撤价使用结构化测试响应。测试产生的拟变价仅作本地候选校验。

适配器需要多个官方文件才能核对同一价目时，可声明
`supplemental: [{ id, url, allowedFinalUrls }]`。每份文件经相同的 HTTPS GET、最终地址和
响应时间校验，原始字节以 `<adapter-id>--<id>.body` 保存，并记录独立响应哈希。
`parse({ body, evidence, supplemental })` 的 `supplemental` 为按短 ID 索引的 Map，
每个值包含响应 `body` 和 `evidence`。任何必需文件获取失败都会使该适配器本次核价失败。
拟议价目的 `source.supplemental` 保留这些官方文件的 URL、哈希和日期。

`targets` 可用 `referenceOnlyReason` 标明已成功提取、但完整收费条件超出现有原生计费能力的价目。这些结果以 `unsupported` 报告。未到正式生效时间的新价以 `future-effective` 报告，附原价和有效时间，候选中没有替代表达式。

DeepSeek 四个具名目标使用 `weeklyScheduleException` 记录用户批准的周历偏差。解析和比较仍只使用官网原始 CNY、UTC/Asia-Shanghai 对应周历及节假日证据；业务适用条件不混入官方 chargingConditions 差异。官网金额或条件真实变化继续独立报告，批准的忽略节假日/调休规则本身不视为变价或撤价。

## 每日核价和人工审核

[#46](https://github.com/naoshengyun/llm-metadata/issues/46) 在业务分支每天北京时间 09:47 核对固定公网版本。Actions 的手动入口支持同一运行方式和 `observe_only`。观察模式会记录结果及构建证据。公网指针尚未指向当前业务提交时，运行等待后续再触发，以免混用报价版本和源码。

- 同价只更新核查时间。读取或解析失败保留该固定版本的上次成功时间，并记录本次失败。改价候选只接收已选或已维护的确切价目，未选且缺完整证据的报价保留在报告。共享收费表仍按同组验证。
- 语义差异生成稳定的候选分支名，来源时间或响应哈希变化本身不会产生新 PR。已打开的相同差异继续使用原 PR，人工关闭且未合并的相同差异继续显示已关闭。已合并后若同样的改价在新的发布版本再次真实发生，则开启新一轮审核。推送候选后若创建 PR 中断，后续运行核验遗留提交的 Actions 机器人身份、改动文件和业务祖先，再以原分支提交为租约续跑。GitHub App 创建 PR，#44 校验候选及人工审核合并。Actions 运行产物保存原始响应和完整差异 90 天。
- 正式未生效的价目保留生效时间和时区，达到生效时间后再次取证才进入评审。正式撤价需要确切官方引文，并持久维护停用记录。适配器可以声明 `checkWithdrawn` 检查既有正式撤价；只有新的 `restoration.statement` 和完整适用收费表才能提出恢复候选。单纯价目重现保留原停用记录。已审核的同一恢复公告可持续出现在官网，后续核价按普通报价比较。后续改价按新报价的生效时间判断，原恢复证据保留。正式撤价及恢复的接通测试使用结构化夹具，实际消息需由厂商适配器按明确格式识别。
- 结果写入独立的 `cny-official-check-state` 分支。分支树只含 `official-check.json`，包含确切价目、已发布版本、最近尝试、最近成功、结果和关联 PR。只允许按时间追加。页面读取与展示由 #47 接续。[核价工作流](../../.github/workflows/naoshengyun-official-price-check.yml) · [状态入口](https://raw.githubusercontent.com/naoshengyun/llm-metadata/cny-official-check-state/official-check.json)

复核使用与 #67 公网价格匹配的固定版本 `fa59cf847c3a2a9361bbb8b2a79b7857d6282dbe3573f0b6fedf426f059c4415`。两次独立实跑各取得 114 份官方响应，已选报价均核价成功，其中一条正式未来价保留现价。两次识别的六条已维护但未选价目产生相同语义摘要，验证候选的 195 个同步键和表达式逐字节一致。GitHub 自动调度、状态发布和真实改价 PR 的验收以工作流合并后的运行证据为准。
