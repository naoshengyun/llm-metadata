# PUB-T03 稳定入口提升与回退：本地演练和非启用候选

规范：[#18](https://github.com/naoshengyun/llm-metadata/issues/18)正式obs v1.3、[#21](https://github.com/naoshengyun/llm-metadata/issues/21)。#20经整票独立审查已由PR24合并e5cbf040关闭，才开始本票。实现维持同一集成分支，真实Pages/新许可/部署/首发选择仍另确认；不对任何网关实例写配置，不恢复或销毁保留的UI/I实例。

## 公开接口与状态

`src/cny/publication-promotion.ts`复用T02整包验证，不复制旧artifact或重算官方核价日期。

1. `preparePublicationTransition(current, files, identity, action)`重新核验当前全部历史固定包和目标包，生成完整部署快照、旧revision/旧release身份、目标身份、模型/插件/工具语义diff和planId。rollback只能选已保留版本；历史文件拒变更。仅有插件/工具而未选模型的包不能提升为原生稳定模型源。
2. `executePublicationTransition(platform, plan, confirmation)`要求显式confirmed、确认者、批准引用和精确planId；入口私有复制固定输入，异步read/权限/claim等待后拒绝绑定变化，给submit独立payload副本，不以被适配器改写的对象作为期望值。验证快照/目标/diff一致，重建期望计划并检查旧revision。平台仅有read/既有attempt只读查询/权限/原子claim/整快照CAS-submit，接口没有网关应用能力。
3. operationId绑定planId、确认者及批准引用。平台在提交前持久记住它；先只读查询既有操作，再判断是否允许新提交。既有不明操作的核验独立于当前写权限，权限撤销、journal不可读或初始read失败都不能把旧unknown误改failed；精确目标读回才解除不确定。同一不明操作不盲重发，新的尝试须新的明确批准引用；既有成功结果返回already-applied。claim不是用户授权，它只是防重机制。
4. 提交前确定拒绝返回failed且旧入口保持；只有平台能证明未受理时才用PublicationNotSubmittedError。提交异常先记unknown并读回：精确匹配目标可确定applied，同时保留submission=unknown；旧版、其他版本或读失败保留unknown。禁止把所有超时都说成未提升。
5. `downloadStablePublication(base, expectedIdentity)`核对发现指针、固定版本整包及稳定模型字节；缓存混版时拒绝并提示固定URL/hash。它是维护者读取验证接口，不改原版网关协议、不充当代理。

快照包含 `versions/<releaseId>/` 的所有T02原文件、`current.json` 发现指针、`api/newapi/ratio_config.json` 稳定原生模型envelope和`.nojekyll`。指针不是rc50倍率协议。全部来自同一目标包的稳定入口在同一部署快照生成，但不承诺公网不同请求的全球原子读；严格确认/应用使用固定版本URL及外部manifest hash。回退源只改变源，不恢复实例、不重算账单。

## 维护者本地命令（不替代运营模型页面）

先编译 `npx tsc --outDir .cache/cny-build`。准备一个显式请求JSON：`stateDir` 是已创建的本地状态目录，`packageDir` 是已核对T02版本目录，`identity` 含releaseId/manifestSha256，`action` 为promote或rollback。初始目录没有publication-state.json表示尚无稳定版，不替用户挑默认首发列表。

```text
node scripts/publication-transition.mjs prepare request.json plan.json
审阅完整plan/diff/selection/日期/hash，另提供confirmation.json
node scripts/publication-transition.mjs apply state-dir plan.json confirmation.json receipt.json
node scripts/publication-transition.mjs verify state-dir expected-revision
node scripts/publication-transition.mjs export state-dir new-site-dir expected-revision
```

确认记录为 `{confirmed:true, actor:"明确确认者", approvalRef:"实际批准记录", planId:"精确计划ID"}`。本地测试只使用明确test批准引用，不伪装首发批准。输出plan/receipt/目录拒覆写；有receipt先读而不是盲重跑。apply在提交前独占预留receipt目的地，父目录须已存在，receipt必须在state-dir之外，不能与state/journal/锁混用；可预见的目的地错误先失败而不改源。failed/unknown非零退出并保留JSON；若结果已取得而后续回执持久化失败，stdout保留该结构化结果及receiptPersisted=false并非零退出，不能把报告失败误当未提升。status/submission均须查看，零退出也不代表真实Pages已部署。LocalPublicationPlatform对本地state使用独占锁和rename整快照，检查旧revision；attempt记录保留在本地目录，不进公开快照，不证明真实Pages支持全局CAS。

附加 `candidate` 参数的verify/export拒绝当前或任何保留历史版本purpose=test，避免把本地测试固定URL一起公开。真实候选状态须与开发演练状态分开；只有明确人工核价/首发选择与对应candidate包能进入未来真实发布候选，现有四项/53项或本票A/B测试不自动获选。

## 已批准验证位置与可重复入口

- S：`npm run test:cny`包含public plan/confirmation/receipt、三分区语义、不可变历史、缺文件/损坏、权限、重复/unknown防重、确认失效与本地CLI导出。使用真实生成器/包接口和确定性平台mock，不mock内部协作者。
- H：同套测试的独占loopback server下载完整快照，验证同版及缓存A/B混读拒绝；这些HTTP向量不等于公开Pages验证。
- 原版H：`node scripts/check-publication-source.mjs 固定artifact.json --publication-transitions`，新建自己的隔离官方rc50容器，从宿主loopback HTTP执行A→B→A，每阶段原生fetch及全部所选mode/expr preview精确一致；保留原三类envelope负例，完整配置前后相等、供应商0、价格写入0，只清理自身临时H容器。不使用保留UI/I。
- 逐行为红绿与后续回归日志：`/tmp/cny-pub-t03-evidence/`。开发时H日志与最终固定commit验证分开归档，前者不冒充后者。

| AC | 本票证据 |
|---|---|
| PUB-AC-05 | 同快照pointer/native模型源，整包与历史校验，known-before失败/unknown读回，HTTP缓存混版拒绝 |
| PUB-AC-06 | 提升/回退各自plan/actor/approval/diff/receipt/readback，原版H A→B→A；无实例写入 |
| PUB-AC-07 | 确认与权限mock、防重/CAS、只手动非启用模板、完整SHA/部署job权限分离 |
| PUB-AC-09 | 原publication-record/artifact全部字节保留，构建/提升/回退不更新核价日期 |
| PUB-AC-10 | 回执instanceConfiguration=not-written，源回退不解释为配置/消费/可售通过 |

独立QA在首版5564f991f发现PROM-F1（异步可变确认）、PROM-S1（旧unknown遇权限变化误失败/初始read异常）、PROM-S2（提交后才发现回执路径错误）；原不通过报告 `qa-evidence/pr25-5564f99/REVIEW.md` / SHA256 `8a9c606c577ecc75385927c8ee7a0810acd3f34c0ee395214daa3c54aeab97b8` 保留。修复按同票S seam逐项红绿并重新提交固定head，独立结论须另取得；正向H或原96/98测试不能替代这些反例关闭。

## 后续运营政策的来源区别

Spec/Tickets/design冻结v1.3仍是本票AC来源。Planner维护的ops正文末尾随后追加“工具分区对客统一零价”，当前obs文件SHA256 `a15caaff37713a133f53430fd144163d1ab90f3743ac85344e05ec3efea60876`，不等于旧冻结v1.3 ops hash，不能笼统说四源均未变。其已记录语义是非零工具报价只作成本参考，不能直接作为脑生云对客应用值；实际工具配置须全目标键显式0并遵守fresh全表/独占/读回。该补充不授权本票改不可变官方quote/artifact或写工具设置，也不改变源提升/回退AC。实际首发选择及运营接入须纳入此后续政策；来源登记/规范版本由Planner维护，不能把历史非零工具包直接当当前客户收费配置。

## 非启用Pages候选与真实执行前缺项

候选位于 `.github/naoshengyun-workflow-templates/publish-pages.yml`，不在可执行workflows目录，deploy另有硬性if:false。没有启用、没有新Actions运行；已有只读候选workflow逐字节保持，不触发继承workflow。

候选只workflow_dispatch，绑定组织/业务分支/固定源码SHA、精确snapshot revision、release/hash、planId及批准引用；从受审checkout中的tracked单文件/状态读取，拒绝test选择，核验计划和完整快照后仅输出已核验文件。build为contents:read，不用contents:write；未来deploy才声明pages:write/id-token:write及github-pages environment。统一concurrency不取消已运行发布。确认JSON是记录与字节门禁，不是身份签名，真实用户授权和受保护environment仍须独立成立。

动作审查：checkout `11d5960a326750d5838078e36cf38b85af677262`、setup-node `49933ea5288caeca8642d1e84afbd3f7d6820020`、upload-artifact `ea165f8d65b6e75b540449e92b4886f43607fa02` 沿用固定pin。候选新增官方deploy-pages v4 `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`（官方API读取确认），**当前白名单未增加**。不用upload-pages-artifact v3的复合动作，因为其固定外层仍引用mutable upload-artifact@v4；改为对已核验纯文件目录生成artifact.tar，再使用现有完整SHA上传。

官方依据：[Pages自定义workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[固定官方打包动作定义](https://github.com/actions/upload-pages-artifact/blob/56afc609e74202658d3ffba0e8f6dda462b719fa/action.yml)、[固定官方部署动作](https://github.com/actions/deploy-pages/tree/d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e)。本地mock/权限声明不认证真实仓库具备Pages环境保护或网络可达性。

即使开发审查/合并/#21关闭，实际启用仍另呈：精确首发选择/完整包身份及diff、原日期/partial/excluded、当次批准人及记录、真实Pages设置、最小动作许可、受保护environment/分支/无绕过、冻结其他发布写入和串行入口。须在实际部署前新鲜读回并核对期望旧release/hash，不把本地revision CAS冒充Pages分布式CAS；部署后超时不盲重发，读回固定版本/指针/模型源及下载hash，无法确定就unknown。候选硬性禁用状态若要移除或增加这些live集成步骤，必须新固定diff审查和明确执行授权，不是本票已执行。

真实部署URL/run/event/source/workflowSHA/token权限/artifact ID+digest、公开网络读取/回退证据和运营可达性尚未取得。真实目标应用/恢复/usage/消费/账单、长期核价SLA和可售均不由本票完成；保留完整候选incomplete与141差5原事实。
