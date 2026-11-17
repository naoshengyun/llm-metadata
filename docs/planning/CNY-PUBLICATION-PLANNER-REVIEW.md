# Planner首轮发布规划审阅（2026-11-17，历史审阅时点）

后续更新：PUB-D1已确认Pages，PUB-D2已确认分批规则（[记录#15](https://github.com/naoshengyun/llm-metadata/issues/15)）；D3后续已确认（#16），原待答状态已被替代。托管见[决定记录（#14）](https://github.com/naoshengyun/llm-metadata/issues/14)及[当前决策前沿](CNY-PUBLICATION-FRONTIER.md)。下文保留首轮回执，不再按其托管问题访谈。

首轮状态：待用户决策；不是已批准Spec或ready票。本轮由Planner规划职责直接完成，不交Dev起草，不新建规划任务。原讨论与业务决定留在Cindy线程 `8bfd5c3c-28db-436b-8f99-d3b3a18e5ebb`。

## 固定输入与产物

- 待审输入：`docs/cny-publication-planning@fb78b59a12d6043575b91cef72ff441e26e9c856`，业务base `f616d0a927caae1cab5b3fad96784c7d10c588f6`。
- 本轮独立分支：`docs/cny-publication-planner-review`；目录 `/Users/kohr/brainx_ai/llm-metadata/.cindy-worktrees/dazzling-hopper`。从固定输入建分支，未覆盖Dev目录。
- 审阅产物：[增量Spec](CNY-PUBLICATION-DRAFT.md)、[事实证据](CNY-PUBLICATION-FACTS.md)、[运营接入稿](CNY-PUBLICATION-OPERATIONS-DRAFT.md)、[三票与AC映射](publication-tickets/README.md)。本文是回执，不另存规范正文。
- 当前无发布PR、无发布执行Issues；候选不具备ready资格。原obs Spec/Tickets v0.12及快照保持原hash，原AC-01—30不改。

## 实质审阅修正

1. **补齐success仍不足以证明完整性。** 固定rc50会接受仅含任意一个已知模型价字段的data；所选mode/expr齐全、缺分区、混版本由发布侧校验，不能写成原生fetch保证。PUB-AC-02及T01明确正负例和责任位置。
2. **精确名单与开发测试分开。** 子集政策仍待确认；测试selection不等于首版批准。发布前按候选/选择/适配器/实际输出hash重新确认；保留136参考行、不同计数单位、可表达未选与原excluded区别、141差5。不得把53候选或四项I视为默认名单。
3. **HTTP测试不重用I。** H拟使用独立隔离原版只读fetch/preview，验证HTTP消费并留无配置写入证据；旧I是保存/恢复证据，当前运行夹具不动。H仍待用户接受，不声明已测试。
4. **失败结果按阶段区分。** 提交前失败保留旧稳定入口；提交后回执不明需读回、标unknown，不能笼统承诺一定未发布。源回退不恢复实例。manifest自身hash用外部回执/指针绑定，避免循环定义。
5. **票关闭不冒称上线。** 三票增加seam、可独立演示、稳定AC及证据清单。T03关闭只证明本地/mock和候选配置，通过后真实权限、精确版本批准、部署及公开下载另验。

## 地图核对

已读取[统一CNY决策地图（#6）](https://github.com/naoshengyun/llm-metadata/issues/6)与[恢复独立QA回执](https://github.com/naoshengyun/llm-metadata/issues/11#issuecomment-6934368738)。#6将稳定发布移入新增规划、保留执行范围外的语义，与当前授权一致；其引用fb78草稿仍只是待审输入。本地应用/新授权恢复完成，不再新增执行票。#6/#10/#11保持OPEN；#5/#7/#8/#9已CLOSED。真实业务验收余项不成为价格源开发或发布准备的全局前置。

本轮保留地图现有正文，向原线程提供本固定审阅产物；待讨论产生实际决定后，原线程再更新具名记录和地图索引，避免并行编辑覆盖。没有把建议写成已解决决定。

## 当前最小决策与后续顺序

**先问托管方向：是否以现有组织仓库GitHub Pages作为首版稳定模型源的规划目标？推荐“是”。** 复用组织归属，适合固定静态JSON及稳定消费地址；仍须另审发布权限和流程。备选Release固定包保留，但其稳定原生模型入口/重定向/缓存契约未定，不能当作等价免配置替代。现在无可用发布地址，不开通部署。

Pages API本次404、Release空；官方文档确认自定义部署涉及pages/id-token权限及environment，与当前仅三个精确SHA许可的候选CI不同：[官方部署要求](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。中国网络可达性/SLA未验，不承诺。

后续由原线程按回答推进：D2显式子集规则、D3人工核价PR/手动发布建议；D1确定后才能具体化D4发布权限。再展示三张候选票的粒度/真实依赖及H测试位置，获得确认后才建立正式增量入口与ready执行票。精确首版名单在发布前单独展示确认。D2/D3可独立讨论，不假称依赖D1；本轮只呈现一项以降低用户负担，其他待定不作默认同意。

## 检查范围

只读核对固定源码、Git refs、GitHub状态与官方托管说明；对原obs规范和快照重算SHA256并逐字节比较一致。完成PUB-AC覆盖、相对链接及git diff空白检查。未运行计费套件、未实施产品代码、未触发CI/发布/实例写入/供应商调用/清理。

2026-11-17最新：PUB-D3已确认人工核价PR→审阅固定候选→手动发布指定版本，无定时/代码提交自动发布，上游同步分开；实际发布版本另确认。[决定记录（#16）](https://github.com/naoshengyun/llm-metadata/issues/16)。长期SLA、精确名单、权限启用或部署未获批准；剩余审批见[三票/S-H及D4表](CNY-PUBLICATION-APPROVAL.md)。
