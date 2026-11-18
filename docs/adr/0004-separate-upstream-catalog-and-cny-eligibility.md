---
status: accepted
recorded_at: 2026-11-17
scope: catalog-publication-v2 / issue-29
---

# 分离完整上游目录与合格CNY价目集合

新范围采用固定上游完整provider/model/i18n与UI作为资料目录，价格证据也仅取该固定上游：明确CNY保持、国外USD金额单次×7，国内USD估算/未知缺价不反算或用raw43补齐。用户在“允许自有报价补价”和“仅用上游、明确缺价”之间明确选择后者，同时选择发布全部合格价格。代价是部分模型资料完整但暂无可应用价；收益是避免以43报价重造目录丢元数据，或混源、同名跨地区静默选价造成不可追溯。

因此资料存在、价格来源合格、原生可表达与可售是不同判断。国产默认国内并保留所有区域/订阅导航；原生同名键的选择/排除必须显式，不能沿用国际priority静默覆盖。日期与源币种保持原义，CNY展示不改称供应商结算币种。此决定限于新范围，不撤销旧v0.12/43首发；旧fixed永久保留，新版本用新身份受控发布。

沿用ADR0001—0003的官方基准、不逆算、原版能力边界及分支隔离；本ADR只补充新来源边界及取舍，不复写AC。依据：[Spec v2.0来源登记](../requirements/catalog-publication-sources.json)、[实施记录#29](https://github.com/naoshengyun/llm-metadata/issues/29)。

#34 的当前增量由 [ADR 0005](0005-unified-official-cny-candidate.md) 接续，使用固定上游目录及明确选中的完整自有官方价目。#29 发布的来源限制仍适用于其固定版本。
