---
status: accepted
recorded_at: 2026-11-24
updated_at: 2026-11-25
scope: qwen-cache / explicit-baseline-and-mode-routing
---

# Qwen 显式缓存基准与模式分路边界

2026-11-24，用户明确要求改为显式缓存，并要求查明 New API 最终计费路径和请求参数。首轮以北京 `qwen3.8-flash` 的完整 explicit 价目取代 implicit；另外九个完整 explicit 候选因读取价变化保留待确认状态。

2026-11-25，用户进一步选择“展示和计费都统一为显式缓存”，明确批准九个完整报价型号切换。这项后续批准解除九键 pending：北京 `qwen-doc-turbo`、`qwen-flash`、`qwen-plus`、`qwen3-coder-flash`、`qwen3-vl-plus`、`qwen3.7-flash`、`qwen3.7-max`、`qwen3.7-plus`、`qwen3.8-max` 均直接选用各自完整 explicit 价目。加上 Flash 和原有四个 explicit 选择，统一 explicit 对客基准不需要 New API 核心改动。

## 决定

每个原生键只保留一条选中表达式。九键逐档 input/output、上下文阈值、真实地区/端点、Standard/Batch 等服务档和收费限制保持原证据；cache read/write、最低 1024 Token、300 秒 TTL 和命中刷新按各自完整 explicit 报价计算。`qwen-max`、`qwen3.8-omni-flash`、`qwen-plus-character` 缺完整 explicit 证据，不推导或借价；国际站不擅自改价。

主表和默认详情展示当前 explicit 价目及条件，未选 implicit 价目保留在折叠缓存模式审计中，不作为第二套默认价格。统一基准是对客定价政策，不宣称逐请求匹配上游 implicit/explicit 两套成本。

只有未来另行要求逐请求精确匹配两种官方费率时，才需要在路由/协议归一层生成可信 `cache_mode=implicit|explicit` 并保留到 BillingSnapshot/表达式，或实行 explicit-only 请求门禁。`cc=0` 无法区分显式纯命中与隐式命中，不能从创建量反推 mode；不得新增别名、第二计费引擎或未经审查的跨仓核心修改来规避该边界。

本轮只做报价仓库和固定原版离线验证，不执行实例写入、供应商付费调用或生产发布。构造的原始 JSON/SSE 经固定源码真实适配器及 stream handlers 验证，不是实际生产回执，真实账单仍需后续独立验收。逐型号原价、用量分解、展示和协议边界见 [Qwen 缓存选价与实际计量边界](../requirements/QWEN-CACHE-MODE.md)。
