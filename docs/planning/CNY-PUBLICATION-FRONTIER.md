# 当前发布决策前沿

2026-11-17。D1、D2、D3均已确认，不再提问；先前D3待答状态已被最新用户回答取代。

| 决定 | 状态及来源 |
|---|---|
| D1 托管 | 已确认现有组织仓库GitHub Pages；[记录#14](https://github.com/naoshengyun/llm-metadata/issues/14) |
| D2 分批 | 已确认符合资料完整/原版可表达/用户确认条件的模型子集分批，完整保留未覆盖原因；[记录#15](https://github.com/naoshengyun/llm-metadata/issues/15) |
| D3 更新发布 | 已确认人工核价PR→审阅固定候选→手动发布指定版本，无定时/提交自动发布；[记录#16](https://github.com/naoshengyun/llm-metadata/issues/16) |

剩余审批统一见[三票、S/H及D4审批表](CNY-PUBLICATION-APPROVAL.md)：A确认三票粒度和测试边界，B确认最小权限、入口及回退设计。推荐均接受，可分别批准；不把实现目录、内部函数或动作SHA逐项问用户。

只有A/B实际批准后才能解除各票对应门禁。当前仍无ready执行票、不交Dev、不启用Pages/工作流或部署。精确首发名单、版本及真实执行另确认；长期维护SLA没有推定。136参考、partial/complete=false和141差5保持，53候选及旧I四项不是默认首发名单。

[增量Spec](CNY-PUBLICATION-DRAFT.md)是待审规范正文，[候选票索引](publication-tickets/README.md)维护AC及票间依赖，[运营接入稿](CNY-PUBLICATION-OPERATIONS-DRAFT.md)区分模型/插件/工具路径。#10/#11真实业务余项不成为发布开发的全局硬前置，当前运行I夹具不动。
