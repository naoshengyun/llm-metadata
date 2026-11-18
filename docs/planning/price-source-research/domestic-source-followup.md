# 国内来源缺口续查：精确型号与可自动读取路径

核对日：2026-11-18。固定清单仍为 `inventory.json` 的 630 条记录、505 条非订阅记录，上游 SHA `24d3f35cc82f21bdc2a049888c71af5fb4f4d7b4`。本报告只续查 SenseNova、Kimi 中国、小米、百灵、LongCat、腾讯 TokenHub、阶跃这 7 个端点的 **31 个精确型号**，不是缩小总范围，也不是其余国内模型已核价的证明。全部请求为无凭据 GET，没有模型推理、付费 API 或账户变更，没有实现生产解析器或改价。

用户当前政策保持：国内官方人民币、海外官方美元乘 7 为基础价；国内自部署、海外其他供应商的实际成本不替代该基础；折扣留给 New API 倍率；不另建促销到期流程。下面记录优惠/生效日只是区分“基础价”“历史证据”“未来价”，不要求用户另选促销策略。官方服务下线不等于官方价格撤回，更不等于我们的自部署模型应删除；缺当前报价先按已有缺口规则处置，本报告不提出删除或永久人工例外。

## 1. Kimi 中国：6 个型号均已从无需登录的 HTML 提取出人民币行

[中国官方现价页](https://platform.kimi.com/docs/pricing/chat) HTTP 200；其 [Markdown](https://platform.kimi.com/docs/pricing/chat.md) 表身为空，不能使用 Markdown 抽取失败来判定无价。当前 HTML 有 `<template data-mint="manifest">`，其内容是 JSON，价目位于 `page.mdx.mdxSource.compiledSource` 的两个 `DocTable` 组件，JSON 解码即可读取列定义及行，不需执行远程 JavaScript、不需登录、不需浏览器。

单位均为 **CNY / 1,000,000 tokens**。表中 `—` 表示来源未单列该项，不能填零。

| 精确 model ID | 输入 | 输出 | 缓存命中 | 缓存写入 5min | 缓存写入 1h |
| --- | ---: | ---: | ---: | ---: | ---: |
| `kimi-k2.6` | 6.50 | 27.00 | 1.10 | — | — |
| `kimi-k2.7-code` | 6.50 | 27.00 | 1.30 | — | — |
| `kimi-k2.7-code-highspeed` | 13.00 | 54.00 | 2.60 | — | — |
| `kimi-k3` | 20.00 | 100.00 | 2.00 | 20.00 | 40.00 |
| `kimi-k3.1-pro` | 13.00 | 68.00 | 1.30 | 13.00 | 26.00 |
| `kimi-k3.1-pro-highspeed` | 26.00 | 136.00 | 1.30 | 26.00 | 52.00 |

同一官方页明确 MTok=百万 tokens、K3 缓存命中不重复收取缓存写入；K3 默认 TTL 为 5min。`kimi-k3` 与 `kimi-k3.1-pro` 的 Batch 各项是标准价 60%，highspeed 不应自动套用。K2 自 2026-10-31 起停止向新用户开放，计划 12 月底下线；此时仍有明确精确价格行，不构成“已撤价”。[来源及条件](https://platform.kimi.com/docs/pricing/chat)

实际验证的读取步骤：HTTP GET HTML → 用 HTML parser 定位 `template[data-mint="manifest"]` → `json.loads(template_text)` → 读取上述 compiledSource → 按 `columns` 与 `rows` 配对。研究脚本解码出 7,213 字符的 MDX、两张表、6 个精确型号、共 24 个金额（3×5 + 3×3）。生产实现应解析 AST 或受限数据结构并检查型号集合/列数；不应 `eval` 整段 MDX，也不应只靠正则找到第一个 ¥。旧域名重定向已在前报告核实，本次金额均来自新中国站。

## 2. 小米：现行 3 型号可直接读取，旧型号仍有官方历史原价

[官方索引](https://mimo.mi.com/llms.txt) 和 [价格 Markdown](https://mimo.mi.com/static/docs/price/pay-as-you-go.md) 均无凭据 HTTP 200。静态 Markdown 内含 HTML 表，表头明确 China=RMB、Overseas=dollar；按 `Domestic Pricing of the Model` 章节选择，不能把英文语言误认成海外站。

| 精确 model ID | 国内实时输入 | 国内实时输出 | 国内缓存命中 | 证据状态 |
| --- | ---: | ---: | ---: | --- |
| `mimo-v2.6-flash` | 1 | 2 | 0.02 | 当前价格表明确行 |
| `mimo-v2.6-pro` | 3 | 6 | 0.025 | 当前价格表明确行 |
| `mimo-v2.6-pro-ultraspeed` | 30 | 60 | 0.25 | 当前价格表明确行，不支持 Batch |
| `mimo-v2.5` | 1 | 2 | 0.02 | 官方旧型号永久调价公告仍保留，现行总表无此行 |
| `mimo-v2.5-pro` | 3 | 6 | 0.025 | 同上 |
| `mimo-v2.5-pro-ultraspeed` | — | — | — | 仅找到“V2.5-Pro 的 3 倍”历史体验价关系，未找到独立商业基础价 |

单位 CNY / 百万 tokens。当前 Flash/Pro Batch 为实时一半，缓存写入限时免费；不能由此推导 UltraSpeed Batch 或永久零缓存写入价。[现行表](https://mimo.mi.com/static/docs/price/pay-as-you-go.md)

**旧价不是由 V2.6 倒推。** [中文官方永久调价公告](https://mimo.mi.com/docs/zh-CN/news/latest/v2.5-price-update) 正文说明 2026-05-27 00:00 北京时间生效、取消输入长度分档，价目在其链接的 [官方人民币价图](https://aistudio-cdn.xiaomimimo.com/xiaomimimo-static/mimo-docs-figures/display/KdqUbJSGzohXwhxRBjEcCQuOn77.webp) 中。已经 HTTP 200 下载并视觉核对上述两型号 6 个金额及“¥ / 百万 tokens”表头。英文静态公告引用另一张 USD 图，因此中文图片 URL 是必要证据，不能把 USD×7 后近似数当原始 CNY。自动读取路径可抓中文 HTML 的正文 `img src`；金额提取仍需图片 OCR/视觉校验，这次只验证读取和人工视觉核价，未声称已实现稳定自动数字提取。

[官方下线公告 Markdown](https://mimo.mi.com/static/docs/updates/deprecate.md) 说明：V2.5 和 V2.5-Pro 于 2026-10-14 18:00 自动替换为 V2.6-Flash、V2.6-Pro 并按新版计费，2026-10-21 10:00 旧名失效。该生命周期事实不抹除上面仍公开的官方历史报价，也不决定本方自部署模型去留。

UltraSpeed 另查 [官方延期公告 Markdown](https://mimo.mi.com/static/docs/news/latest/beta-extended.md)，顶部已经声明内测结束、商业版待发布；正文保留旧体验价为 V2.5-Pro 的 3 倍。它不是“3×现行 V2.6-Pro”的依据，不把条件体验价算成独立正常基础价。更不能拿新 `mimo-v2.6-pro-ultraspeed` 30/60/0.25 填旧 ID。现行模型列表、下线公告、延期公告和现价表均已核对；剩余缺口是该精确旧 UltraSpeed 的正常基础价及其适用性，不是网页读取权限。

## 3. 百灵：3 个基础价明确，2 个缺口已落实到型号

[定价页](https://developer.ant-ling.com/zh-CN/docs/models/price/) HTTP 200，正文中的人民币原厂表和后面的美元第三方表均可直接读取。需要保留 HTML 删除线/折扣标记，不能压成纯文本后任取第一个/最后一个金额。

| 精确 model ID | CNY 原价输入/输出/缓存，均每百万 tokens | 本次结论 |
| --- | --- | --- |
| `Ling-3.0-flash` | 0.50 / 1.50 / 0.10 | 原价明确；0.14 / 0.42 / 0.028 是 2.8 折另列优惠 |
| `Ling-3.0-flash-VL` | 0.50 / 1.50 / 0.10 | 同上，不因同价合并型号 |
| `Ling-3.1-flash` | 2.00 / 6.00 / 0.40 | 原价明确；0.50 / 1.50 / 0.10 是 2.5 折优惠 |
| `Ling-3.2-flash` | 未公布原价金额 | 页首只有上线前两周免费，原厂表无此型号金额行 |
| `Ling-3.0-tiny` | 未公布 | 原厂表无此型号金额行，不能填免费 |

[更新日志](https://developer.ant-ling.com/zh-CN/docs/getting-started/changelog/) 确定 3.2-flash 在 2026-11-05 上线并重复两周免费说明；足以识别短期免费性质，但不能猜恢复后的价格或精确结束时刻。用户不采用促销到期流程，此处只记录原价缺失。

`Ling-3.0-tiny` 不是仅有离线权重而无 API 的已证实例外：[同一更新日志](https://developer.ant-ling.com/zh-CN/docs/getting-started/changelog/) 在 2026-08-07 明确兼容 OpenAI/Anthropic API；[官方下架页](https://developer.ant-ling.com/zh-CN/docs/models/deprecation/) 将其列在当前稳定支持型号；[Ling 模型页](https://developer.ant-ling.com/zh-CN/docs/models/ling/) 说明端侧/离线特性但不给金额。另查 [计量计费升级说明](https://developer.ant-ling.com/zh-CN/docs/getting-started/changelog/billing-upgrade/)，仍未取得 tiny 精确单价。不能用其他 Ling 型号、第三方 USD 或每日免费额度替代。

## 4. LongCat：2.0 原价已找到，2.5-Preview 与当前 2.5 不能混用

| 清单精确 ID | CNY / 百万 tokens：未命中输入 / 命中输入 / 输出 | 证据与边界 |
| --- | --- | --- |
| `LongCat-2.0` | **原价 5 / 0.10 / 20**；另列优惠 2 / 0.04 / 8 | [旧官方 2.0 专页](https://longcat.chat/platform/docs/zh/pricing/long-cat-2.0) HTTP 200，明确型号、原价列及单位；旧页导航不代表现行服务可调用，但原价仍公开 |
| `LongCat-2.5-Preview` | 未取得本型号独立基础价 | [当前 2.5 专页](https://longcat.chat/platform/docs/zh/pricing/longcat-2.5) 只写 `LongCat-2.5` 和限时优惠 2 / 0.04 / 8，不写 Preview，不给原价 |

这修正了前报告容易被泛化的“仅有折扣价”：只适用于当前 2.5 页，不能扩到 2.0 页。

[更新日志](https://longcat.chat/platform/docs/zh/change-log) 分别记载 2026-09-25 的 2.5-Preview 与 2026-11-02 的 2.5 发布，但未说明旧 Preview 请求自动映射或继承价格。[模型列表文档](https://longcat.chat/platform/docs/zh/api/models) 当前响应示例只含 `LongCat-2.5`，示例不等于实时账户清单。依照公开文档做无凭据 `GET https://api.longcat.chat/openai/v1/models` 得到 HTTP 401、`invalid_api_key` / `missing_api_key`。本次未取得 Preview 价格适用关系，不能因为当前价页可读就宣布清单 2/2 现价覆盖。无需向用户申请永久人工价；继续补官方旧版价页/映射公告或有授权的模型元数据即可。

## 5. 腾讯 TokenHub：4 个型号均已有明确价目或官方计费迁移关系

[TokenHub 产品 1823 的现价表](https://cloud.tencent.com/document/product/1823/130055) 无凭据 HTTP 200；本次响应体为 gzip，解压后 HTML 表即可读取，不能因直接 UTF-8 解码报错断言页面不可读。选择广州区域的按量后付费行，表头为元/百万 tokens。

| 精确 model ID | 输入 | 输出 | 缓存命中 | 身份依据 |
| --- | ---: | ---: | ---: | --- |
| `hy3` | 1 | 4 | 0.25 | 当前价格表精确行 |
| `hy3-preview` | 1 | 4 | 0.25 | **由官方后付费迁移公告明确映射至 Hy3 的现行调用计费**，不是旧 preview 独立原价 |
| `hy4` | 6 | 18 | 0.3 | 当前目录价格，限时 50% 另算 |
| `hy4-preview` | 6 | 18 | 0.3 | 当前表精确行，不把 Hy4 优惠推及 preview |

`hy3-preview` 未出现在当前表，不再停留于“缺行”：找到 [官方公告 2391](https://cloud.tencent.com/announce/detail/2391)，明确 2026-08-31 00:00 后付费 API 原模型参数自动切换至 Hy3、按照切换后模型计费。该公告区别于 Token Plan 的积分路由文档，足以支持 **TokenHub 旧 API 键的现行计费关系**；不能用它改写自部署旧 Hy3-preview 权重的身份，或把新 Hy3 价冒称旧 preview 发布时原价。历史独立价若用于该语义仍须另存来源。

另查 [产品首页](https://cloud.tencent.com/product/tokenhub) 的旧 preview 描述和 [Token Plan 积分页](https://cloud.tencent.com/document/product/1823/133811)：前者部分卡片型号标题与描述混杂，后者单位是积分；不作为该按量现金报价证据。此处无需用户决定人民币币种、恢复折扣或新价格来源。

## 6. 阶跃：4 个文本模型可取，语音存在未来生效与当前数字缺口

[API 定价 Markdown](https://platform.stepfun.com/docs/zh/guides/pricing/details.md) 无凭据 HTTP 200，明确人民币。文本如下，单位元/百万 tokens。

| 精确 model ID | 未命中输入 | 输出 | 命中输入 |
| --- | ---: | ---: | ---: |
| `step-3.5-flash` | 0.7 | 2.1 | 0.14 |
| `step-3.5-flash-2603` | 0.7 | 2.1 | 0.14 |
| `step-3.7-flash` | 1.35 | 8.1 | 0.27 |
| `step-5-preview` | 7 | 20 | 0.70 |

Step 5 表内普通缓存价为 0.70；[明确公告](https://platform.stepfun.com/docs/zh/announcements/step-5-preview-price-adjustment.md) 链接和同页备注为 2026-10-14 00:30 前已调用的用户保留 0.35，不能将账户优惠写成所有用户基础价。

语音定价块明确 **2026-11-23 12:00 北京时间才生效**；11 月 18 日不能把下表新价标为已生效：

| 精确 model ID | 主价页列出的未来价 | 本次当前价证据 |
| --- | --- | --- |
| `step-tts-2` | 280 元/百万字符 | 未找到生效前现金单价；不是 280 已生效 |
| `stepaudio-2.5-tts` | 580 元/百万字符 | 未找到生效前现金单价；不是 580 已生效 |
| `stepaudio-2.5-asr` | 0.45 元/输入音频小时 | [当前语音模型页 Markdown](https://platform.stepfun.com/docs/zh/guides/models/audio.md) 明列一次提交 SSE API **0.15 元/小时**，与精确 `stepaudio-2.5-asr` 接口字符串对应 |

TTS 2/2.5 计费字符规则是汉字 1 个、英文字母 2 个折 1 个、标点 2 个折 1 个；不是普通文本 token。不要用 StepAudio 3 的中文 3 字符规则覆盖旧 TTS。未来音色复刻另按 10 元/音色，加入语音库收费，不是输出 token 成本。[价目与字符规则](https://platform.stepfun.com/docs/zh/guides/pricing/details.md)

替代取证已经尝试 [旧价格路径](https://platform.stepfun.com/docs/zh/pricing/details)（HTTP 200 但重定向到当前详情）、[计费概述](https://platform.stepfun.com/docs/zh/guides/pricing/intro.md)、[语音型号表](https://platform.stepfun.com/docs/zh/guides/models/audio.md)、[TTS 开发指南](https://platform.stepfun.com/docs/zh/guides/developer/tts.md)、官方 `llms.txt` 公告列表。模型表给出 ASR 0.15，TTS 指南只提供能力/参数和音色示例，未补出两项旧 TTS 单价。ASR 的 0.15 与已标未来的 0.45 可用生效时间区分；两项 TTS 应保留“当前原价未核实”，不能靠推断涨幅倒算。

## 7. SenseNova：精确 1 个型号的缺口，不是笼统“商汤不可读”

目标仅 `sensenova-6.8-flash-lite`。已经验证的公开路径：

1. [当前 `/docs`](https://platform.sensenova.cn/docs) HTTP 200，16,019 bytes 的 JS 壳；从 HTML 引用的 [官方文档 chunk](https://platform.sensenova.cn/_next/static/chunks/210-35a7025cd2eaebe6.js) 获取 360,845 bytes 的中英文 Markdown 文档。型号、`token.sensenova.cn/v1`、CN datacenter、模型字段说明均可读取；不是文档无法抓取。
2. 文档明确 `GET https://token.sensenova.cn/v1/models` 返回价格字段。实际无凭据只读请求 HTTP **401**，body 为 `{"error": {"code": 16,"message": "Authorization Not Found"}}`。示例 `pricing.prompt/completion/image/request/input_cache_read` 全为字符串 `0`，但字段说明只叫“定价信息”，没有现金币种与分母，不能当实际 0 CNY/Mtoken。
3. 同站公开 [UI 文案 chunk](https://platform.sensenova.cn/_next/static/chunks/9823-7a4eac65ffd8f3e1.js) 含公测免费和付费档位即将上线文案；文档正文还说明 Flash-Lite 专属积分池和滚动窗口。它支持“存在公测权益”而非现金基础价；共享 bundle 可能保留旧文案，尚未以实时账户数据证明该精确型号现价。未把这些文字完全忽略，也未升级成永久免费价。
4. [另一官方 SenseCore 产品价格页](https://www.sensecore.cn/help/docs/model-as-a-service/nova/pricing) HTTP 200，列 V6.5/V6/Vision 等人民币千 tokens 行，**没有** 6.8 Flash Lite。不能跨产品迁移。官方当前文档/home 公开脚本已检查，猜测的 `/pricing` 返回 404；官方域限定搜索未找到精确 6.8 Flash Lite 现金价表。

因此真实缺项为：该精确型号在当前 token.sensenova 端点的**实际价格字段、现金币种、单位/分母**，以及公开免费文案与现金基础价的关系。可继续的自动路径是带已授权只读凭据的模型列表，并补官方字段计量说明；401 只是证明匿名请求不足，不证明付费调用必要，也不是许可豁免。当前没有凭据，不读取本地秘密、不申请购买、不把示例零值发成基础价。

## 8. 可执行续查与是否需要业务选择

本轮不产生新的通用业务选择：不重问 CNY/USD×7、促销、实际供应商成本、国内下线是否删除、或永久人工维护。来源缺口可以先落到明确型号继续取证：

- SenseNova `sensenova-6.8-flash-lite`：需要实际模型元数据及币种/单位证据；若公开路径继续不足，运营可提供官方账单/价表或已有授权的只读模型列表结果。
- 百灵 `Ling-3.0-tiny`、`Ling-3.2-flash`：缺独立基础单价；前者 API 存在已证实，后者只有短期免费声明。
- LongCat `LongCat-2.5-Preview`：缺官方精确价格与当前 2.5 的价格继承关系；2.0 已取得原价，不再和它合并阻塞。
- 小米 `mimo-v2.5-pro-ultraspeed`：历史体验关系已找到，独立正常基础价未找到；V2.5/Pro 有仍公开的人民币历史价，不能说全部旧型号无官方金额。
- 阶跃 `step-tts-2`、`stepaudio-2.5-tts`：2026-11-23 前现行价格缺证；未来价格可读取。ASR 旧/新价已有可区分依据。

这些是证据待补项；只有用户要在缺原价证据的情况下另行指定商业定价时才出现新的业务选择。本报告没有替用户作这种指定，也没有批准永久手工例外。31 条续查结论不替代其他 474 条非订阅清单的逐型号核对。

## 9. 本次抓取校验记录

以下 SHA256 为本次直接 HTTP 获取的内容，便于区分下一轮网页变动；研究临时缓存不作为仓库永久依赖。除注明的 JSON 401/404 外，上述主要源均 HTTP 200。

| 内容 | SHA256 |
| --- | --- |
| Kimi 中国 HTML | `a19a8f3f9c0a456384a58ea85d88081b2b80c065a34ad488cc5324850467529a` |
| 小米现行价格 Markdown | `548ee13deef4a98b6c8384bb21cab609444a9e43dae4dd2e6a988bb9288c2b52` |
| 小米旧型号 CNY 公告图片 | `35e1d42f2d81c94307dff70c6cf75b1c044f3dbe65e10563b5869fb60eaa0d40` |
| 百灵价目 HTML | `23e721f988f8b4b83dcc7ab6efe8d8eb68224827664d54c30ad5cc9e22edd54d` |
| LongCat 2.0 HTML | `a3db027207849bb7161a17f940eee945fe06ae0cefe6be8f273bc42d0ba3de4c` |
| LongCat 2.5 HTML | `b019cd6645fccb4b8fc4c4197e4e1120ec637d045855f10bdaa1415b49fd3d39` |
| 腾讯价目解压后 HTML | `c5ed68b39062902a451e8b478ed41e64cdedd266bff280ad454f1ee1631844db` |
| 阶跃价格 Markdown | `c9613abfa436faeb75f33c72e491a4a49fa8e5de547e338d5dc02038bbd39cf3` |
| 阶跃音频型号 Markdown | `6267ae40b2460dd85c44ef2359a437f343d2392a26671944c171216ae3722613` |
| SenseNova 文档 JS | `b4cec554990cb8deef4eeb05949bbdec4b1a85bdf45e7e09e1a982e442eae813` |
| SenseNova UI 文案 JS | `17088ee599df5607fcf649f56a86d4e305d3678f70026d5aab1aa576dbf620ec` |
