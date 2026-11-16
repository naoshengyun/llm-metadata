# 统一 CNY 决策索引与依赖

唯一tracker地图：[决策地图：统一 CNY 价格源的已确认选择与后续验收边界](https://github.com/naoshengyun/llm-metadata/issues/6)。本文件只对照原D编号、来源状态和历史Ticket边，不是地图之外的第二个决策答案库。核心需求和后续授权优先级见[来源登记](../requirements/CNY-SOURCE-REGISTRY.md)。

## 已确认 / 部分待定（保持原D编号）

| 原决定 | 已确认部分（摘要） | 尚未决定或建议部分 | 具名记录与依据 |
|---|---|---|---|
| D01 官方价格源范围 | 全平台文本/图像/视频，覆盖参考不丢；官方基准与采购成本分开 | 141/136差5保留；不补造或要求全调用后才开发 | [确认记录：官方基准、币种归一与运营职责](https://github.com/naoshengyun/llm-metadata/issues/7)；Spec§1—2 |
| D02 持续同步布局 | 单fork、main纯镜像、业务分支与同步PR；后续组织/默认分支和手动CI已按授权落地 | 历史定时/自动同步/稳定发布仅建议，未启用/未批准；可变门禁以CI手册为准 | [确认记录：单 fork 隔离、同步 PR 与手动候选 CI](https://github.com/naoshengyun/llm-metadata/issues/9)；[ADR3](../adr/0003-single-fork-source-isolation.md) |
| D03 核价维护 | 源币种/单位/收费项/来源日期完整性，构建不刷新核对日期 | 长期维护责任/频率/时限由运营细化，不是D开工条件 | [确认记录：官方基准、币种归一与运营职责](https://github.com/naoshengyun/llm-metadata/issues/7)；原决策清单 |
| D04 确认与应用 | 固定候选、明确目标/确认和运行时权限输入，复用原生接口 | 具体目标/角色/执行意图仍待确认；不新造双人审批或以姓名阻塞D | [确认记录：原版复用、价格形状与受控应用边界](https://github.com/naoshengyun/llm-metadata/issues/8)；开放输入/确认子记录 |
| D05 数据及应用异常 | 不完整对应新价拒绝；冲突/部分失败/未知读回分别记录 | 存量销售暂停/宽限等运营政策未定，不以实现现状默定 | [确认记录：原版复用、价格形状与受控应用边界](https://github.com/naoshengyun/llm-metadata/issues/8)；Spec§3/5 |
| D06 官方字段适配 | 仅价格数据/输出最小适配，缺原生schema/meter明确unsupported | 不以平均价/二扣或新meter消除未知 | [确认记录：原版复用、价格形状与受控应用边界](https://github.com/naoshengyun/llm-metadata/issues/8)；[ADR2](../adr/0002-reuse-native-billing-boundary.md) |
| D07 原版边界 | 固定原版rc50，不改核心/升级/扩插件或增加代理/第二扣费 | 新API fork、升级和蓝绿仍非本次已批准选择 | [确认记录：原版复用、价格形状与受控应用边界](https://github.com/naoshengyun/llm-metadata/issues/8)；Spec§2 |
| D08 任务与未知 | 同task提交价快照、新尝试新价、原文本边界保持 | 404/丢ID/退款迟到恢复为R风险，不在本轮重建或宣称解决 | [确认记录：原版复用、价格形状与受控应用边界](https://github.com/naoshengyun/llm-metadata/issues/8)；Spec§2/7 |

建议与待定不是同一状态：定时workflow、目录命名/旧生成器参数例、自动稳定源发布、独立双人审批/固定宽限期等未自动转为批准。当前已确认的7一次归一、站内单位、原版与运营职责不重访谈。

## 决策记录依赖与前沿

原生父子关系与依赖在GitHub实际建立，ID仅作为具名链接的内部身份。已确认归档记录的关闭表示已有批准与实现核对完成，不是本轮替用户作新决定，也不是执行/销售/生产验收关闭。

| 决策记录 | 状态 | 直接阻塞项 | 责任边界 |
|---|---|---|---|
| [确认记录：官方基准、币种归一与运营职责](https://github.com/naoshengyun/llm-metadata/issues/7) | 已确认归档 | 无 | 保留D03/D05运营未定部分 |
| [确认记录：原版复用、价格形状与受控应用边界](https://github.com/naoshengyun/llm-metadata/issues/8) | 已确认归档 | 官方基准、币种与运营职责记录 | 仅已批准原版价格契约 |
| [确认记录：单 fork 隔离、同步 PR 与手动候选 CI](https://github.com/naoshengyun/llm-metadata/issues/9) | 已确认归档，独立 | 无 | 同步/CI事实范围，不批准定时或发布 |
| [待定输入：所选 stg 目标、映射与实测条件](https://github.com/naoshengyun/llm-metadata/issues/10) | 待定输入，开放 | 原版复用/形状/受控应用记录（已关闭） | Planner/运营按所选路径补齐；不收集秘密或全136前置 |
| [待定确认：固定候选的实例应用与配置恢复意图](https://github.com/naoshengyun/llm-metadata/issues/11) | 待定确认，开放 | stg输入（仍开放） | 固定目标/候选/选择/权限及新恢复意图；不授权实际执行 |

前沿是补齐所选stg输入；应用/恢复确认继续被该开放项阻塞。收集输入也不意味着必须执行stg。长期维护频率/存量销售政策仍由Planner/运营处理；本轮只保留原未定状态，没有把它们新增成D阻塞或自动决定。

## Ticket实施依赖与验收边界

[T1—T7及30AC追溯](../requirements/CNY-TRACEABILITY.md)逐行保留原归属。T1→T2/T3/T4→T6→T7；T5独立，不能把托管/生产资料或141差5加成D硬依赖。GitHub新记录是需求/决定索引，不复制或重新分配历史实现Ticket。

D已支持/拒绝契约的通过不等于每条实际价目已ready；I不等于供应商计量/真实扣费；CI不等于发布或应用。所选stg方案需要的六类输入和实际授权见[方案](../stg/CNY-INTEGRATION-ACCEPTANCE.md)，尚未执行。
