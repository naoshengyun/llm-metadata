# 百炼北京逐模型公开证据

按 #41 固定目录原模型 ID 核对 54 个北二区条目。价源必须落在官方华北 2（北京）区域，固定 DOM 区段及价表条件。Singapore/国际部署和 Batch 报价留在各自独立价目。下表列出能提取的官方价目与不能补入候选的精确证据缺口。

本轮新增 22 个可同步模型和 27 条原价身份，两个已取得原始金额的参考价保留在核价报告。其余 27 项仍缺合格价目。已存在的三个型号保留各自隐式、显式缓存身份。

| 官方模型 ID | 去向 | 原始金额或具体缺口 |
| --- | --- | --- |
| `qvq-max` | 待补证 | 北京表现行 Max 行是 qwen4-max、qwen3.8-max 等 Qwen ID。目录和计费页缺这一旧视觉推理 ID 的北京适用价。 |
| `qwen-deep-research` | 公开候选 | token `{"input":54,"output":163}` |
| `qwen-doc-turbo` | 公开候选 | implicit `{"input":0.6,"output":1,"cache_read":0.12}`；explicit `{"input":0.6,"output":1,"cache_read":0.06,"cache_write":0.75}` |
| `qwen-flash` | 公开候选 | implicit `{"input":0.15,"output":1.5,"cache_read":0.03,"tiers":[{"tier":{"size":128000},"input":0.6,"output":6,"cache_read":0.12},{"tier":{"size":256000},"input":1.2,"output":12,"cache_read":0.24}]}`；explicit `{"input":0.15,"output":1.5,"cache_read":0.015,"cache_write":0.1875,"tiers":[{"tier":{"size":128000},"input":0.6,"output":6,"cache_read":0.06,"cache_write":0.75},{"tier":{"size":256000},"input":1.2,"output":12,"cache_read":0.12,"cache_write":1.5}]}` |
| `qwen-long` | 公开候选 | token `{"input":0.5,"output":2}` |
| `qwen-math-plus` | 待补证 | 北京公开文本生成表无该数学专用 ID。通用模型或支持数学功能的模型不能绑定此 ID。 |
| `qwen-math-turbo` | 待补证 | 北京公开文本生成表无该数学专用 Turbo ID，也没有数学 Plus 同价或迁移的官方依据。 |
| `qwen-max` | 公开候选 | implicit `{"input":2.4,"output":9.6,"cache_read":0.48}` |
| `qwen-mt-plus` | 公开候选 | token `{"input":1.8,"output":5.4}` |
| `qwen-mt-turbo` | 待补证 | 北京翻译区有 qwen-mt-plus、qwen-mt-flash、qwen-mt-lite。没有 Turbo 独立价格，不能按音译相近的型号套价。 |
| `qwen-omni-turbo` | 待补证 | 全模态北京表可见后代 Omni 与不同媒体费栏，未见旧 qwen-omni-turbo 的精确现金价。 |
| `qwen-omni-turbo-realtime` | 待补证 | 实时北京表现行参考 qwen3.8-omni-flash-realtime。旧 Turbo Realtime 精确实时价及费种未核实。 |
| `qwen-plus` | 公开候选 | implicit `{"reasoning":8,"input":0.8,"output":2,"cache_read":0.16,"tiers":[{"tier":{"size":128000},"reasoning":24,"input":2.4,"output":20,"cache_read":0.48},{"tier":{"size":256000},"reasoning":64,"input":4.8,"output":48,"cache_read":0.96}]}`；explicit `{"reasoning":8,"input":0.8,"output":2,"cache_read":0.08,"cache_write":1,"tiers":[{"tier":{"size":128000},"reasoning":24,"input":2.4,"output":20,"cache_read":0.24,"cache_write":3},{"tier":{"size":256000},"reasoning":64,"input":4.8,"output":48,"cache_read":0.48,"cache_write":6}]}` |
| `qwen-plus-character` | 公开候选 | implicit `{"input":0.8,"output":2,"cache_read":0.16}` |
| `qwen-turbo` | 待补证 | 官方下线机制以 qwen-turbo 为系列型号示例。该文本不能证明具体下线或迁移，现行北京表未列旧 Turbo 精确费用。 |
| `qwen-vl-max` | 待补证 | 北京视觉理解表现行 Qwen3-VL-Plus 价目中缺旧 VL-Max 独立型号价；不能按 Max 名后缀替用通用 Max。 |
| `qwen-vl-ocr` | 公开候选 | token `{"input":0.3,"output":0.5}` |
| `qwen-vl-plus` | 待补证 | 北京视觉理解表存在 qwen3-vl-plus，不存在旧 qwen-vl-plus 精确行或同价映射。 |
| `qwen2-5-omni-7b` | 待补证 | 未见 Qwen2.5 开源全模态该精确 ID 的北京按量现金费，也未见与后代 Qwen Omni 等价计费的声明。 |
| `qwen3-14b` | 待补证 | 北京现行开源 Qwen3.x 表未列旧 14B 价。参数规模不提供相近型号价格继承依据。 |
| `qwen3-235b-a22b` | 待补证 | 现行开源北京表无该旧 MoE ID；Qwen3.5 同级规格不是同一个型号。 |
| `qwen3-32b` | 待补证 | 现行开源北京表无该旧 32B ID；不能从公开权重规模推计原价。 |
| `qwen3-8b` | 待补证 | 现行开源北京表无该旧 8B ID；免费权重与商业 API 不共用价格依据。 |
| `qwen3-asr-flash` | 完整官方金额参考 | upstream:alibaba-cn:qwen3-asr-flash:unknown `{"amount":0.00022}`。Native model price has no billed audio-second usage for this ASR endpoint |
| `qwen3-coder-30b-a3b-instruct` | 待补证 | 北京 Coder 表以 qwen3-coder-flash 现行行及快照为主，未见 30B A3B Instruct 精确价格。 |
| `qwen3-coder-480b-a35b-instruct` | 待补证 | 北京 Coder 表未列 480B A35B Instruct 行，不能使用 Coder Flash 的输入阶梯。 |
| `qwen3-coder-flash` | 公开候选 | implicit `{"input":1,"output":4,"cache_read":0.2,"tiers":[{"tier":{"size":32000},"input":1.5,"output":6,"cache_read":0.3},{"tier":{"size":128000},"input":2.5,"output":10,"cache_read":0.5},{"tier":{"size":256000},"input":5,"output":25,"cache_read":1}]}`；explicit `{"input":1,"output":4,"cache_read":0.1,"cache_write":1.25,"tiers":[{"tier":{"size":32000},"input":1.5,"output":6,"cache_read":0.15,"cache_write":1.875},{"tier":{"size":128000},"input":2.5,"output":10,"cache_read":0.25,"cache_write":3.125},{"tier":{"size":256000},"input":5,"output":25,"cache_read":0.5,"cache_write":6.25}]}` |
| `qwen3-coder-plus` | 待补证 | 官方北京 Coder 表有 Flash 和对应版本，缺 Coder Plus 当期独立 CNY 费。 |
| `qwen3-max` | 待补证 | 北京 Max 表仍见旧 qwen-max 与 Qwen3.7/3.8/4-Max，但缺此 exact qwen3-max 行及映射。 |
| `qwen3-next-80b-a3b-instruct` | 待补证 | 北京开源表缺此精确 Instruct 部署的按量现金行，没有同规模 Thinking 档互换证据。 |
| `qwen3-next-80b-a3b-thinking` | 待补证 | 同一北京表缺此精确 Thinking 部署的原价；不能调用 Instruct 费或对照后续模型。 |
| `qwen3-omni-flash` | 完整官方金额参考 | upstream:alibaba-cn:qwen3-omni-flash:USD `{"input":1.8,"input_audio":15.8,"input_image":3.3,"output":6.9,"multimodal":{"output":12.7,"output_audio":62.6}}`。Native expression input usage does not distinguish video from other modalities or bill the provider multimodal output condition |
| `qwen3-omni-flash-realtime` | 待补证 | 北京 Omni 本表老 qwen3-omni-flash 非实时价是独立身份；实时区缺 Qwen3 的精确旧 Realtime 费用。 |
| `qwen3-vl-235b-a22b` | 待补证 | 北京视觉理解表有新 Qwen-VL 现行模型和价格，缺此开源视觉 MoE 精确模型及完整图文价。 |
| `qwen3-vl-30b-a3b` | 待补证 | 北京视觉理解表缺此 30B A3B 精确模型行，不能复用同系列 Plus 价。 |
| `qwen3-vl-plus` | 公开候选 | implicit `{"input":1,"output":10,"cache_read":0.2,"tiers":[{"tier":{"size":32000},"input":1.5,"output":15,"cache_read":0.3},{"tier":{"size":128000},"input":3,"output":30,"cache_read":0.6}]}`；explicit `{"input":1,"output":10,"cache_read":0.1,"cache_write":1.25,"tiers":[{"tier":{"size":32000},"input":1.5,"output":15,"cache_read":0.15,"cache_write":1.875},{"tier":{"size":128000},"input":3,"output":30,"cache_read":0.3,"cache_write":3.75}]}` |
| `qwen3.5-397b-a17b` | 公开候选 | token `{"input":1.2,"output":7.2,"tiers":[{"tier":{"size":128000},"input":3,"output":18}]}` |
| `qwen3.5-flash` | 公开候选 | explicit `{"input":0.2,"output":2,"cache_read":0.02,"cache_write":0.25,"tiers":[{"tier":{"size":128000},"input":0.8,"output":8,"cache_read":0.08,"cache_write":1},{"tier":{"size":256000},"input":1.2,"output":12,"cache_read":0.12,"cache_write":1.5}]}` |
| `qwen3.5-plus` | 公开候选 | explicit `{"input":0.8,"output":4.8,"cache_read":0.08,"cache_write":1,"tiers":[{"tier":{"size":128000},"input":2,"output":12,"cache_read":0.2,"cache_write":2.5},{"tier":{"size":256000},"input":4,"output":24,"cache_read":0.4,"cache_write":5}]}` |
| `qwen3.6-flash` | 公开候选 | explicit `{"input":1.2,"output":7.2,"cache_read":0.12,"cache_write":1.5,"tiers":[{"tier":{"size":256000},"input":4.8,"output":28.8,"cache_read":0.48,"cache_write":6}]}` |
| `qwen3.6-max-preview` | 待补证 | 北京 Max 表有后续 Qwen3.7/3.8/4-Max。缺旧 3.6 Max Preview 独立价、有效期或 API 迁移价格映射。 |
| `qwen3.6-plus` | 公开候选 | explicit `{"input":2,"output":12,"cache_read":0.2,"cache_write":2.5,"tiers":[{"tier":{"size":256000},"input":8,"output":48,"cache_read":0.8,"cache_write":10}]}` |
| `qwen3.7-flash` | 公开候选 | implicit `{"input":0.2,"output":0.8,"cache_read":0.04,"tiers":[{"tier":{"size":32000},"input":0.6,"output":2.4,"cache_read":0.12},{"tier":{"size":256000},"input":1.2,"output":4.8,"cache_read":0.24}]}`；explicit `{"input":0.2,"output":0.8,"cache_read":0.02,"cache_write":0.25,"tiers":[{"tier":{"size":32000},"input":0.6,"output":2.4,"cache_read":0.06,"cache_write":0.75},{"tier":{"size":256000},"input":1.2,"output":4.8,"cache_read":0.12,"cache_write":1.5}]}` |
| `qwen3.7-max` | 公开候选 | implicit `{"input":12,"output":36,"cache_read":2.4}`；explicit `{"input":12,"output":36,"cache_read":1.2,"cache_write":15}` |
| `qwen3.7-plus` | 公开候选 | implicit `{"input":2,"output":8,"cache_read":0.4,"tiers":[{"tier":{"size":256000},"input":6,"output":24,"cache_read":1.2}]}`；explicit `{"input":2,"output":8,"cache_read":0.2,"cache_write":2.5,"tiers":[{"tier":{"size":256000},"input":6,"output":24,"cache_read":0.6,"cache_write":7.5}]}` |
| `qwen3.8-flash` | 待补证 | 北京挂牌输入 0.8 / 输出 2.7 CNY/百万 Token。官方上下文缓存页明确是通用百分比例外，各地域独立，完整缓存价格须从控制台核实。 |
| `qwen3.8-max` | 待补证 | 北京挂牌输入 12 / 输出 36 CNY/百万 Token。官方上下文缓存页明确命中费是通用规则例外，完整原价当前需控制台。 |
| `qwen3.8-omni-flash` | 公开候选 | implicit `{"input":0.8,"cache_read":0.1,"output":2.7}` |
| `qwq-plus` | 待补证 | 北京文本表缺旧 QwQ Plus 现金价或已确认的现行身份映射；不复用 Qwen Plus 混合思考价格。 |
| `siliconflow/deepseek-r1-0528` | 公开候选 | token `{"input":4,"output":16}` |
| `siliconflow/deepseek-v3-0324` | 公开候选 | token `{"input":2,"output":8}` |
| `siliconflow/deepseek-v3.1-terminus` | 公开候选 | token `{"input":4,"output":12}` |
| `siliconflow/deepseek-v3.2` | 公开候选 | token `{"input":2,"output":3}` |
| `tongyi-intent-detect-v3` | 公开候选 | token `{"input":0.4,"output":1}` |

## 核对的官方材料

- 挂牌价、北京区域及计价单位见[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)。该页固定响应 SHA-256 `47dd0005b35d2f40687ea4280fbdf23854ac6d9cf2b09a9136585b89483358ab`。
- 原生当前型号以及产品生命周期术语核对了[模型列表](https://help.aliyun.com/zh/model-studio/models)、[文本生成模型](https://help.aliyun.com/zh/model-studio/text-generation-model)和[模型下线机制说明](https://help.aliyun.com/zh/model-studio/model-depreciation)。公开页无旧行时保留缺价状态。下线机制仅能解释不同阶段，无法替代精确型号的迁移或停用公告。
- 北京缓存适用名单、TTL、例外和费率见[上下文缓存](https://help.aliyun.com/zh/model-studio/context-cache)。混合思考请求字段和 Qwen Plus 默认规则见[深度思考](https://help.aliyun.com/zh/model-studio/deep-thinking)。统一或分模态输入输出价的作用域见[全模态](https://help.aliyun.com/zh/model-studio/qwen-omni)。Character 会话请求头见[角色扮演](https://help.aliyun.com/zh/model-studio/role-play)。
