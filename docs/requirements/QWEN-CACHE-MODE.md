# Qwen 缓存选价与实际计量边界

2026-11-24，用户确认：“应该调成显式缓存。同时 newapi 计费最终走哪条路由传参数决定。”本次决定取代此前北京 `qwen3.8-flash` 的 implicit 默认选择，但不能把不同读取价目的隐式请求一律按更低 explicit 读取价计费。

## 当前实施范围

北京 `qwen3.8-flash` 选中 `dashscope--qwen3.8-flash--cn-beijing-online-original-explicit`：输入 0.8、输出 2.7、缓存读取 0.1、显式创建 1.25 CNY/百万 Token。两种模式的前三项相同，因此普通/隐式请求 `cc=0` 时金额不变，显式创建按实际 `cc` 补费；不需要声称 New API 已自动切换两种读取价目。显式 TTL 300 秒、命中刷新 TTL、最低 1024 Token 均保留官方原条件。1.25 是绝对单价，不是输入价乘 1.25。

已有 `qwen3.5-flash/plus`、`qwen3.6-flash/plus` 显式选择不变。`qwen-max`、`qwen3.8-omni-flash`、`qwen-plus-character` 缺完整 explicit 报价记录，不猜值、不跨地区或端点借价。国际站和其它原生键不因本次决定改变。

## 九个待审候选：逐键原价披露

单位均为 CNY/百万 Token，顺序为基础档/后续档。输入、输出和阶梯阈值不变；这些报价完整且可编译，但当前仍选 implicit，**尚不是满足自动分路要求的已完成实施**。

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

前八个型号 explicit 读为 implicit 的一半；`qwen3.8-max` 是 1.5→1，不使用通用倍率推导。直接把上述九键改为 explicit 会降低隐式纯命中的对客价格，因此本轮不执行该替换。

## 请求参数与实际 usage

设 `U` 为普通输入、`W` 为本次创建、`R` 为本次命中、`O` 为输出：显式费用为 `U×input + W×write + R×explicit_read + O×output`。同一 Token 不重复收普通 input；隐式不另收创建费。命中刷新 TTL 不等于重新创建。

| 接口 | 请求开关 | 用量进入计费的途径 | 本轮确认的边界 |
| --- | --- | --- | --- |
| Chat Completions | 任意适用 message content 的 `cache_control: {type: ephemeral}` | `prompt_tokens_details.cached_tokens` 为读，创建别名取最大值；表达式引用 cr/cc 时从总 prompt 扣除 | content 位置不固定，不能用一个固定 `param()` 路径概括全部请求 |
| Responses | `x-dashscope-session-cache: enable`；默认 disable | `ApplyResponsesUsage` 归一 input/details，流式终结事件复用同一路径 | header 可描述请求意图，不等于所有模型最终采用的计费模式 |
| Anthropic 兼容 | system/messages content 的 `cache_control` | `input_tokens` 已排除读写，read/create 分别归一，不重复扣除 | 非直通型号可能经 Chat 转换，不能只按客户端协议猜上游语义 |

固定 New API `f2aa91232ed3e5878a614762ace6736a2b74257f` 与本机 `48f9df96ea7c68eae04a0f3687869f232f48929f` 的相关归一化一致。每个原生模型键仍只有一条表达式，`TokenParams` 没有可信的 implicit/explicit mode；`cc=0` 同时适用于显式纯命中和隐式命中。最小跨仓方案是在路由/协议归一层产生并保留可信 `cache_mode`，随 BillingSnapshot/表达式传入，或明确限制这些原生键只接受显式流量并拒绝隐式请求。不得从 cc 反推 mode，也不得新增别名规避该缺口。

离线 fixture 验证普通、创建、纯命中、部分命中、流式三协议、缺失创建字段及阶梯边界；没有线上实例写入、供应商付费调用或真实账单核验，不能据此宣称生产计费已验收。
