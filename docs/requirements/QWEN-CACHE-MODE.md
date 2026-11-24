# Qwen 缓存选价与实际计量边界

2026-11-24，用户确认：“应该调成显式缓存。同时 newapi 计费最终走哪条路由传参数决定。”2026-11-25，用户进一步明确选择“展示和计费都统一为显式缓存”，批准九个已有完整官方 explicit 报价的北京型号切换。本文件以这项后续批准为当前决定；此前九键 pending 状态已由用户解除。

## 当前实施范围

以下九个北京原生键选用各自已有完整 `cn-beijing-online-original-explicit` 价目：

- `qwen-doc-turbo`
- `qwen-flash`
- `qwen-plus`
- `qwen3-coder-flash`
- `qwen3-vl-plus`
- `qwen3.7-flash`
- `qwen3.7-max`
- `qwen3.7-plus`
- `qwen3.8-max`

这与已合入的北京 `qwen3.8-flash` 及原有 `qwen3.5-flash/plus`、`qwen3.6-flash/plus` explicit 选择共同形成统一显式缓存对客展示和计费基准。每键只有一份选中价目和一条 New API 表达式，不需要 `cache_mode`、第二计费引擎或跨仓核心改动。该基准不声称逐请求匹配上游 implicit/explicit 两套实际成本。

`qwen-max`、`qwen3.8-omni-flash`、`qwen-plus-character` 缺完整 explicit 报价记录，不猜值、不跨地区或端点借价。国际站、其它原生键、真实地区/端点、Standard/Batch 等服务档及各自收费限制不因本次决定改变；服务档不是缓存模式，不能删除。

## 九键原价与阶梯

单位均为 CNY/百万 Token，顺序为基础档/后续档。input、output 和阶梯阈值与各自 implicit 证据一致；显式读取和写入逐项采用官方原价，不由通用倍率推导。所有九键均保留显式最低 1024 Token、300 秒 TTL、命中刷新 TTL 条件。

| 原生键 | implicit 读（审计证据） | 当前 explicit 读 | 当前 explicit 写（5 分钟） |
| --- | --- | --- | --- |
| `qwen-doc-turbo` | 0.12 | 0.06 | 0.75 |
| `qwen-flash` | 0.03 / 0.12 / 0.24 | 0.015 / 0.06 / 0.12 | 0.1875 / 0.75 / 1.5 |
| `qwen-plus` | 0.16 / 0.48 / 0.96 | 0.08 / 0.24 / 0.48 | 1 / 3 / 6 |
| `qwen3-coder-flash` | 0.2 / 0.3 / 0.5 / 1 | 0.1 / 0.15 / 0.25 / 0.5 | 1.25 / 1.875 / 3.125 / 6.25 |
| `qwen3-vl-plus` | 0.2 / 0.3 / 0.6 | 0.1 / 0.15 / 0.3 | 1.25 / 1.875 / 3.75 |
| `qwen3.7-flash` | 0.04 / 0.12 / 0.24 | 0.02 / 0.06 / 0.12 | 0.25 / 0.75 / 1.5 |
| `qwen3.7-max` | 2.4 | 1.2 | 15 |
| `qwen3.7-plus` | 0.4 / 1.2 | 0.2 / 0.6 | 2.5 / 7.5 |
| `qwen3.8-max` | 1.5 | 1 | 15 |

前八个型号 explicit 读为 implicit 的一半；`qwen3.8-max` 是 1.5→1，不能套用通用倍率。`qwen3.8-flash` 继续为 input 0.8、output 2.7、read 0.1、write 1.25；1.25 是绝对单价，不是输入价乘 1.25。

## 统一展示

主表与其它模型一致，直接展示当前选中 explicit 价目的 input、output、cache read、cache write。显式缓存模式、最低 Token、TTL、命中刷新、地区和端点等作为条件说明；所有阶梯、思考输出、服务档和限制继续按原报价展示。

未选中的 implicit 价目不再与当前 explicit 价目并列为默认价格区，而保留在折叠的“缓存模式审计”详情中，原始金额、来源和条件不删除。国际站或不同地区/端点存在真实不同条件时，不套用这一折叠规则隐去差异。

## 请求参数与实际 usage

设 `U` 为普通输入、`W` 为本次创建、`R` 为本次命中、`O` 为输出：显式费用为 `U×input + W×write + R×explicit_read + O×output`。同一 Token 不重复收普通 input。命中刷新 TTL 不等于重新创建；缺失 creation 字段时不猜用量。

| 接口 | 请求开关 | 用量进入计费的途径 | 本轮确认的边界 |
| --- | --- | --- | --- |
| Chat Completions | 任意适用 message content 的 `cache_control: {type: ephemeral}` | `prompt_tokens_details.cached_tokens` 为读，创建别名取最大值；表达式引用 cr/cc 时从总 prompt 扣除 | content 位置不固定，不能用一个固定 `param()` 路径概括全部请求 |
| Responses | `x-dashscope-session-cache: enable`；默认 disable | `ApplyResponsesUsage` 归一 input/details，流式终结事件复用同一路径 | header 可描述请求意图，不等于所有模型最终采用的计费模式 |
| Anthropic 兼容 | system/messages content 的 `cache_control` | `input_tokens` 已排除读写，read/create 分别归一，不重复扣除 | 非直通型号可能经 Chat 转换，不能只按客户端协议猜上游语义 |

固定 New API `f2aa91232ed3e5878a614762ace6736a2b74257f` 与本机 `48f9df96ea7c68eae04a0f3687869f232f48929f` 的相关归一化一致。每个原生模型键仍只有一条表达式，`TokenParams` 没有可信 implicit/explicit mode；本次统一 explicit 基准不依赖 mode 分路，也不把 fixture 中的请求标记当成通用路由器。

离线 fixture 使用固定源码归档中的真实 `OpenaiHandler/OaiStreamHandler`、`OaiResponsesHandler/OaiResponsesStreamHandler`、`ClaudeHandler/ClaudeStreamHandler`。九个新型号的全部 21 个基础/阶梯档位分别覆盖普通、创建、纯命中、部分命中及非流式/流式一致性，并覆盖创建别名、缺失创建和不重复计 input。构造的原始 JSON/SSE 经真实 handler 和归一化后进入选中表达式；它们不是生产回执。没有线上实例写入、供应商付费调用或真实账单核验，不能据此宣称生产计费或供应商账单已验收。
