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

为每份官方响应在 `scripts/official-sources/` 添加独立模块并导出 `adapter`。模块声明唯一的 `id`、官方公开 GET `url`、可选的重定向 URL 清单 `allowedFinalUrls`，以及 `targets`。目标填写固定覆盖清单里的 `quoteId`、`providerId`、`endpoint`、`modelId`、`priceList`、`currency` 和共享收费表的 `group`。`baselineIdentity` 可以声明经过核实的旧目录映射，例如同一官方端点的上游通用价目名。`baselineConditions` 可以声明旧版本仅以文字保留的收费条件。

`parse({ body, evidence })` 从响应字节静态提取，返回以 `quoteId` 为键的 `Map`。每条报价包含精确 `identity`、完整 `sourcePrice`、`sourceUnit`、适用收费项 `required` 和结构化 `conditions`。金额保留官方币种。任务价按现有任务用量契约提供完整收费阶梯。`effectiveAt` 必须带时区。正式撤价须返回精确身份及 `withdrawal.statement`，引文须能在实际响应中找到并明确撤销该价目。某条解析失败可以返回 `{ error }`，缺行也会被核价入口判为失败。一个共享收费表的选中报价验证失败时，该表的候选整体被拒绝，独立的报价仍可参与核查。

适配器应以新的固定官方响应测试正常与异常情况。当前 Kimi 适配器通过 TypeScript 语法树读取官方页面内嵌表格中的静态属性，从中国站标准同步价目提取六个精确型号，并保留 Batch 价目为独立覆盖记录。其他适配未接入的记录显示 `not-registered`。延期、订阅及既定币种排除沿用覆盖清单。

## Kimi 固定响应

两份 Gzip 夹具解压后都是 [Kimi 中国官方同步价格页](https://platform.kimi.com/docs/pricing/chat) 的完整历史响应字节。

| 核对日 | 解压后 SHA-256 |
| --- | --- |
| 2026-11-16 | `9afe502615e0e0b9568f46545dd5fb5b4fb442b30e6c090ae0ba0d1373a63ffa` |
| 2026-11-18 | `a19a8f3f9c0a456384a58ea85d88081b2b80c065a34ad488cc5324850467529a` |

运行 `npm run test:cny` 可复现两份真实响应的同价回归，以及从固定响应构造的改价、缺字段、结构变化和错误场景。正式未来价与明确撤价使用结构化测试响应。测试产生的拟变价仅作本地候选校验。
