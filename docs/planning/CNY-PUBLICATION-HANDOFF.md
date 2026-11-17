# 发布开发交接回执（2026-11-17）

当前阶段：发布开发已完成，后续43模型真实首发亦已部署并独立公网QA通过。#18/#19/#20/#21均保持关闭；[父汇总与AC追溯](https://github.com/naoshengyun/llm-metadata/issues/18#issuecomment-6946813733)、[既有地图回执](https://github.com/naoshengyun/llm-metadata/issues/6#issuecomment-6946855090)已记录实际完成，不重复新建回执。 当前发布记录及运营余项见[收口入口](CNY-PUBLICATION-FRONTIER.md)。下文保留原交接/调查时点记录，其“尚未运行/当前可开工”等不再是实时状态。

## 历史记录（原文保留）


2026-11-17更新：v1.2已记录用户接受每次粘贴URL、保留原版；[#22已解决](https://github.com/naoshengyun/llm-metadata/issues/22)。#20恢复ready，仍依赖#19；#21仍依赖#20。PUB-AC-11页面运行/确认应用尚未验证，不得据ready或决定关闭宣称票已通过。当前来源见[登记](../requirements/publication-sources.json)，实际保存需准备独立目标/selection并另确认。

## 开发入口

- [正式Spec #18](https://github.com/naoshengyun/llm-metadata/issues/18)；[开发授权 #17](https://github.com/naoshengyun/llm-metadata/issues/17)。
- 当前首票：[PUB-T01 #19](https://github.com/naoshengyun/llm-metadata/issues/19)。后续[包交付 #20](https://github.com/naoshengyun/llm-metadata/issues/20)阻塞于#19，[提升/回退 #21](https://github.com/naoshengyun/llm-metadata/issues/21)阻塞于#20；native parent/blocked_by已读回。
- 唯一维护源在obs outputs/qa，[路径、版本、SHA256及执行票映射](../requirements/publication-sources.json)。固定快照commit `951a03fb0aef398af6f0ada6ae492da5bd314642`；仓库原草稿路径现在仅是索引。

## 已完成与待做

原T1—T7价格源开发、原候选和手动候选CI按各自固定历史证据解释；本地I应用及新授权恢复已独立QA PASS，当前夹具不触碰。发布规划、正式来源迁移、Spec/三票登记已完成；尚无本轮发布实现/测试/QA/部署结论。完整包仍incomplete，136参考/141差5保留。

从业务base `f616d0a927caae1cab5b3fad96784c7d10c588f6`及本规划分支正式来源开始，核查实际工作树和项目规则；不要把镜像main缺业务文件当成未初始化。原artifact `18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138`不改；固定原版rc50对象 `f2aa91232ed3e5878a614762ace6736a2b74257f`。

首票完成固定候选→明确测试选择→success/data模型发布响应及新身份→独立隔离原版HTTP fetch/preview。发布侧验证完整性；原版type1解析只需任一已知字段，不能把fetch成功当全包完整。测试selection不等于首发名单。

AC分配：T01主责PUB-AC-01/02/03/09；T02主责04/08/10并回归01/03；T03主责05/06/07并回归09/10。S为固定输入/产物/语义；H为本地静态HTTP+独立隔离固定rc50 fetch/preview，只读无价格保存；权限和提升/回退使用确定性mock。每票按自身演示、负例、固定实现commit和独立审查证据关闭，前置关闭后下一票开工。

## 权限边界

可做已批准本地开发/测试及非启用候选配置。不得开通Pages、变更真实仓库许可、启用workflow/部署、默认确认首发selection、写实例价格、调用供应商或清理当前I夹具。后续真实运营动作独立确认，不反向阻塞本地开发。原线程Planner正式向Dev发送本交接，本任务未另联系Dev。

## 验证回执

四份新obs正文与仓库快照逐字节/SHA256一致；原v0.12规范与快照不变。新增obs/仓库相对链接检查通过，PUB-AC-01—10均有票覆盖。Obsidian CLI可用；全vault `unresolved total`回334，该值是全库既存汇总，不宣称整个vault零未解析链接。本批新增相对链接另行逐项存在性验证通过。文档变更仅运行适度校验，未跑计费/部署/供应商测试。

2026-11-17技术修正：正式来源升v1.3，PUB-AC-02编号保持但原文已修正。rc50空message错误envelope可能test_results success、无可用所选价格。发布侧严格success===true/data/所选字段校验；valid H必须全选择/全值精确匹配，空message负例不得改为仅带message。#19尚未关闭，不能将失败尝试称H验收通过。见[正式来源登记](../requirements/publication-sources.json)。
