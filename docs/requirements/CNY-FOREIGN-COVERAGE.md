# #43 国外官方价目覆盖证据

[逐价目矩阵](CNY-FOREIGN-COVERAGE.tsv)有 442 条数据、20 列，使用 UTF-8 和带引号的 TSV 单元格。首轮检查绑定代码 `04da3c13cdb01ecaf3c0fa584f41069a0a6044ff`、固定候选 `74048b76dc422eddc9a1b5a784a0851c90e18d859892d755572a53e8c6a3209f` 与覆盖文件 SHA-256 `9358d52bcacfe9daa5fea4354611960523d24f772623b34460220270ce9b052b`。首轮矩阵 SHA-256 为 `cb668fa71cf7e8a872276913acc8998cd2640ba15b65413dd4a2f93c02aab408`。当前矩阵更新了两条 Gemini 路由的参考结果，SHA-256 为 `7a87a543629db97bb58f60a4ecd17058eecabd9b8ca1a89871a66b5978557aad`。

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
