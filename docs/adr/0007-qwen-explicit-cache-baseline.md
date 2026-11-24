---
status: accepted
recorded_at: 2026-11-24
scope: qwen-cache / explicit-baseline-and-mode-routing
---

# Qwen 显式缓存基准与模式分路边界

用户本次明确要求改为显式缓存，并要求 New API 最终按请求参数决定实际计费路径。该决定必须以完整官方价目和实际用量语义为约束。统一 explicit 对客基准在技术上可行，但不同读取价目的价格变化需用户最终确认；逐请求精确匹配两种官方费率是另一项需求。

北京 `qwen3.8-flash` 的 input/output/read 在 implicit 与 explicit 价目中完全相同，只有 explicit 另列创建费。选择完整 explicit 价目因此同时保留普通/隐式请求金额并补足实际 `cc` 创建费，是本轮可以无模式歧义实施的精确变更。原生键集合不变，只替换该键的选价和表达式。

其余九个有完整 explicit 证据的型号具有不同读取价。统一 explicit 对客基准只需直接替换选价，不需要 New API 核心改动，但会改变隐式命中的对客价格，用户尚未最终确认这项统一基准，因此本轮仅作为待审候选披露并保持 implicit。若要求逐请求精确匹配 implicit/explicit 两种费率，当前每个原生键只查一条表达式，且 `cc=0` 无法区分显式纯命中与隐式命中，才构成 mode 分路缺口。

只有在用户要求逐请求精确匹配两种费率时，最小跨仓改动才是在路由/协议归一层生成可信 `cache_mode=implicit|explicit` 并保留到 BillingSnapshot/表达式，或对这些原生键明确实行 explicit-only 请求门禁。Chat content 标记、Responses Session header、Anthropic content 标记及非直通转换必须共同验收，不能只检查某一个固定请求路径或从创建量推断。不得新增别名、第二计费引擎或未经审查的跨仓核心修改；统一 explicit 基准本身不需要这些改动。

本轮只做报价仓库和固定原版离线验证，不执行实例写入、供应商付费调用或生产发布。构造的原始 JSON/SSE 经固定源码真实适配器及 stream handlers 验证，不是实际生产回执，真实账单仍需后续独立验收。逐型号原价、用量分解和协议边界见 [Qwen 缓存选价与实际计量边界](../requirements/QWEN-CACHE-MODE.md)。
