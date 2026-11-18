# 5 个任务模型：官方价格与 rc50 插件后续核查

核查日期：2026-11-18（UTC）；固定目录 `24d3f35cc82f21bdc2a049888c71af5fb4f4d7b4`，见 [inventory.json](inventory.json)。范围为 5 个唯一模型、6 个 provider/model 条目（MiniMax-H3 分国际与国内）。本轮只记录官方原始价与 CNY 基础价，国外 USD ×7 一次、国内原始 CNY 保持；工具费用按用户现有运营政策为 0，折扣仍由 New API 倍率管理。采购线路、自部署成本均不作为原价来源。

结论：**MiniMax-H3 国内/国际及 xAI 三模型的公开主要费率已取得；相应收费维度可由固定 rc50 已有模型专属 usage schema 表达。Omni 的 Vertex 官方价仍列示，但不能直接当作 `google` 目录的 Gemini Developer API 现价。** 未发现需要新增计费引擎才能表达的已确认费率；用量缺失的结算退回预估、平台身份与过时来源仍须分别标注。

## 1. MiniMax-H3：两个独立官方价目

| 官方条目 | 输出分辨率 | 输出视频/秒 | 输入视频/秒 | 超免费张数的输入图片/张 | CNY 基础价（同列顺序） |
| --- | --- | ---: | ---: | ---: | --- |
| 国际 `minimax` | 768P | USD 0.08 | USD 0.08 | USD 0.04 | 0.56 / 0.56 / 0.28 |
| 国际 `minimax` | 2K | USD 0.13 | USD 0.13 | USD 0.04 | 0.91 / 0.91 / 0.28 |
| 国内 `minimax-cn` | 768P | CNY 0.50 | CNY 0.50 | CNY 0.20 | 0.50 / 0.50 / 0.20 |
| 国内 `minimax-cn` | 2K | CNY 0.80 | CNY 0.80 | CNY 0.20 | 0.80 / 0.80 / 0.20 |

每任务前 5 张图片免费，超出部分收费；输入视频按其时长与**输出分辨率**计费；同模型、同分辨率各任务类型同价，音频输入免费。国际页明确 USD，国内页明确人民币；以上均为 H3 视频行，不是 H3-Image、H3-Max、Context-IR 或 Regeneration 行。[国际官方价目](https://platform.minimax.io/docs/pricing/overview)、[国内官方价目](https://platform.minimax.cn/docs/pricing/overview)

准确请求身份为 `model: MiniMax-H3`；国际 `POST https://api.minimax.io/v2/video_generation`，国内 `POST https://api.minimax.cn/v2/video_generation`。两个目录中的 Anthropic 文本 base URL 不能拿来识别视频端点。官方查询结果包含 `task.usage.output_seconds`、`input_seconds`、`input_image_count` 与 `task.resolution`。[国际创建接口](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)、[国内 OpenAPI](https://platform.minimax.cn/docs/api-reference/video-generation-v2-create.md)、[查询接口](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)

固定 [hailuo 插件](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/plugins/tasks/hailuo/plugin.js#L11) 的 H3 专属 schema 是 `seconds`、`resolution ∈ {768P,2K}`、`input_images`、`input_video_seconds`；完成钩子在 L822 起读取上述官方字段，图片免费额可用条件表达式扣除。`generate_audio` 不需要额外收费维度，因为本条价表无音频开关差价。缺失/非法用量保留提交预估，是实际通路结算验证边界，不是价格表达式缺能力。

CNY 公式（`s=seconds, v=input_video_seconds, n=input_images`）：

- 国内：`(s+v) × (2K ? 0.80 : 0.50) + max(n−5,0) × 0.20`。
- 国际：`(s+v) × (2K ? 0.91 : 0.56) + max(n−5,0) × 0.28`。

例如 5 秒 2K、输入视频 2.5 秒、9 张图片，国内为 6.80 CNY，国际归一为 7.945 CNY。两个条目必须保留各自来源，不能在一个原生同名模型键中相加或混价；既有“国产默认国内”选择足以处理默认候选，不需要重新询问。

## 2. xAI 三个精确模型

全部适用 global `https://api.x.ai` 视频 API；生成 `POST /v1/videos/generations`。准确 model 参数如下。价格单位为 USD；括号内为 ×7 后 CNY。

| 模型 | 输出 480p/秒 | 输出 720p/秒 | 输出 1080p/秒 | 输入图片/张 | 输入视频/秒 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `grok-imagine-video` | 0.05（0.35） | 0.07（0.49） | 不支持 | 0.002（0.014） | 0.01（0.07） |
| `grok-imagine-video-1.5` | 0.08（0.56） | 0.14（0.98） | 0.25（1.75） | 0.01（0.07） | 不支持 |
| `grok-imagine-video-1.5-lite` | 0.02（0.14） | 0.03（0.21） | 0.14（0.98） | 0.01（0.07） | 不支持 |

依据分别为 [原 Video 模型页](https://docs.x.ai/developers/models/grok-imagine-video)、[1.5 模型页](https://docs.x.ai/developers/models/grok-imagine-video-1.5)、[1.5 Lite 模型页](https://docs.x.ai/developers/models/grok-imagine-video-1.5-lite)；[总价表](https://docs.x.ai/developers/pricing)明确币种 USD。1.5 的预置声音输入免费；未把其它语音产品的费用并入视频基础价。模型页 Batch pricing 为 N/A，不能套用文本 Batch 折扣。官方 `.md` 模型页仅提供简短说明，**不含完整分辨率价表**；本表逐项依据 HTML 价表核对。

原 `grok-imagine-video` 另支持 `POST /v1/videos/edits` 和 `/v1/videos/extensions`。编辑最长输入 8.7 秒，输出等长，分辨率继承输入并封顶 720p；延长输入 2–15 秒，新增段 2–10 秒，输出文件包含原片段与新增段。**按“生成的秒数”计输出价，延长只算新增段**是价表与延长定义合读得到的推断，与 rc50 代码一致；官方未在延长页单列账单算例，因此不声称已用真实账单证实。[编辑定义](https://docs.x.ai/developers/model-capabilities/video/editing)、[延长定义](https://docs.x.ai/developers/model-capabilities/video/extension.md)

[固定 xai 插件](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/plugins/tasks/xai/plugin.js#L53) 已区分原模型与 1.5 系列 schema；均有 `seconds`、`resolution`、`input_images`、`moderated`，原模型另有 `input_video_seconds`。输入图片计数涵盖首图、参考图、尾帧和关键帧；`seconds` 在编辑完成后按输出时长替换，延长则保持新增段秒数，并由总输出时长减新增段推导输入时长。编辑/延长分辨率通过输出 MP4 头部读取，读取失败保留 720p 预估。字段齐全不等于供应商回包或 MP4 读取已验收。

审核阻断仍可能计费。总价页把 USD 0.05 的“生成前违规费”明确限定在 **Responses API**，不能套进这三个视频端点，也不能因 `moderated=true` 自动全免。插件对已计费失败保留收费，并设置该字段；本轮公式审核前后采用同一视频价。[官方违规收费规则](https://docs.x.ai/developers/pricing#usage-guidelines-violation-fee)、[固定插件结算逻辑](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/plugins/tasks/xai/plugin.js#L533)

CNY 公式均为“输出秒 × 对应分辨率率 + 图片数 × 图片率”，原模型另加“输入视频秒 × 0.07”。例如原模型 8.7 秒 720p 编辑为 4.872 CNY；8 秒 1080p、两张输入图片，1.5 为 14.14 CNY，Lite 为 7.98 CNY。`us.api.x.ai` 当前不提供视频 API，其文本 token 10% 区域加价不适用。[区域端点说明](https://docs.x.ai/developers/advanced-api-usage/regions.md)

## 3. Gemini Omni Flash Preview：价目存在与平台适用性分开

`google/gemini-omni-flash-preview` 的目录官方入口是 Gemini Developer API。当前 [Developer API 价表](https://aistudio.google.com/docs/pricing)列 Omni 1.1/1.2，未取得旧 preview 的现行独立价格行；[当前 deprecations](https://aistudio.google.com/docs/deprecations#gemini-omni-flash-deprecated-models)将精确旧 ID 列为已停用，日期 2026-10-22。搜索索引仍能找到旧官方 URL 的 preview 输入/文本输出/视频输出 USD 1.50/9.00/17.50 每百万 tokens，但索引标为上月抓取，打开旧 URL 已跳新站，不能冒称本日读到原行。[旧官方价格索引入口](https://ai.google.dev/gemini-api/docs/pricing?frmapp=yes)

另一个明确且仍可读的官方条目是 **Vertex / Gemini Enterprise Agent Platform**：[Cloud 价表](https://cloud.google.com/model-garden/pricing?hl=en_GB)仍列 Gemini Omni Flash / Omni 1.1 Flash 输入 USD 1.50、文本输出（含推理）9.00、视频输出 17.50 /百万 tokens；归一 CNY 为 10.50 /63.00 /122.50。对应 [Vertex 旧模型页](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-flash-preview)精确给出 `gemini-omni-flash-preview`，标 2026-11-06 deprecated，并非 Developer API 的停用日期。该页的消费选项 PayGo=false 与区域 Standard PayGo=global 信息不一致，亦不能据此宣称服务可用。**弃用/停用均不等于已经证明官方撤回基准价；本轮不删除、不迁移模型、不将 1.2 的低价套旧模型。**

Vertex 准确端点为 `POST https://aiplatform.googleapis.com/v1beta1/projects/{PROJECT_ID}/locations/global/interactions`。官方旧 preview 仅支持 720p、3–10 秒；已升级型号的 360p/1080p/4K 与更长时长不能继承给旧 ID。[官方请求与 usage 示例](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-text)

[固定 vertex-ai 插件](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/plugins/tasks/vertex-ai/plugin.js#L6)对 Omni 使用 `input_tokens`、`output_tokens`（文本含思考）、`video_tokens`，而非 Veo 的秒价 schema；完成钩子读取 `usage.total_input_tokens`、`total_thought_tokens` 和 `output_tokens_by_modality`。它可完整表达该 Vertex 条目的公式：

```text
(input_tokens × 10.5 + output_tokens × 63 + video_tokens × 122.5) / 1000000
```

720p 一秒为 5,792 视频 tokens，对应 0.70952 CNY，仅是视频输出项，不能替换总费用。插件提交前输入/文本输出先估 0，完成 usage 缺失时不会凭空补齐；此为实际使用风险，非需要新表达式字段。插件亦明确拒绝 Omni 经 `new_api` 上游代理，和“价目能表达”分别记录。模型专属样例目前共用多个 Omni 版本的分辨率，也不能作旧 preview 支持 4K 的证据。

因此，**google 目录旧 preview 的精确当前价源适用性仍未解决**；Vertex 的同模型官方报价与 Developer API 历史索引均保留证据，按既有缺价/来源规则标记即可，无须为研究引入业务选价或自动删除决定。

## 4. 验证范围与证据固定点

原生既有审计：`/var/folders/vk/ghcncbsx6kz5cwrmnrzc_fqh0000gn/T/cny-plugin-audit-20261118-f4pvxlb2/results.json`，revision `f2aa91232ed3e5878a614762ace6736a2b74257f`，镜像 digest `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9`。`inventoryTaskModels` 中这 5 个模型的 `syntheticInherited=true`，仅证明所有收费字段能经模型级表达式被插件继承；原始 `variants[].compatible=false` 是写入前没有配置，并非该模型不支持表达式。

本轮提供 `/tmp/cny-plugin-official-followup-vectors.json`：6 个价目、46 个公式向量，覆盖各分辨率、H3 5/6 张免费界限、输入视频、xAI 审核前后、Omni 三类 token。公式均直接产出 CNY；Google 向量明确只验证 Vertex 价目形状，**不是 google 目录现价认证**。本轮已完成固定 rc50 的实际费率验证，6 个价目均通过普通价格同步取数、预览、配置保存和插件有效表达式读回，全部继承模型表达式且没有插件专属覆盖。46 个向量经固定版本 Go 计费引擎计算全部通过，并逐项验证倍率 1 和 0.8，共 92 个扣额结果通过。使用隔离容器和临时数据库，容器已移除。完整输入、期望金额、运行结果见 [plugin-price-validation.json](plugin-price-validation.json)。这些结果证明配置与公式可用，未验证供应商真实消费回包。

本轮读取官方网页与固定源码，并运行本地隔离验证，未调用任何供应商模型、未写生产配置。当前无需要用户重新选择的业务问题：来源缺口、旧端点状态、同名地域价目和用量结算边界已有明确处置类别。

### 获取证据

除 web 浏览逐项读表外，公开 HTTP GET 于 2026-11-18 11:38 UTC 实取并保存临时响应。清单 `/tmp/cny-plugin-price-source-evidence/manifest.json` 含最终 URL、HTTP 状态、字节长度、SHA256；响应文件同目录。临时文件不随仓库发布，以下 hash 固定本次观察，不承诺官网动态页面重复请求字节一致。

| 公开来源 | 状态与关键获取事实 | SHA256 |
| --- | --- | --- |
| MiniMax 国际 overview | 200；HTML 300369 bytes | `1b9fedfca059042b84b54a686e36882b7fc658ecefa0277cbe36a0b4fbb2abbe` |
| MiniMax 中国旧 minimaxi overview | 实际跳到 minimax.cn；200；311607 bytes | `b9d5da28bc2e815c0b74f491c2512df24c58fe28e4d28168772d6810c6a7c5f1` |
| Gemini Developer 现价页 | 200；149470 bytes | `65f4b327adeea08e6380bda6328e41a05a8188812c72e16e22640e843405e34c` |
| Gemini Developer deprecations | 200；53646 bytes | `590a2b6b256d21a4269666da6e623f4719b5a639372ccc55a69595848aa16fb2` |
| Cloud Model Garden 价表 | 200；2720590 bytes | `b9373b41a50c2876bfe68f563067728670ec47bffc444be4b5467ad8f87c21b5` |
| xAI 原 Video 模型 HTML | 200；367041 bytes | `50eef45d117ff77b410bd43f6e646448dff44bcff703b345e217d2496d2e4830` |
| xAI 1.5 模型 HTML | 200；371665 bytes | `05152f964b09a0a1646595d9296b9832e9581225d8a6d416aa92d416b9a06d89` |
| xAI 1.5 Lite 模型 HTML | 200；364908 bytes | `67b2830d13d358d6356b0714e6732775c2c12df0e3763a60d590619d638e96a7` |
| xAI 总价表 HTML | 200；454544 bytes | `0c4e1ccf9df57f2b75d162eb007dc6c6f37a726f2ff353ec48da8ed80ea971a2` |
