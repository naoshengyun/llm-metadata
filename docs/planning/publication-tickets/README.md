# 候选窄纵向拆分（待确认，不是执行票）

共同父草稿：[发布增量](../CNY-PUBLICATION-DRAFT.md)。状态均draft-awaiting-user；新Spec、业务选择及H测试位置未确认，不发ready-for-agent。

1. [原候选到原生模型源契约](PUB-T01.md)：无票间阻塞；前置用户批准增量/粒度/H位置。输出完整模型fetch演示、三分区边界与拒绝反例。
2. [固定版本包的HTTP交付与运营接入](PUB-T02.md)：Blocked by PUB-T01。输出完整版本包下载/校验、分区说明，独立可演示。
3. [受控稳定入口提升与回退](PUB-T03.md)：Blocked by PUB-T02及A/B审批（Pages方向及手动策略已定）。输出手动门禁、提升/回退本地演练、独立审查材料。

每票一条可验证完整路径，不拆成只写schema/只写workflow的横向票。真实发布/权限启用/公网运行回执是后续明确授权动作，不能凭开发票关闭推断。请用户确认粒度、依赖是否正确、是否合并/拆分；批准后才由Planner/原任务发布到组织tracker并建立native依赖。无原T1—T7重复票，无全136/O前置。

## AC覆盖与开工门禁

| 候选票 | 主责AC | 复用/回归AC | 决策门禁 |
|---|---|---|---|
| T01 | PUB-AC-01/02/03/09 | 无 | D2分批规则已满足；增量Spec、S/H及粒度批准仍待完成 |
| T02 | PUB-AC-04/08/10 | PUB-AC-01/03 | T01关闭及共同Spec/粒度批准 |
| T03 | PUB-AC-05/06/07 | PUB-AC-09/10 | T02关闭；D1/D3已满足，A与B（D4/发布格式）仍待批准 |

三票均附独立演示和关闭证据，不重复新建原执行票。无票间阻塞不等于可立即开工：当前共同审批门禁尚未满足。精确首版名单不阻止使用明确测试selection开发，但未确认名单/版本/发布意图不得实际发布。

2026-11-17状态推进：PUB-D1/PUB-D2/PUB-D3均已确认，见[决定记录（#14）](https://github.com/naoshengyun/llm-metadata/issues/14)。D2见[分批发布记录（#15）](https://github.com/naoshengyun/llm-metadata/issues/15)。D3见[手动策略记录（#16）](https://github.com/naoshengyun/llm-metadata/issues/16)，不重复问。三票仍draft-awaiting-user；供原线程审批的行为/粒度对照见[第二轮前沿](../CNY-PUBLICATION-FRONTIER.md)。

剩余批准入口：[审批表A（三票与S/H）及B（D4设计）](../CNY-PUBLICATION-APPROVAL.md)。A/B分别约束票的前提，未批准不得通过候选票文字反推开工权。
