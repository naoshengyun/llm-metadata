# CNY发布design：来源入口

正式正文已转入Obsidian：`/Users/kohr/baymax_work/obs/outputs/qa/2026-11-17-脑生云CNY价格源发布设计与开发授权.md`（v1.3，开发已批准，未部署）。

- [固定字节快照](../requirements/snapshots/publication-v1.3/2026-11-17-脑生云CNY价格源发布设计与开发授权.md)
- [来源登记及SHA256](../requirements/publication-sources.json)
- [开发批准记录（#17）](https://github.com/naoshengyun/llm-metadata/issues/17)

本文件只作索引。后续先修改obs唯一正文、升版本，再新增快照；不得单独编辑冻结快照。原仓库草稿保留在Git历史de10ec0，不再作为活正文。原Spec/Tickets v0.12未改。

最新页面效果要求已纳入v1.3，见[缺口记录#22](https://github.com/naoshengyun/llm-metadata/issues/22)。T02恢复ready，运行验收尚未完成；T01格式开发仍ready，T03无新增页面AC，保留原有包依赖。旧v1.0快照未修改。

v1.3保留PUB-AC-02编号并明确修正原文：原版空message错误envelope可能标success却无可用价格。发布侧严格校验，valid H核对全部所选模型和值；原版负例保留，不能以成功标记替代验收。
