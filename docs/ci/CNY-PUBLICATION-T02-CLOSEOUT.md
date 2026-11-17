# PUB-T02 原条件收口核对

执行票[#20](https://github.com/naoshengyun/llm-metadata/issues/20)，正式规范是Planner维护obs发布Spec/Tickets v1.3及其固定快照98fd6ed；本页仅记录实现证据及执行状态，不新增或改写AC。#19已关闭，#21依赖#20关闭。

2026-11-17后续用户经486宿主核实转交明确“那你推进吧”：取消等待页面恢复确认作为#20/PR24收口及继续#21的额外阻塞。原条件不要求恢复；原页面输入→拉取→逐模型选择/预览→确认保存→结果核对仍完整要求且已有证据。当前独立UI实例保持应用态，不恢复、不销毁、不供应商调用、不操作生产。恢复proposal作为另行处置保留，不作本票前置。

| #20原条件 | 实现/可独立验证的证据 | 当前核对 |
|---|---|---|
| PUB-AC-01 固定身份/字节/拒覆写 | publication与publication-package公开接口；确定性/重排选择/独占写入回归 | 已满足，沿用固定代码独立测试 |
| PUB-AC-03 合格子集/完整参考/排除/partial | 每分区从原候选重生成并核价；拒绝坏来源工具贡献者；保留artifact原字节、136原参考、141差5、selected/notSelected/excluded与complete=false；full拒不完整 | 已满足；测试选择不等于首发 |
| PUB-AC-04 inventory/外部manifest hash/整包失败 | 10文件固定包、逐字节inventory、重建语义验证；真实loopback HTTP完整/缺文件/坏字节/混版本/BOM/UTF8及拒覆写回归 | 已满足；manifest不循环包含自身hash |
| PUB-AC-08 分区运营接入 | 包内OPERATIONS.md、页面矩阵、具体工具平铺map与文件wrapper区分；插件model→plugin→expr对象；工具千次/独占/无CAS，CNY预检 | 已满足；不承诺一个模型URL导入三分区 |
| PUB-AC-10 源回退≠实例恢复，分层验收 | 包内说明及应用/恢复提案分别记录；下载/配置/调用/计费/可售区别 | 已满足；未执行恢复不影响本条正确说明 |
| PUB-AC-11 真实原版页面完整模型路径 | 新独立UI目标rc50/cnyui Root；实际完整URL/fetch/逐行2模型选择/完整expr预览/重填，另获授权后单位Save+Confirm Changes及刷新后的完整page/GET结果 | 已满足；实际保存批次独立QA PASS |
| PUB-AC-11 角色/非持久源/旧身份及独立分区入口 | 超级管理员id1、刷新/外窗关闭回默认后重填、旧Official徽标限制；Sora通用插件编辑器和工具visual/JSON入口实际核对 | 已满足原“分别验证/说明”条件；不外推doubao具体variant或工具应用 |

## 固定版本证据链

- 代码修复d08753652e0cfd50def0847e9accd6ea85943982：包级独立80/80及PKG-F1原反例关闭，报告 `qa-evidence/pr24-d087536-preliminary/REVIEW.md`，SHA256 `2a7030498bdf8d090e5345f511cb5a2a6f24866b3c84d8ee203b1dab17347eb9`。并未仅凭该初审关闭整票。
- 只读页面aac600fff568179876f132556ac60161c566155e：25安全文件/独立现场GET及真实页面证据，报告 `qa-evidence/pr24-aac600f-readonly-ui/REVIEW.md`，SHA256 `d90224071bd0c25cbc38d22f64942596090ef66c92c271bcf47a7a5a22b53218`。
- 新授权真实保存执行aac600fff、文档c98403dc928ab7f7f1e5d05f68ca622b7352017e：36安全文件、native元数据、各中间state、页面持久化完整值及独立GET，报告 `qa-evidence/pr24-c98403d-ui-save/REVIEW.md`，SHA256 `7b982d744a642f646b0d7c97d71c69bf4eda5b98f18ec2a5b8d565043454f340`。

以上报告均在独立QA worktree的qa-evidence目录，执行者证据分别保留独立归属；没有把helper日志当全浏览器流量、请求/响应body或瞬时写入的完整证明。捕获失败和检查脚本误分类失败历史保留，不重放保存。

测试包release `67249fee2a6946d6a4b1d8fe32aa3892a744e10f0cefbc922d2384bd4591e187`、manifest SHA256 `99982caa63031a33d17f53e28f3587a1a4be410e90ea254e405375acf709eb1e`，原artifact18098469…/原字节f2f6540a…未变。非首发、完整包incomplete、真实Pages/公开URL/新许可/部署未执行。历史受控CI只绑定其原commit，没有为本PR新运行或声称CI通过。

当前收口请求只改变文档及PR/Issue状态，需既有QA对新head按整票原条件给出Standards/Spec结论；审查通过且远程规则满足才ready/merge/关闭#20。当前核对未发现需要恢复或新增写入的真实AC缺口。关闭后#21按已批准S/H与确定性平台mock实现稳定入口提升/回退及非启用候选配置，真实Pages开通/Actions许可/部署试跑/首发精确选择仍单独确认。
