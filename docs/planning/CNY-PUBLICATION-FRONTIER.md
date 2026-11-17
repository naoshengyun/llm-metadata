# CNY发布当前入口（2026-11-17首发收口）

**真实Pages首页与43原生模型静态价格源首发已完成，独立公网QA PASS。** [首页](https://naoshengyun.github.io/llm-metadata/) / [模型JSON](https://naoshengyun.github.io/llm-metadata/api/newapi/ratio_config.json)。用户原答复仅43模型，插件/工具不选，不沿用43+9建议或53候选。

[既有全面回执](https://github.com/naoshengyun/llm-metadata/issues/6#issuecomment-6948364424)；[实际run44083046403](https://github.com/naoshengyun/llm-metadata/actions/runs/44083046403) build/deploy success；PR26 merge dff5832572825c6d811d08f2aacd6e19ebaa4899；deployment7853180390 success。hosted103/103和独立浏览器/匿名HTTP验收来自固定QA报告，不是本轮重跑。

[正式执行记录](../requirements/snapshots/publication-execution-20261117/2026-11-17-脑生云CNY价格源43模型首发执行记录.md)包含原授权、完整release/manifest hash、证据归属和回退限制。[来源登记](../requirements/publication-sources.json)：原Spec/Tickets/design/UI证据v1.3、Opsv1.4均未改；新增执行记录v1.0，不机械提升规范版本。#18—21保持开发CLOSED；#6/#10/#11保持OPEN。

## 既有未完成事项与后续版本边界

- 生产目标工具全有效键显式0尚未验证；不选工具不等于清零。v2包已同步零费说明，原v1/quote/artifact不改，官方报价不是已证采购成本。
- 实际生产new-api配置、采购成本/usage/钱包账单/可售和整体O/R，及特定运营网络验证仍单列；不否定已完成首发。
- 首次无旧公开版本，未做破坏性真实回退。后续更新/回退必须保留当前release固定URL/原字节，并走新审阅的历史保留路径及确认；不能把first-release null-base脚本直接当通用覆盖/回退脚本。
- 当前完整包仍partial/complete=false，136参考/141差5保留。后续选择与具体执行按其变更范围确认，不自动再次部署/供应商测试/新建票/恢复清理UII。
