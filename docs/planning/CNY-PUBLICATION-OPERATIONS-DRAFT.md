# CNY发布operations：来源入口

正式正文已转入Obsidian：`/Users/kohr/baymax_work/obs/outputs/qa/2026-11-17-脑生云CNY价格源发布运营接入.md`（v1.4，开发已批准，未部署）。

- [固定字节快照](../requirements/snapshots/publication-v1.4/2026-11-17-脑生云CNY价格源发布运营接入.md)
- [来源登记及SHA256](../requirements/publication-sources.json)
- [开发批准记录（#17）](https://github.com/naoshengyun/llm-metadata/issues/17)

本文件只作索引。后续先修改obs唯一正文、升版本，再新增快照；不得单独编辑冻结快照。原仓库草稿保留在Git历史de10ec0，不再作为活正文。原Spec/Tickets v0.12未改。


v1.4保留PUB-AC-02编号并明确修正原文：原版空message错误envelope可能标success却无可用价格。发布侧严格校验，valid H核对全部所选模型和值；原版负例保留，不能以成功标记替代验收。

本次仅运营正文升v1.4：已核对原用户消息并保留既有追加，工具对客附加费显式0，官方quote/artifact不改；其他规范正文仍v1.3。来源登记含消息ID/时间/原始文档。#19/#20已完成，历史“尚未运行”不作当前状态；#21独立实现不增加新条件。

当前状态：发布开发已完成，后续43模型真实首发亦已部署并独立公网QA通过。#18/#19/#20/#21均保持关闭；[父汇总与AC追溯](https://github.com/naoshengyun/llm-metadata/issues/18#issuecomment-6946813733)、[既有地图回执](https://github.com/naoshengyun/llm-metadata/issues/6#issuecomment-6946855090)已记录实际完成，不重复新建回执。 正文版本不变，旧快照保留；当前状态与运营余项见[收口入口](CNY-PUBLICATION-FRONTIER.md)。
