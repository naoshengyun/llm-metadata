# Qwen 缓存选价与实际计量边界

2026-11-24，用户确认：“应该调成显式缓存。同时 newapi 计费最终走哪条路由传参数决定。”本次决定取代此前北京 `qwen3.8-flash` 的 implicit 默认选择。其余九个型号采用统一 explicit 对客基准在技术上可行，但会改变隐式命中的对客读取单价，仍需用户最终确认；只有要求逐请求精确匹配 implicit/explicit 两种官方费率时，才需要可信 cache mode 分路。

## 当前实施范围

北京 `qwen3.8-flash` 选中 `dashscope--qwen3.8-flash--cn-beijing-online-original-explicit`：输入 0.8、输出 2.7、缓存读取 0.1、显式创建 1.25 CNY/百万 Token。两种模式的前三项相同，因此普通/隐式请求 `cc=0` 时金额不变，显式创建按实际 `cc` 补费；不需要声称 New API 已自动切换两种读取价目。显式 TTL 300 秒、命中刷新 TTL、最低 1024 Token 均保留官方原条件。1.25 是绝对单价，不是输入价乘 1.25。

已有 `qwen3.5-flash/plus`、`qwen3.6-flash/plus` 显式选择不变。`qwen-max`、`qwen3.8-omni-flash`、`qwen-plus-character` 缺完整 explicit 报价记录，不猜值、不跨地区或端点借价。国际站和其它原生键不因本次决定改变。

## 九个待审候选：逐键原价披露

单位均为 CNY/百万 Token，顺序为基础档/后续档。输入、输出和阶梯阈值不变；这些报价完整且可编译，但当前仍选 implicit。统一 explicit 对客基准不需要 New API 核心改动，读取单价变化尚待用户最终确认；逐请求精确匹配两种费率的分路是另一项需求，不是统一基准的前提。

| 原生键 | 当前 implicit 读 | 待审 explicit 读 | 待审 explicit 写（5 分钟） |
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

前八个型号 explicit 读为 implicit 的一半；`qwen3.8-max` 是 1.5→1，不使用通用倍率推导。若用户最终确认统一 explicit 对客基准，可直接替换选价，同时披露隐式命中的价格变化；本轮未获得这项统一基准确认，因此不执行替换。只有要求每个请求都精确匹配其实际 implicit/explicit 费率时，才必须解决 mode 分路。

## 请求参数与实际 usage

设 `U` 为普通输入、`W` 为本次创建、`R` 为本次命中、`O` 为输出：显式费用为 `U×input + W×write + R×explicit_read + O×output`。同一 Token 不重复收普通 input；隐式不另收创建费。命中刷新 TTL 不等于重新创建。

| 接口 | 请求开关 | 用量进入计费的途径 | 本轮确认的边界 |
| --- | --- | --- | --- |
| Chat Completions | 任意适用 message content 的 `cache_control: {type: ephemeral}` | `prompt_tokens_details.cached_tokens` 为读，创建别名取最大值；表达式引用 cr/cc 时从总 prompt 扣除 | content 位置不固定，不能用一个固定 `param()` 路径概括全部请求 |
| Responses | `x-dashscope-session-cache: enable`；默认 disable | `ApplyResponsesUsage` 归一 input/details，流式终结事件复用同一路径 | header 可描述请求意图，不等于所有模型最终采用的计费模式 |
| Anthropic 兼容 | system/messages content 的 `cache_control` | `input_tokens` 已排除读写，read/create 分别归一，不重复扣除 | 非直通型号可能经 Chat 转换，不能只按客户端协议猜上游语义 |

固定 New API `f2aa91232ed3e5878a614762ace6736a2b74257f` 与本机 `48f9df96ea7c68eae04a0f3687869f232f48929f` 的相关归一化一致。每个原生模型键仍只有一条表达式，`TokenParams` 没有可信的 implicit/explicit mode；`cc=0` 同时适用于显式纯命中和隐式命中。统一 explicit 对客基准只需用户确认价格变化，不需要 New API 核心改动。只有要求逐请求精确匹配两种费率时，才需要在路由/协议归一层产生并保留可信 `cache_mode`，随 BillingSnapshot/表达式传入，或明确限制这些原生键只接受显式流量并拒绝隐式请求。不得从 cc 反推 mode，也不得新增别名规避该缺口。

离线 fixture 使用固定源码归档中的真实 `OpenaiHandler/OaiStreamHandler`、`OaiResponsesHandler/OaiResponsesStreamHandler`、`ClaudeHandler/ClaudeStreamHandler`，把构造的原始 JSON/SSE 经真实适配器、流式 handler 和归一化后送入计费表达式，覆盖普通、创建、纯命中、部分命中、创建别名/缺失及非流式/流式一致性。构造用例不是实际生产回执；没有线上实例写入、供应商付费调用或真实账单核验，不能据此宣称生产计费已验收。
