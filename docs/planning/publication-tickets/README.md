# README：正式发布票来源入口

唯一拆解正文：`/Users/kohr/baymax_work/obs/outputs/qa/2026-11-17-脑生云CNY价格源发布任务拆解.md`。

- [v1.1固定快照](../../requirements/snapshots/publication-v1.1/2026-11-17-脑生云CNY价格源发布任务拆解.md)
- [来源登记](../../requirements/publication-sources.json)

开发方案已批准；执行票与实时依赖见来源登记的tracker字段。T01→T02→T03，后续票在前置关闭后开工。源正文先改、升版本再出新快照，不在此维护第二份票正文。

## 已登记执行图

父[Spec #18](https://github.com/naoshengyun/llm-metadata/issues/18)下：

1. [PUB-T01 #19](https://github.com/naoshengyun/llm-metadata/issues/19)：无前置，当前可开工。
2. [PUB-T02 #20](https://github.com/naoshengyun/llm-metadata/issues/20)：native blocked by #19。
3. [PUB-T03 #21](https://github.com/naoshengyun/llm-metadata/issues/21)：native blocked by #20。

T01/T03保持ready-for-agent，T02为needs-info（页面效果待证），后续票只有前置关闭后可开工。本文是2026-11-17登记回执；实时状态以GitHub为准，不另维护第二份状态机。

最新页面效果要求已纳入v1.1，见[缺口记录#22](https://github.com/naoshengyun/llm-metadata/issues/22)。T02暂needs-info；T01格式开发仍ready，T03无新增页面AC，保留原有包依赖。旧v1.0快照未修改。
