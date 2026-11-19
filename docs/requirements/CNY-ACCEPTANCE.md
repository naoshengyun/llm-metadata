# 国内与国外官方价目联合验收

本轮沿用 [#39 统一构建](https://github.com/naoshengyun/llm-metadata/issues/39) 和 [#41 官方核价入口](https://github.com/naoshengyun/llm-metadata/issues/41)。固定上游为 `24d3f35cc82f21bdc2a049888c71af5fb4f4d7b4`，对比 [#65](https://github.com/naoshengyun/llm-metadata/pull/65) 已发布版本 `ba427338a13c8487951cc1bae7bd26f7c23309a99fffe283fd1865f63217d49d`。逐条矩阵以精确供应商、API 端点、价目身份、原币与计费单位为键，并列官方证据、解析条件、当前选价和缺项原因。[最新 670 条覆盖矩阵](CNY-ACCEPTANCE-COVERAGE.tsv) · [114 份真实官方响应及 SHA-256](../../tests/fixtures/official-check/acceptance-2026-11-19/responses.json)

## 已选价格

- 195 个导出键全部取得候选核价结果。194 个与当前官价一致。Sakana Namazu 的正式价格自 2026-12-01 10:00 JST 生效，保持待生效状态。[Sakana API](https://sakana.ai/namazu/)
- 与 #65 已发布 JSON 比较，撤下官方已标记废弃的 `gemini-2.5-pro`、`gpt-image-1.5`、`chatgpt-image-latest`。三语目录采用统一废弃状态，历史发布继续可查。[Google 废弃公告](https://aistudio.google.com/docs/deprecations#gemini-2.5-pro-models) · [OpenAI 废弃公告](https://developers.openai.com/api/docs/deprecations)
- 三个 Gemini 图片型号按图片输出 token 单独收费。固定 rc.50 的 Gemini 响应适配器把 `candidatesTokensDetails` 的 `IMAGE` 项写入图片输出量，原生结算从普通输出量扣除这部分，再按 `img_o` 计费。[Gemini 价格](https://aistudio.google.com/docs/pricing) · [固定响应适配器](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/relaykit/relayconvert/internal/gemini_chat/to_oai_chat_resp.go) · [固定结算映射](https://github.com/QuantumNous/new-api/blob/f2aa91232ed3e5878a614762ace6736a2b74257f/service/tiered_settle.go)
- OpenAI 三个当前文本型号补齐 12 小时缓存写入的原始 USD 和长短档，金额和已有结算表达式一致。九个 Gemini 条目补齐已核实的收费条件，未来价和独立显式缓存存储费留在证据层。火山 Character 补齐高档缓存读取原价，Evolving 补齐官方收费条件，两条原生表达式逐字节一致。[OpenAI 价格](https://developers.openai.com/api/docs/pricing) · [Gemini 价格](https://aistudio.google.com/docs/pricing) · [方舟价格](https://docs.volcengine.com/docs/zh/ark/model-pricing.md)
- 国内补充的 19 条收费条件、8 个 xAI 的严格长上下文边界及其回归均纳入同一 PR。与 #65 比较，新增 0 个导出键，改动 11 个原生表达式，涉及三个 Gemini 图片价和八个 xAI 阶梯边界。新加坡 19 条原价和北京 27 条同步价的既定区域选择继续适用。[国内证据](CNY-DOMESTIC-COVERAGE.md) · [国外证据](CNY-FOREIGN-COVERAGE.md)

## 未选路径与验收边界

- 41 条未选核价记录保留问题明细。百炼新加坡 21 条在区域价表缺精确身份或有歧义。Z.AI 国际 12 条缺适用的完整显式缓存价或精确型号价。MiniMax 国际 8 条涉及旧端点、缺原生视频绑定或延期音频的字符计量。百炼北京未选旧型号的公开价目或条件缺口可按矩阵与北京逐型号原始记录复核。[北京逐模型证据](CNY-BAILIAN-BEIJING-EVIDENCE.md)
- 已批准延后的 Omni、音频、Gemini 视频与显式缓存存储、Grok 图片编辑，按既有范围保留来源证据。矩阵区分缺公开价、同名不同端点、原生缺计量和历史报价。现有 10 条有差异的未选价目可以审阅，不会进入 New API 同步。
- 报告归档了当次 114 份实际 HTTP 200 响应，复用已有旧夹具，并对比不同日期的 Gemini、OpenAI 与方舟响应。只有同日采集、来源字节相同或较早响应未保留的端点，其历史涨降价检验仍依赖已有的定向回归。未选价目因公开资料不足而保留缺项，跨版本证据需要按两票原要求审核。

## 复现

在本轮提交运行 `npm run test:cny`，再运行 `node --test tests/evidence/cny-acceptance-2026-11-19.test.mjs` 回放完整验收快照。锁定的覆盖 JSON 和同步 JSON 内容摘要见响应清单。三语浏览器验证与隔离版 New API rc.50 的预览、保存、配置读回使用同一候选，供应商推理调用数为 0。平台审核与公网发布在合并后完成，生产实例应用属于独立流程。

## #66 公网读回与收尾复核

[#66](https://github.com/naoshengyun/llm-metadata/pull/66) 的合并提交 `ac76b63e8e8f80b5d12434286ffa0b52a656ca13` 已对应公网固定版 `eb48b5c85ca0bad81bd1b8946e8401a70c63c0a2d9cafbc18e51c27681656a0e`。公开固定版本和 New API 稳定入口价格 JSON 字节相同，SHA-256 为 `ad5a63794d79b302cee1d676c3e8352365dde57725bde619ae99e54a83d86a89`。三语目录均标记三个废弃型号，这些型号已退出同步 JSON。本次发布没有新增同步键。11 条表达式按审查更新。百炼新加坡 19 条报价和北京 27 条价格读回一致。[发版与公网验证](https://github.com/naoshengyun/llm-metadata/actions/runs/44520777595) · [公网指针](https://naoshengyun.github.io/llm-metadata/current.json)

按 [#34 最终价格口径](https://github.com/naoshengyun/llm-metadata/issues/34#issuecomment-7008556062)，应使用官网当前适用的公开价。与 #66 对比，本次收尾候选更新五条国内报价。下表分别列每百万 Token 的未命中输入、输出、缓存读取，单位均为 CNY。

| 型号 | #66 | 官网当前公开价 |
| --- | --- | --- |
| Ling-3.0-flash、Ling-3.0-flash-VL | 0.50 / 1.50 / 0.10 | 0.14 / 0.42 / 0.028 |
| Ling-3.1-flash | 2.00 / 6.00 / 0.40 | 0.50 / 1.50 / 0.10 |
| LongCat-2.0 | 5.00 / 20.00 / 0.10 | 2.00 / 8.00 / 0.04 |
| MiniMax-M3 标准，≤512k | 4.20 / 16.80 / 0.84 | 2.10 / 8.40 / 0.42 |
| MiniMax-M3 标准，>512k | 8.40 / 33.60 / 1.68 | 4.20 / 16.80 / 0.84 |

国际 MiniMax 仍读取同一档位的现行 USD 金额。国内和国际适配器回归覆盖只变优惠标签或截止日的情形。LongCat 没有公布适用的当前金额时，检查失败并保留已审核价。公开资料或已批准业务范围的缺项沿用逐条矩阵，不生成同步键。41 条未选记录复核后原结论一致，已选候选有 194 条同价和 1 条正式未来价。[百灵定价](https://developer.ant-ling.com/zh-CN/docs/models/price/) · [LongCat 定价](https://longcat.chat/platform/docs/zh/pricing/long-cat-2.0) · [MiniMax 中国定价](https://platform.minimax.cn/docs/pricing/overview) · [MiniMax 国际定价](https://platform.minimax.io/docs/pricing/overview)

2026-11-19 11:39 UTC 和 12:10 UTC 两次独立采集覆盖同一组 114 个官方响应，第二次逐文件归档了新增原始字节，对内容相同的独立回包复用第一份夹具。两次都在完整候选逐键回放。对于同字节或价格未变的来源，金额变化和响应异常另以定向回归验证。两次采集日期和每个端点的证据均保留。[第二次响应和原始夹具索引](../../tests/fixtures/official-check/closeout-2026-11-19/responses.json)
