# PUB-T01：正式发布票来源入口

唯一拆解正文：`/Users/kohr/baymax_work/obs/outputs/qa/2026-11-17-脑生云CNY价格源发布任务拆解.md`。

- [v1.3固定快照](../../requirements/snapshots/publication-v1.3/2026-11-17-脑生云CNY价格源发布任务拆解.md)
- [来源登记](../../requirements/publication-sources.json)

开发方案已批准；执行票与实时依赖见来源登记的tracker字段。T01→T02→T03，后续票在前置关闭后开工。源正文先改、升版本再出新快照，不在此维护第二份票正文。


v1.3保留PUB-AC-02编号并明确修正原文：原版空message错误envelope可能标success却无可用价格。发布侧严格校验，valid H核对全部所选模型和值；原版负例保留，不能以成功标记替代验收。

当前状态：发布开发已完成，后续43模型真实首发亦已部署并独立公网QA通过。#18/#19/#20/#21均保持关闭；[父汇总与AC追溯](https://github.com/naoshengyun/llm-metadata/issues/18#issuecomment-6946813733)、[既有地图回执](https://github.com/naoshengyun/llm-metadata/issues/6#issuecomment-6946855090)已记录实际完成，不重复新建回执。 正文版本不变，旧快照保留；当前状态与运营余项见[收口入口](../CNY-PUBLICATION-FRONTIER.md)。
