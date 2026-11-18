# 海外来源缺口复核：Arcee、Cohere、Kimi、Nova、Poolside、Perplexity

核查日期：2026-11-18。本报告是 [foreign-a.md](foreign-a.md)、[foreign-b.md](foreign-b.md) 的后续证据，范围为 [inventory.json](inventory.json) 中这 6 个端点的 **33 条记录**（1 + 17 + 6 + 2 + 3 + 4）；完整调查仍为 630 条，不缩回历史候选集。上游 SHA：`24d3f35cc82f21bdc2a049888c71af5fb4f4d7b4`。没有实现解析器、更新价目、调用付费推理、登录供应商账户或改变采购配置。

## 结论及决定边界

1. **Kimi 国际空表已经查明为提取问题**：官网 HTML 内嵌 `DocTable` 数据包含全部 6 个清单模型的金额、单位及缓存 TTL。官方余额 API 文档明确 USD，快速入门仍指向 `api.moonshot.ai/v1`。无需选择币种或改用国内价。
2. **Cohere 并非整个端点没有公开价格**：官网隐藏标签页包含价格对象；模型 HTML 页的 Pricing 组件提供 4 个 Command 模型的精确 ID/金额，FAQ 补齐 Aya Expanse。另有 4 个精确模型仅公布限流内免费、生产走 Model Vault/询价；5 个 Aya 模型未找到 token 价；3 个模型存在准确 ID/映射缺口。不能把这些不同状态合并成“17 项没有价表”。
3. **Arcee 找到精确模型的较新官方发布价**：2026-08-13 博客列 `trinity-large-thinking` 输入 USD 0.25、输出 USD 0.80 / 1M tokens。当前主表没有该行，缓存价格仍缺；这不是已经确认撤价。
4. **Nova、Poolside 和 Perplexity 仍有实际来源缺口**：分别是直营价目未取得、仅有附条件免费而无常规费率、旧 Sonar ID 到现行收费的映射未公布/未取得。下文记录替代官方路径及其局限。
5. **本轮没有必须交给用户的新业务选择**。提取、身份校验、留缺价及继续补官方证据均可沿用现有政策推进。退役、停止新用户访问、型号改名和页面缺行均不等于官方报价撤回；本报告不触发删除。采购由其他供应商承接也不改变官方基准价来源。Sarvam 的 INR 已按现有非 CNY/USD 政策排除，本轮不重问。工具收费保持运营免费；不重新引入促销到期工作流或永久人工维护例外。

## 1. Kimi 国际：6/6 金额已取得，HTML 与 Markdown 不等价

主源：[Model Inference Pricing](https://platform.kimi.ai/docs/pricing/chat)。本轮普通 Python HTTP 请求起初遇到 403，带普通浏览器 User-Agent 后 `?lang=en` 和尾斜杠入口均取得 145,502 字节 HTML，最终正文均为国际站同一价页。正文抽取与 `.md` 的空 `thead/tbody` 不是零价。实际数据存在 HTML 内嵌编译 MDX 的 `_jsx(DocTable,{...columns:[...],rows:[...]})` 中，不需要登录或调用推理。

金额单位均为 **每百万 tokens**，页面注明不含适用税费；下表按同一个 `DocTable` 的列语义记录，`—` 表示该表没有该字段，不能自动填 0。

| inventory 精确 modelId | Input | Output | Cached Input | 5m writes | 1h writes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `kimi-k2.6` | 0.95 | 4.00 | 0.16 | — | — |
| `kimi-k2.7-code` | 0.95 | 4.00 | 0.19 | — | — |
| `kimi-k2.7-code-highspeed` | 1.90 | 8.00 | 0.38 | — | — |
| `kimi-k3` | 3.00 | 15.00 | 0.30 | 3.00 | 6.00 |
| `kimi-k3.1-pro` | 2.00 | 10.00 | 0.20 | 2.00 | 4.00 |
| `kimi-k3.1-pro-highspeed` | 4.00 | 20.00 | 0.20 | 4.00 | 8.00 |

币种证据并非只凭 `$`：同站 [Check Balance](https://platform.kimi.ai/docs/api/balance) 的 `data.available_balance`、`data.voucher_balance`、`data.cash_balance` 均明确单位 USD；[Admin account billing](https://platform.kimi.ai/docs/admin-api/billing-account.md) 明确 1 USD = 100,000 milli-cent。该余额文档使用 `https://api.moonshot.ai/v1/users/me/balance`，并说明 `.ai` 与 `.com` 的密钥独立。[Quickstart](https://platform.kimi.ai/docs/get-your-api-key.md) 的当前 K3.1 示例同样使用 `https://api.moonshot.ai/v1`，因此原 inventory 端点与迁移后的 `.kimi.ai` 文档可对应。

条件及尚需实现时处理的语义：

- K3 表标明 1,048,576 context；K2 为 262,144。K2 从 2026-10-31 起不向新注册用户开放，现有用户不受影响，计划 2026-12 月底退役。**当前 K2 价表仍存在**，不能以可用性通知删除报价。
- `kimi-k3` 与 `kimi-k3.1-pro` 的 Batch 为标准价 60%；价页未把该比例赋给 highspeed，不能全家族套用。
- [Context caching](https://platform.kimi.ai/docs/guide/context-caching.md) 规定默认 5m，命中刷新原 TTL，首次写入的 TTL 在存续期间锁定。该页一方面列写入单独收费，另一方面又说明拆分前写入费已包括在输入价中、总成本不变。金额与 TTL 已取得，但在实施计费映射时必须结合 usage 字段定义区分未缓存输入、写入和命中，不能仅看“separate”就对同一 token 重复叠加 input + write。
- 工程路径：抓取最终 HTML，读取内嵌 MDX 的 `columns` 与 `rows`；使用静态解析/受限数据抽取，不执行远程 MDX。校验 exact ID、列数、货币、MTok、TTL、税、上下文与 Batch 限定；Markdown 正文作为条款补充，不作为唯一金额源。此为自动解析工程任务，不是人工维护政策例外。

## 2. Cohere：逐模型证据与精确身份

[官网 pricing](https://cohere.com/pricing) 的默认 tab 是 Workplace systems，正文提取容易只看到 Model Vault。原始 HTML 的 `self.__next_f.push(...)` 中有 `pricingGroup.models[]`，对象包含 `modelName`、`per`、`pricings[].inputLabel/inputPrice/outputLabel/outputPrice`。例如 Command R 为 `0.15/0.6`，R7B 为 `0.0375/0.15`。但 Command A+ 的对象是 `per="Free"`、`inputLabel="API key"`、`outputLabel="Model download"`；不能用两个数值 0 构造 input/output token 价。

更稳定的模型身份与金额配对来源是模型 **HTML 页面顶部 Pricing / Model ID 组件**。其 `.md` 版本通常只有正文，缺少这个组件。下表的 `$` 金额均按每百万 tokens；官网包含“All prices in USD”声明，但其出现位置紧邻 GPU 价表，模型页本身只写 `$`。正式来源记录应把币种声明及其页面上下文保留下来，不让 GPU 小时单位污染 token 记录。

| inventory modelId | 本轮实际证据/金额 | 处理结论 |
| --- | --- | --- |
| `c4ai-aya-expanse-32b` | [Pricing FAQ](https://cohere.com/pricing) 明确 Aya Expanse 8B/32B input 0.50、output 1.50；[models](https://docs.cohere.com/docs/models) 精确列 32B ID。 | 金额及精确身份已取得；不要把此价套给 Vision 或 Tiny Aya。 |
| `c4ai-aya-vision-32b` | [Aya Vision](https://docs.cohere.com/docs/aya-vision) 与 [models](https://docs.cohere.com/docs/models) 确认 ID/API，但没有对应 token 金额。 | 保留缺价；官网 FAQ 的 Expanse 价格不适用。 |
| `command-a-03-2025` | [Command A](https://docs.cohere.com/docs/command-a)：input 2.50、output 10.00，页面同列 exact ID。 | 价源已取得，HTML 组件提取。 |
| `command-a-plus-05-2026` | [Command A+](https://docs.cohere.com/docs/command-a-plus)：trial 与 production key 均在限流以内免费；生产部署引向 Model Vault。 | 取得附条件免费说明，未取得常规公开 token 费率；不把下载/API key 免费当普遍生产价。 |
| `command-a-reasoning-08-2025` | [Command A Reasoning](https://docs.cohere.com/docs/command-a-reasoning)：同样限流内免费、生产走 Model Vault。 | 条件化来源，常规 token 价缺口。 |
| `command-a-translate-08-2025` | [Command A Translate](https://docs.cohere.com/docs/command-a-translate)：限流内免费；生产用途联系销售。 | 条件化来源，不能以其他 Command A 的 2.50/10.00 代替。 |
| `command-a-vision-07-2025` | [Command A Vision](https://docs.cohere.com/docs/command-a-vision)：限流内免费；生产用途联系销售。 | 条件化来源，常规 token 价缺口。 |
| `command-r-08-2024` | [Command R](https://docs.cohere.com/docs/command-r)：input 0.15、output 0.60；同页 exact ID。 | 价源已取得。旧无日期 `command-r` 对应 03-2024，不能混为此行。 |
| `command-r-plus-08-2024` | [Command R+](https://docs.cohere.com/docs/command-r-plus)：input 2.50、output 10.00；同页 exact ID。官网 FAQ 亦明确 08-2024。 | 价源已取得。旧无日期 `command-r-plus` 是 04-2024 的别名。 |
| `command-r7b-12-2024` | [Command R7B](https://docs.cohere.com/docs/command-r7b)：input 0.0375、output 0.15；同页 exact ID。 | 价源已取得，不能推给 Arabic。 |
| `command-r7b-arabic-02-2025` | 当前 models 表没有此 ID；[官方 Arabic 发布说明](https://docs.cohere.com/changelog/command-r7b-arabic) 是开放权重说明，正文/代码实际又写 `c4ai-command-r7b-12-2024`，不含目标 ID 的 API 价。 | 身份与金额仍缺。不能依据名称相近或第三方列表复制普通 R7B 价。 |
| `north-mini-code-1-0` | [North Mini Code](https://docs.cohere.com/docs/north-mini-code-1.0) 公布的 API ID 是 `north-mini-code-1.0`，限流内免费，生产走 Model Vault。 | 原 inventory 连字符 `1-0` 与官方小数点 `1.0` 不同；未取得官方别名证据，不静默改名或映射。 |
| `north-small-translate-09-2026` | [North Small Translate](https://docs.cohere.com/docs/north-small-translate-1.0) 当前 API ID 为 `north-small-translate-1.0`，free tier、生产询价。 | 未取得 `09-2026` 到 `1.0` 的官方映射，也无目标旧 ID 的金额。 |
| `tiny-aya-earth` | [Tiny Aya](https://docs.cohere.com/docs/tiny-aya) 与 [models](https://docs.cohere.com/docs/models) 确认 API ID；未公布 input/output 价。 | 保留缺价。 |
| `tiny-aya-fire` | 同上，精确 ID 已确认，无对应金额。 | 保留缺价。 |
| `tiny-aya-global` | 同上，精确 ID 已确认，无对应金额。 | 保留缺价。 |
| `tiny-aya-water` | 同上，精确 ID 已确认，无对应金额。 | 保留缺价。 |

补充条件：[rate limits](https://docs.cohere.com/docs/rate-limits.md) 对 A+ / Reasoning / Translate / Vision 的 trial 为 20 requests/min，production 需联系销售；普通 A/R/R+/R7B 和 North Mini Code 分列。限流表不是 token 定价。官方 [计费说明](https://docs.cohere.com/docs/how-does-cohere-pricing-work) 提醒 `billed_units` 可小于总 tokens，应保留 billed input/output 口径。当前页面缺缓存价不能自动认定缓存免费。

这 17 行可分为：5 行取得数值 token 价；4 行精确身份只取得限流免费条件；5 行精确身份但缺价；3 行准确 ID/映射仍缺（其中两行当前近似型号有免费条件）。没有因为模型 Live/Deprecated 状态删除任何目录条目。

## 3. Arcee：精确旧模型不是完全无官方报价

| inventory modelId | 已取得官方价格 | 尚缺 |
| --- | --- | --- |
| `trinity-large-thinking` | [2026-08-13 Open Models API 发布](https://www.arcee.ai/blog/open-models-api-beta) 明确 USD / 1M tokens，input 0.25、output 0.80。 | 当前完整缓存读/写收费形状、主表缺行原因与持续现价完整性。 |

已检查的其他官方路线：

- [2026-04-01 模型发布](https://www.arcee.ai/blog/trinity-large-thinking) 给出自家 API output 0.90 / 1M；它早于 8 月的 exact-ID 完整 input/output 表，不能当现行替代金额。
- [当前价格 Markdown](https://docs.arcee.ai/get-started/pricing.md) 明确 USD 和 1M tokens，但现在只列 6 个第三方托管模型，缺 Trinity；[模型说明](https://docs.arcee.ai/arcee-language-models/trinity-family/trinity-large-thinking) 与 [Trinity 产品页](https://www.arcee.ai/trinity) 仍说明此模型/自家 API，却无价格。
- [Models API 文档](https://docs.arcee.ai/api-reference/models.md) 暴露官方 `GET /api/v1/models`，模型对象含 `pricing.prompt/completion/input_cache_reads/input_cache_writes`；这是后续自动提取优先路径。本轮无密钥 GET `https://api.arcee.ai/api/v1/models` 返回 **401 Unauthorized**，没有进行带密钥或付费调用。

结论：已有可追溯官方 input/output 发布价，不应再说“目标模型没有官方金额”。但不能把第三方转售价的 cache-read 0.06 拼入，亦不能仅因当前主表缺行就确认撤价。应保留历史发布证据和字段缺口；若后续已有授权账户可读取模型列表，属于只读提取路线，不是需要重选业务基准。

## 4. Nova：直营来源未取得，Bedrock 不是已证实的同一价目

覆盖 `nova-2-lite-v1`、`nova-2-pro-v1` 两条。当前 [直营文档](https://nova.amazon.com/dev/documentation) 的 HTML 仍是 JavaScript 壳。继续检查了该页实际引用的 [入口 JS](https://nova.amazon.com/website/main.BtomKH8M.js) 与 [App JS](https://nova.amazon.com/website/App.pBnd65Lz.js)，没有在壳或这两份 bundle 中找到两行 token 价。App 的 documentation 页面通过 CMS registry 请求 `pageId/pageName="documentation"` 获取；对应 route 带 `userInfoFeatureRequired: API_DOC`。这证明单纯抓静态 HTML 不足，**不证明所有用户必须登录，也不证明没有公开价**。

替代官方路线：[AWS Nova pricing](https://aws.amazon.com/nova/pricing/) 的 Nova models 段把 Standard/Priority/Flex 价格指向 Amazon Bedrock，并按 global cross-region / geo cross-region / in-region 分组；[AWS 迁移文章](https://aws.amazon.com/blogs/machine-learning/migrate-from-amazon-nova-1-to-amazon-nova-2-on-amazon-bedrock/) 确认 Nova API 可用 `nova-2-lite-v1` 调用，但没有证明直营与 Bedrock 同价。没有取得 `nova-2-pro-v1` 的直营 token 费率、币种/区域条件。

处置：两条保留来源缺口；下一步是官方 CMS 页面/正常文档渲染结果的提取，不把 AWS Bedrock 区域价或首页“start building for free”推广文案替换为直营价。若将来确实提出改用 Bedrock 作为参考价目，那才是新来源选择；当前无需为尚未提出的改变询问用户。

## 5. Poolside：3 条模型身份可查，但常规 token 价仍缺

| inventory modelId | 官方来源复核 | 状态 |
| --- | --- | --- |
| `poolside/laguna-m.1` | [Supported models](https://docs.poolside.ai/get-started/supported-models.md) 包含 M.1；该页特别说明部署/访问方式的 ID 和可用性可不同。 | 自托管支持不是直营 API 常规价证据；M.1 的当前免费适用范围未由当前首页单独明确。 |
| `poolside/laguna-s-2.1` | [官网 Models](https://www.poolside.ai/models) 当前页示例 exact ID，API base 为 `https://inference.poolside.ai/v1`；声明限时免费。 | 免费附带限时条件，无常规 input/output/cache 费率。 |
| `poolside/laguna-xs-2.1` | 同页明确 XS 2.1，处于相同 Laguna 限时免费入口；[Supported models](https://docs.poolside.ai/get-started/supported-models.md) 确认型号。 | 未取得后续常规费率，不能标为永久零价。 |

[API overview](https://docs.poolside.ai/api/overview.md) 清楚分开 Poolside-hosted、self-managed、OpenRouter，并为直营列出 `GET /v1/models` 和 `POST /v1/chat/completions`；认证需要 API key。本轮没有申请密钥或调用推理。[llms.txt](https://docs.poolside.ai/llms.txt) 未列 pricing 页面，现有官网模型页、API 说明和模型对照表都没有普通收费表。现有结论只记录免费声明的条件，不引入促销到期维护机制，也不采用 OpenRouter/Vercel 价填补直营缺口。

## 6. Perplexity：迁移建议不能充当旧 ID 的价格映射

覆盖 `sonar`、`sonar-pro`、`sonar-reasoning-pro`、`sonar-deep-research` 四条。

- [迁移总览](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview) 说明 Sonar Chat Completions 在 2026-09-27 结束支持；同步和流式请求仍工作，按模型逐步改写为 Agent API；异步不再支持。它没有给每个旧 ID 的收费映射。
- [How to migrate](https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/how-to) 把 `sonar` 和 `sonar-pro` 建议迁到 `fast`，reasoning-pro 到 `low`，deep-research 到 `high`。原文将其称为建议起点；这不是官方宣告所有旧请求实际转到同一模型/价格。
- [当前 pricing](https://docs.perplexity.ai/docs/getting-started/pricing.md) 与 [Agent API Models](https://docs.perplexity.ai/docs/agent-api/models.md) 提供新模型费率。其中 **`perplexity/sonar`** 为 input 0.25、output 2.50、cache-read 0.0625 / 1M tokens；文档 usage.cost 示例明确 currency USD。没有取得其与 inventory **`sonar`** 的价格继承声明，更没有四个旧名字共享这一价格的证据。
- 检查了 [文档索引](https://docs.perplexity.ai/llms.txt) 和 [changelog](https://docs.perplexity.ai/docs/resources/changelog.md)：索引保留迁移文档，不含旧四型号的独立现行价格表；更新日志的迁移公告也不补齐旧路由的逐模型收费。

| inventory modelId | 本轮状态 |
| --- | --- |
| `sonar` | 新 `perplexity/sonar` 有价，但 exact-ID/旧路由计费映射缺口仍在。 |
| `sonar-pro` | 只取得迁往 fast 的建议，未取得旧 ID 现行 token 价。 |
| `sonar-reasoning-pro` | 只取得迁往 low 的建议，未取得旧 ID 现行 token 价。 |
| `sonar-deep-research` | 只取得迁往 high 的建议，未取得旧 ID 现行 input/output/reasoning 价。不能用现行 Agent output 价消除旧条目的 reasoning/output 差异。 |

处置：留 4 条明确来源/身份缺口；不要把服务停止支持升级为官方报价撤回，也不擅自迁移对客模型名。当前新 API 的工具单价只作来源结构背景，运营工具免费的既定决定不变。

## 7. 可复核提取指纹与后续工作

本轮下载临时副本位于 `/tmp/foreign-source-followup/`，不作为正式持续价源，也未纳入 repo。以下 SHA256 绑定本次 HTTP 响应字节，避免把“曾经读取成功”泛化成每次都会成功：

| 来源 | 响应 SHA256 |
| --- | --- |
| Kimi pricing HTML（`?lang=en`） | `2f5ce7fe84d1c7c3273cc68e2807939b79bc4cf41316c0cff6a5ecc027a5f73a` |
| Kimi balance Markdown | `18b0c3cc06be8b54c4f67cc3c9166dc901b6a643200e50f101240f0c062aca0f` |
| Cohere pricing HTML | `1315e784ab8625cf61e32789ccd88c2010ece9ca6bfe8606ebca1b9fa52171fb` |
| Arcee 2026-08-13 官方博客 HTML | `a4d15e70a6a92076a9af33a47e39a6626ebf320df7fe606d18797b3169f599eb` |
| Nova 文档 HTML 壳 | `53e33e34f729f0d833c1c73f2f97287fe3f6613e860848eefbe7968812bb62bf` |
| Nova App bundle | `32b4e5a1775b39b0a577a4dcbc16f899a01ca722928f2ecd4f8c9a4b6092a3a0` |
| Poolside Models HTML | `e5e462ced2c146b28d8953a8d6698361fb9a97275a370d6ecb06b281aa1e92ee` |
| Perplexity Agent model table Markdown | `f9184ea90d86cecad5ec327155d13f4ce6eae49325c5463d0ea9c09eff9b68da` |

执行优先级：先实现 Kimi HTML 数据与 Cohere 模型页组件的自动提取及完整性检查；Arcee 的 models API 是有明确 schema 的后续只读来源；Nova 继续正常 CMS/渲染提取；其余未取得价目或 ID 映射按缺证状态记录并继续官方来源核验。这里的“已取得金额”是来源研究结论，尚未通过实现可表达性、自动更新稳定性或候选包验收，不等于已经发布的合格 CNY 价格。
