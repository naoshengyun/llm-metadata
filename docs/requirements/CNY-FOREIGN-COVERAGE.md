# #43 国外官方价目覆盖证据

[逐价目矩阵](CNY-FOREIGN-COVERAGE.tsv)有 442 条数据、20 列，使用 UTF-8 和带引号的 TSV 单元格。首轮检查绑定代码 `04da3c13cdb01ecaf3c0fa584f41069a0a6044ff`、固定候选 `74048b76dc422eddc9a1b5a784a0851c90e18d859892d755572a53e8c6a3209f` 与覆盖文件 SHA-256 `9358d52bcacfe9daa5fea4354611960523d24f772623b34460220270ce9b052b`。首轮矩阵 SHA-256 为 `cb668fa71cf7e8a872276913acc8998cd2640ba15b65413dd4a2f93c02aab408`。上一轮矩阵更新了两条 Gemini 路由的参考结果，SHA-256 为 `7a87a543629db97bb58f60a4ecd17058eecabd9b8ca1a89871a66b5978557aad`。

`npm run cny:unified:build` 生成固定候选。首次 `npm run cny:official:check` 于 2026-11-18T13:21:11.795Z 返回 29 份官方响应，8 个来源发生连接故障。回执 SHA-256 为 `3670b111adb8403dc7c054b50437e839f31c0c1f83e5732564751922c072457f`。使用同一候选、首次报告和 `NODE_OPTIONS=--dns-result-order=ipv4first` 于 2026-11-18T13:22:04.552Z 重试，57 份公开 HTTP GET 全部返回 200。下表记录首轮结果，回执 SHA-256 为 `96484305751a62229fa58b95dc5d2e0e483e61bae09b071e5bc487f5d1eb7fd3`。本轮使用公开资料，没有使用凭据或调用推理。

| 核查结果 | 国外价目 | 其中已选 |
| --- | ---: | ---: |
| 同价 | 111 | 93 |
| 变更待审 | 32 | 28 |
| 未来生效 | 1 | 1 |
| 失败 | 128 | 59 |
| 未注册 | 38 | 2 |
| 延期 | 76 | 0 |
| 订阅 | 54 | 0 |
| 既定排除 | 2 | 0 |

矩阵逐行给出端点、价目身份、固定原价、来源与实取响应哈希、解析金额、CNY 和收费条件。独立的历史上游行通过自有精确报价核查时，矩阵指明适用的现行所选价目。已选自有 OpenAI 11 条、Anthropic 17 条均同价。另核对已选 Claude Opus 4.5 别名，观察到原上游缺少的 1 小时写入项。Morph 11 条匹配自家 `prices=list` 的精确 USD。Sakana Namazu 公布的未来价保留 JST 生效时间。

`npm run test:cny` 在该代码共通过 149 项，其中 18 项覆盖国外读表、缓存及模态、候选复建单次乘 7、金额和条件变化、网络失败、误用来源 URL 与未来价。Morph 和 xAI 视频保留两份不同的真实响应。其他来源的独立历史版本夹具仍有缺项。明确撤价由 #41 的公共核价契约测试覆盖，本轮没有观察到明确撤价。

剩余缺项见矩阵的 `reason`。Alibaba 新加坡仍有缓存、多阶梯和混合媒体待核价。Google 缺若干旧 ID、别名以及音频缓存、视频输入或混合单位的原生计费形状。Mistral 旧型号存在精确价、退役或混合单位缺口。Z.AI 限时免费存储缺少可对应上游独立缓存写入的条件。Upstage Pro 2/3 明示服务终止。Sakana Fugu Ultra 两个已选 ID 的控制台公开 GET 返回 404，公开产品页只有 v2.0 精确费率。MiniMax 国际旧型号、按字符计费和 H3 Max 的原生支持仍有缺口。保留 #35 精确延期与非 USD 排除，Google Developer API 与 Vertex 价目保持独立。

2026-11-19 增量复核覆盖两个已选的 Gemini Developer API 请求 ID。Google 明确记录 `gemini-3.5-flash` 自动路由至 `gemini-3.6-flash`，`gemini-3.7-flash` 自动路由至 `gemini-3.8-flash`。核价保留原请求 ID、路由目标和替代型号的付费 Standard 价目，作为来源参考。两款替代型号截至 2026-12-31 的原始 USD 优惠价为每百万 Token 输入（含音频）`0.75`、输出 `3.75`、缓存读取 `0.075`，显式缓存存储为 USD `0.50` 每百万 Token 小时。自 2027-01-01 起的公告金额单独记录。原请求 ID 的计费条款及基础价仍待证，结果为 `unsupported`，不生成价格变更候选。仅有迁移推荐、缺少精确路由、显式缓存存储条件缺失或出现冲突价目时，检查失败。固定的退役文档响应已归档，原始字节 SHA-256 为 `92c195006e7eb922a9caa131670551885a63bbf1b7f6d95bcfa9de12d47a2518`。[Google Gemini 退役文档](https://aistudio.google.com/docs/deprecations#gemini-3-models) · [Developer API 价目](https://aistudio.google.com/docs/pricing#gemini-3.8-flash) · [优惠与生效日期](https://aistudio.google.com/docs/whats-new-gemini-3.8#pricing)

## Sakana Fugu Ultra 的版本证据

Sakana 的模型文档将 `fugu-ultra` 映射到 v2.0，将 `fugu-ultra-20260615` 映射到 v1.0。官方产品页的两档费率明确属于 v2.0，阈值为上下文超过 272,000 Token。控制台模型和价格页面在本次公开程序请求中均返回 HTTP 404。公开程序可取的产品页提供 v2.0 原价，但缺少可持续核对的别名映射及 v1.0 精确费率，因此两条上游选价继续等待独立核价。[Sakana 模型文档](https://console.sakana.ai/models) · [Sakana 官方价目](https://sakana.ai/fugu/#pricing)

## Gemini Developer API 和 Upstage 补证

四个 Gemini Standard 型号补齐了文本模态和音频模态的独立输入、缓存读取及显式缓存存储收费。单价为 USD/百万 Token，存储单价另按 USD/百万 Token 小时计。

| 精确 API ID | 文本/图像/视频输入 | 音频输入 | 输出 | 文本/图像/视频缓存读取 | 音频缓存读取 | 显式缓存存储 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `gemini-2.5-flash` | 0.30 | 1.00 | 2.50 | 0.03 | 0.10 | 1.00 |
| `gemini-2.5-flash-lite` | 0.10 | 0.30 | 0.40 | 0.01 | 0.03 | 1.00 |
| `gemini-3-flash-preview` | 0.50 | 1.00 | 3.00 | 0.05 | 0.10 | 1.00 |
| `gemini-3.1-flash-lite` | 0.25 | 0.50 | 1.50 | 0.025 | 0.05 | 1.00 |

`lyria-3-clip-preview` 的 30 秒歌曲为 USD 0.04/首，`lyria-3-pro-preview` 的完整歌曲为 USD 0.08/首。现有原生同步无法完整表示这六条收费形状，核价输出 `unsupported` 和逐项原价。11 月 18 日、19 日的真实价格页均可回放。11 月 19 日的响应 SHA-256 为 `9c7ea643955f30d793c3b18d0b49ee85d5eb946c7d5cda3dcef3170f4b8ef92d`。[Gemini Developer API 价目](https://aistudio.google.com/docs/pricing.md)

Upstage 官方价格卡仍列两条旧 Solar Pro，且将精确别名写在卡片链接中。两者历史原价均为输入 0.15、缓存输入 0.015、输出 0.60 USD/百万 Token，2026-10-30（韩国时间）终止服务。两条以 `unsupported` 记录历史价和终止日期，未生成候选。价格页 11 月 18 日和 19 日的核价证据 SHA-256 均为 `7ff062961d52a3183dd821824d56ed58b5c440b6e7993ec49985f2f5b41461d0`。[Upstage API 价目](https://www.upstage.ai/pricing/api) · [官方模型历史](https://console.upstage.ai/docs/models/history)

官方 xAI 价表将 Grok 4.7 Fast 限于 Cursor 和 Grok Build，费率按独立通道计划结算。公开 API 表仍无 `grok-4.7-build-fast` 精确 ID 和适用费率。MiniMax 国际旧系发布材料仍可提供部分历史费率，实际公开价表跳转到现行页后未返回所选旧版的完整缓存与端点条款。Sakana v1.0 精确费率、Gemini 旧请求 ID 的计费条款，以及多组已退役 Mistral 模型的独立历史费率仍待证。[xAI 官方定价](https://docs.x.ai/developers/pricing) · [MiniMax M2.5 发布公告](https://www.minimax.io/news/MiniMax-m25)

## 已选价目复核

以 PR #57 的 62 条已选核查失败或缺适配器价目为固定复核范围。国外 51 条中，有 27 条新增官方报价或计费参考，另有 24 条仍失败或缺适配器。[逐条矩阵](CNY-FOREIGN-COVERAGE.tsv)

- **Mistral 15 条参考。** 13 条从官方型号卡读取精确请求 ID、输入输出 USD 和退役日期。GLM 5.2 两个 ID 共用官方明确列出的三项收费。缺少缓存价的旧卡保留原字段缺口。Mistral Large 3 与 Medium 3.5 的卡片列 2027-04-30 退役，当前无法从 Standard 价表独立确认完整条件，因此仍是参考。Voxtral Small 的版本和别名使用同一官方型号卡，标准价为文本 USD 0.10 输入、0.40 输出每百万 Token，音频 USD 0.004 输入、0.0004 缓存输入每分钟。两个计量单位分别保留。其余四个 Mistral 已选 ID 缺精确收费映射。Pixtral 的历史变更日志提到短名，官方价目卡仅给版本 `pixtral-12b-2409`。[官方型号与生命周期](https://docs.mistral.ai/models) · [Voxtral Small 型号卡](https://docs.mistral.ai/models/voxtral-small-25-07)
- **OpenAI 9 条参考。** 八个已下线型号由各自官方型号页提供历史 USD，缓存仅在明确标价时记录。Realtime 2.1 保留文本、音频及图片模态，含独立 USD 0.40/百万 Token 音频缓存输入。三条 GPT-4o 快照记录官方退役状态和时点，快照专属 Standard 费率仍待证。另有 Codex-Spark 的账户订阅试用范围，以及两条 Daybreak 别名的独立计划和账户适用条件待核，常规 Standard 表不能验证这三条当前费率。[OpenAI API 价目](https://developers.openai.com/api/docs/pricing) · [下线公告](https://developers.openai.com/api/docs/deprecations) · [Codex-Spark 发布资料](https://openai.com/index/introducing-gpt-5-3-codex-spark/)
- **Gemini 3 条参考。** Gemini 2.5 Flash Image 的 Standard 图片输出保留官方 USD 30/百万 Token，以及 1,290 Token 约 USD 0.039 的适用尺寸。Gemini 3.1 Flash Live Preview 和 Gemini Embedding 2 保留独立视频输入价。两个 Deep Research Preview ID 采用代理底层模型、循环中间 Token 和工具用量的计价规则。另有两个已停用预览 ID 欠独立历史价，三条滚动别名和两条 Gemma 4 欠精确 Developer API 付费费率。[Gemini Developer API 价目](https://aistudio.google.com/docs/pricing) · [官方退役记录](https://aistudio.google.com/docs/deprecations)

这些参考价不进入改价候选。剩余国外价目中另有 Alibaba 新加坡旧实时翻译、两个 Sakana 版本、xAI Fast 和 Z.AI Turbo，分别在矩阵保留端点或适用条款的缺口。

## 服务范围调整

此前已选待证的 24 条国外价目进入脑生云未提供清单，继续按既有矩阵保留历史证据。当前核价跳过这 24 条，待审同步候选逐项列出移除原因。[服务范围与精确清单](CNY-SOURCE-REGISTRY.md#naoshengyun-service-scope)

## #62 发布后的验收缺口

新加坡 `qwen3.8-flash`、`qwen3.8-max` 的在线原始 USD 已按隐式和显式缓存分别接入核价。Anthropic 的 `claude-opus-4-5` 精确别名已采用官方 Standard 全球报价。五分钟和一小时缓存写入分别保留原始 USD 6.25 和 10／百万 Token，一小时费率归一后为 CNY 70／百万 Token，和现行公网计费表达式一致。[百炼来源](CNY-SOURCE-REGISTRY.md#62-发布后的核价范围) · [Anthropic 原价](https://platform.claude.com/docs/en/about-claude/pricing) · [型号和别名](https://platform.claude.com/docs/en/models/opus-4-5/overview)

- 百炼新加坡的其他分档和视觉型号，例如 `qwen-plus`、`qwen3-vl-plus`，已有可读的官方地区价，仍需接入精确收费条件。Z.AI 的旧 GLM 须明确限时免费存储与旧缓存写入字段的关系。
- Gemini 的三个 Flash 型号仍缺独立的 Token 小时存储计量，`gemini-3.1-flash-live-preview`、`gemini-embedding-2` 仍缺独立视频输入计量。音频补证延期另行记录。xAI `grok-imagine-image` 的生成和编辑图分别计费，MiniMax 国际 `image-01` 需绑定独立图片生成端点。[Gemini 官方定价](https://aistudio.google.com/docs/pricing) · [Grok Imagine Image](https://docs.x.ai/developers/models/grok-imagine-image) · [MiniMax 国际定价](https://platform.minimax.io/docs/pricing/overview)
- 已选价目的核价差异仍需逐条审查。例如 OpenAI 的 12 小时缓存与 Gemini 图片输出须核实独立计量，不能从核价报告直接应用到同步 JSON。真实旧、新响应夹具及按当前业务范围更新的逐型号矩阵仍待补齐。

## 新加坡国际部署的 12 款百炼型号

按用户确认，接入以下型号的 19 条在线原始 USD 报价。各型号使用独立官方型号页，读取新加坡国际部署的金额、输入阶梯和适用缓存模式。价格仍由统一构建做一次 USD 转换。北京报价继续供 New API 同步。

| 型号 | 新加坡报价 |
| --- | --- |
| `qwen-flash`、`qwen3-coder-flash`、`qwen3-vl-plus`、`qwen3.7-flash`、`qwen3.7-plus` | 隐式和显式缓存，按官方输入阶梯计费 |
| `qwen-plus` | 隐式和显式缓存，按官方输入阶梯区分思考与非思考输出费率 |
| `qwen3.7-max` | 隐式和显式缓存 |
| `qwen-max` | 隐式缓存 |
| `qwen3.5-flash` | 显式缓存 |
| `qwen3.5-plus`、`qwen3.6-flash`、`qwen3.6-plus` | 显式缓存，按官方输入阶梯计费 |

固定夹具来自 2026-11-19 取得的十二份型号页、缓存说明和思考模式说明。通过核价入口校验同价、金额变化、缺收费项、阶梯断档、缓存加价和未知生效条件。[新加坡端点](https://www.alibabacloud.com/help/en/model-studio/singapore-regional-access-information) · [原币价表](https://www.alibabacloud.com/help/en/model-studio/model-pricing) · [缓存条件](https://www.alibabacloud.com/help/en/model-studio/context-cache) · [思考模式](https://www.alibabacloud.com/help/en/model-studio/deep-thinking)

`qwen3.5-plus` 已停止新购，计划于北京时间 2027-01-19 10:00 停用。本轮记录停用前适用的原始报价。[百炼停用公告](https://www.alibabacloud.com/notice/detail?_p_lc=1&id=2217)

新加坡的 `qwen3-omni-flash`、`qwen3.8-omni-flash` 和 `qwen3-asr-flash` 延期。音频继续延期。Gemini 独立视频输入、显式缓存存储和 Grok 图片编辑等待 New API 验证相应计量与结算后接入。
