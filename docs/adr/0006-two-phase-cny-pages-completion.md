---
status: accepted
recorded_at: 2026-11-24
scope: cny-pages / two-phase-completion
---

# 公网读回后提升 CNY Pages 完成状态

用户批准采用两阶段发布，并接受第二次部署期间的短暂可见窗口及非绝对原子的恢复边界。静态 Pages 不能同时保证“只有最终验证成功才出现 complete=true”和“任何失败都始终保留旧 current”。本决定不把部署 API 成功当作公网验证成功。

## 阶段与证据

1. 固定候选和初始站点只生成 `complete:false`。初次部署后，独立 job 按初始站点清单读取首页、指针、稳定 JSON、全部固定版本和保留文件。只有这次全量 HTTP 验证成功，才记录 `cny-pages/candidate-verified`。
2. 提升命令同时核对封版收据和候选公网证明，生成独立 `completion-receipt.json`。候选证明必须显式为 `complete:false`，并携带与提升调用完全一致的 run ID/attempt；缺字段、错类型或交叉运行均拒绝。收据绑定 `sourceSha`、`releaseId`、初始 `site-manifest` 哈希、初始封版收据哈希、初始 pointer 哈希、run ID 和 attempt。提升只修改根 `current.json`、根 `site-manifest.json` 并添加该收据；`versions/<release>/` 和原生价格 JSON 不变。
3. 收据不包含最终站点或 pointer 哈希，因此不形成循环哈希。第二次部署前再次核对业务分支和初始 pointer。最终 job 使用另一站点哈希验证 `complete:true`、收据及所有文件，并核对 run ID/attempt，只有成功才写 `cny-pages/verified` 和最终站点哈希。后续发布只把 final verified 作为 predecessor，候选状态不能成为前驱。

提升 job 不持有 Pages/OIDC 权限；两次部署继续使用既有受保护环境和固定 Action SHA。提升及第二次部署前均拒绝过期业务提交、已改变 pointer 和并发替换。

## 失败与兼容

恢复接受已知的初始失败 pointer 和提升后失败 pointer；旧 predecessor 或任一已知失败 pointer 可进入恢复判断，未知或更新 pointer 不覆写。恢复包仍须先通过固定版本校验，恢复部署后还需公网读回。恢复失败只报告诊断，不承诺旧 `current.json` 在每个故障时点都仍然存在。

普通快照和恢复读取继续兼容旧 `complete:false` 或缺少 `complete` 的 schema-3 当前指针；初始候选验证严格要求显式 `complete:false`，最终完成验证严格要求 `true` 和有效收据。

发布完成只描述上述 Pages 阶段已经读回，不表示目录覆盖已完整、价格已应用到实例或模型已可售。实现与测试只产生本地产物，不执行实际部署。
