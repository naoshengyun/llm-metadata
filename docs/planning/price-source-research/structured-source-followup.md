# 结构化价源及精确型号续查

核查日 2026-11-18。本报告核对固定清单中的 Thinking Machines 38、Morph 12、Meta 7、Inception 4、Upstage 5，共 66 条非订阅记录。仅研究官方基础报价和自动读取路径，不变更模型配置、采购线路或供应商账户。用户已确定折扣通过 New API 倍率处理，本轮不新增优惠到期流程。

## Thinking Machines

38 个精确 ID 全部匹配官方 JSON，36 行在 `models.json`，另 2 个 `:sampling-nvfp4` 行在 `serverless.json`。输入读取 `prefill/input`，输出读取 `sample/output`，不能误用训练 `train`。8 个 NVIDIA 行另列 `original_*` 与限时折扣，基础候选记录原价字段。型号的上下文、精度后缀不可剥掉。逐行价格和来源见 [机器证据](structured-source-evidence.json)。官方页明确推荐 JSON 作为机器接口，按百万 tokens 计价。[价目说明](https://tinker-docs.thinkingmachines.ai/tinker/models/models_and_pricing/) · [models.json](https://tinker-docs.thinkingmachines.ai/tinker/models.json) · [serverless.json](https://tinker-docs.thinkingmachines.ai/tinker/serverless.json)

目录使用 Anthropic 兼容端点。该接口文档明确暂不支持 prompt caching，`cache_control` 被忽略，缓存 usage 恒为 null。因此取得缓存单价不等于该端点可正确结算缓存。JSON 单价用 `$`，官方 Cookbook 的同源价格估算明确 USD；自动实现仍应固定该币种依据。本次不调用模型来验证用量。[兼容接口](https://tinker-docs.thinkingmachines.ai/inference/anthropic/) · [USD 估价说明](https://tinker-docs.thinkingmachines.ai/changelog/cookbook/)

## Morph

已找到更准确的官方机器接口 `https://www.morphllm.com/api/models/json?prices=list`。官方文档明确必须带 `prices=list` 才是自家基础价，不带参数会取得 OpenRouter 通道价。HTTP 200，匹配清单 11/12 个 ID，`cost_usd` 与 `unit=token` 明确币种及分母。换成百万单位仅乘 1,000,000，之后 CNY 归一再乘 7，不从网页四舍五入数字倒算。[接口约定](https://docs.morphllm.com/llms.txt) · [官方 JSON](https://www.morphllm.com/api/models/json?prices=list)

| 精确 ID | 输入 USD/M | 缓存读取 USD/M | 输出 USD/M |
| --- | ---: | ---: | ---: |
| `auto` | 未取得 | 未单列 | 未取得 |
| `morph-dsv41flash` | 0.12000000 | 0.008000000 | 0.8000000 |
| `morph-dsv41flash-1017` | 0.12000000 | 0.008000000 | 0.8000000 |
| `morph-dsv4flash` | 0.141953125000000 | 0.0359375000000 | 0.399625000000 |
| `morph-glm52-744b` | 1.19000000 | 0.1955000000 | 6.000000 |
| `morph-glm53-744b` | 1.19000000 | 0.1955000000 | 6.000000 |
| `morph-glm53flash` | 0.2000000 | 0.04000000 | 0.7000000 |
| `morph-kimik3` | 2.5000000 | 0.29000000 | 14.000000 |
| `morph-kimik3-fast` | 6.000000 | 0.6000000 | 22.5000000 |
| `morph-kimik31` | 2.5000000 | 0.29000000 | 14.000000 |
| `morph-v3-fast` | 0.8000000 | 未单列 | 1.2000000 |
| `morph-v3-large` | 0.9000000 | 未单列 | 1.9000000 |

`morph-glm52-744b` 虽未出现在当前主价格卡片，机器接口仍有精确行。GLM 的缓存为 0.1955，DeepSeek V4 Flash 为 0.141953125 / 0.0359375 / 0.399625，保留机器精度。`cache_write=0` 是官方额外写入项，不能将应收普通输入误作免费。`auto` 在官方文档明确自动选模型，但未找到它独立的金额或明确按最终模型收费契约，不能照搬上游 0.85/1.55 或算两模型均价。[官方接口](https://www.morphllm.com/api/models/json?prices=list) · [auto 定义](https://docs.morphllm.com/llms.txt) · [币种条款](https://www.morphllm.com/privacy/tos)

## Meta

7 个精确型号均有可读取价行。单位为官方 `$ / 百万 tokens`，下表顺序输入 / 缓存读取 / 输出。当前取证页只显示 `$`，未把它表述为已经单独读到 ISO USD 字段；后续正式入库应补币种字段依据。

| 精确型号 | 官方基础价格 | 条件 |
| --- | --- | --- |
| `muse-wonder-1.0` | 4 / 0.20 / 20 | Standard |
| `muse-spark-1.1` | 1.25 / 0.15 / 4.25 | Standard |
| `muse-spark-1.2` | 1.25 / 0.15 / 4.25 | Standard |
| `muse-spark-1.3` | 1.25 / 0.15 / 4.25 | Standard |
| `muse-spark-1.2-contributor` | 0.10 / 0.002 / 0.20 | 独立 Contributor ID |
| `muse-spark-1.3-contributor` | 0.10 / 0.002 / 0.20 | 独立 Contributor ID |
| `muse-ember-1.0` | ≤200K 为 0.10 / 0.004 / 0.50；>200K 为 0.30 / 0.012 / 1.50 | 整笔请求跳档，阈值含缓存和续接历史输入 |

Contributor 是附数据使用条件的独立型号，不能把其低价覆盖 Standard ID，也不构成脑生云必须启用 Contributor 的采购决定。工具搜索另收费用按既定工具免费运营政策处理。解析应绑定精确 ID、表头和 Ember 阈值，不能只抓相邻金额。[官方价格与条件](https://dev.meta.ai/docs/pricing-rate-limits)

## Inception

4 个 ID 的原价、缓存和端点已核对。官方 Markdown 可直接采集，单位 `$ / 百万 tokens`。同 Meta，尚未在本轮页面取得独立 ISO 币种字段，保留待补证而非默填零。

| 精确型号 | 输入 | 缓存读取 | 输出 | 端点 |
| --- | ---: | ---: | ---: | --- |
| `mercury-2` | 0.25 | 0.025 | 0.75 | chat/completions |
| `mercury-2.5` | 0.20 | 0.02 | 0.75 | chat/completions |
| `mercury-3` | 0.20 | 0.02 | 0.70 | chat/completions |
| `mercury-edit-2` | 0.25 | 0.025 | 0.75 | fim/completions、edit/completions |

Mercury 3 表头带删除线的原价和正文 `regularly` 一致，0.10/0.01/0.35 是发布优惠。原价明确，所以不需要用户决定恢复价。模型示例给出准确 ID，不能把 Edit 2 当 chat 模型或把新增 Mercury Decide 的仅输入计费套给这 4 条。[官方模型与价表](https://docs.inceptionlabs.ai/get-started/models.md)

## Upstage

模型专页补齐 Pro 4、Mini 4 的正常价格，当前主页含旧促销脚本，不能因脚本里出现低价就覆盖基础值。页面显示 `$`，主站公开配置 `__WEBFLOW_CURRENCY_SETTINGS.currencyCode=USD`；这说明网站展示币种，不作为实际供应商账单已验收的证据。

| 清单型号 | 输入 / 缓存 / 输出，每百万 tokens | 状态与来源 |
| --- | --- | --- |
| `solar-pro4` | 0.30 / 0.06 / 1.20 | 专页明确 ID alias 和基础价 |
| `solar-mini4` | 0.10 / 0.01 / 0.40 | 专页明确 ID alias 和基础价 |
| `solar-pro3` | 0.15 / 0.015 / 0.60 | 主价表仍公开，注明服务 2026-10-30 结束 |
| `solar-pro2` | 0.15 / 0.015 / 0.60 | 同上 |
| `solar-mini` | 主表只读到 0.15，缺完整分项关系 | 不据单个数字填输入/输出/缓存 |

旧模型页重定向到历史目录，该目录能证明版本状态和私有部署选项，却未补出 Mini 完整价。生命周期记录与价格记录分开，不能因为官方 API 下线删除本方自部署/第三方接入模型，也不能将新 Mini 4 价格套旧 Mini。[Pro 4 专页](https://console.upstage.ai/docs/models/solar-pro-4) · [Mini 4 专页](https://console.upstage.ai/docs/models/solar-mini-4) · [主价表](https://www.upstage.ai/pricing/api) · [历史型号](https://console.upstage.ai/docs/models/history)

## 本轮边界与待补事实

来源精确金额缺口已收敛到 Morph `auto` 和 Upstage `solar-mini`。Meta、Inception 尚需币种的明确字段依据，Thinking Machines 尚需在目标接入协议下确认缓存用量语义。上述均是事实核查，不需要用户重新选择折扣机制、供应商成本或删除政策。

这 66 条逐型号来源检查不意味着完整 505 条已验收，也不意味着 66 条都具备全模态、批处理、缓存写入等所有条件的完整报价。50 条结构化取证与 HTTP 响应哈希保存在 [structured-source-evidence.json](structured-source-evidence.json)，该文件是研究快照，不是生产报价目录；未修改自动解析器或发布价格。
