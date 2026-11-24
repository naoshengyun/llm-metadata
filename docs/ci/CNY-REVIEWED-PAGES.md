# 审核后发布 CNY 页面和价格源

`naoshengyun` 是业务分支。PR 的 `CNY reviewed build` 检查运行 GitHub 生成的模拟合并提交，测试自有价目、币种、显式选择和完整收费条件，构建页面与原生 JSON，再用真实 Chrome 检查桌面、移动端、复制下载和固定文件。检查上传文件校验和、浏览器证据及报价语义差异。PR 检查仅持有只读内容权限。上游同步须保留业务工作流隔离，继承的工作流仍放在 `.github/upstream-workflows/`，自动维护分支使用仅限所需数据/API 的凭据。活动工作流及规则定义的改动必须作为明确的人审变更提交。

## 配置和读回

首次启用前，在真实业务 PR 上确认检查名称及 GitHub Actions App ID。由仓库管理员应用 [分支规则配置](../../.github/cny-branch-rules.json) 并读回。若同名规则集已存在，读取其 ID 并对该规则集使用 PUT，避免重复创建。保留 GitHub Pages 的 Actions 发布方式及 `github-pages` 环境仅允许 `naoshengyun` 部署。保留精确 action SHA 白名单和关闭自动合并的仓库配置。自动化凭据不得进入分支规则的绕过名单。

```sh
repo=naoshengyun/llm-metadata
gh api "repos/$repo/commits/<simulated-merge-sha>/check-runs" \
  --jq '.check_runs[] | [.name, .conclusion, .app.id]'
gh api --method POST "repos/$repo/rulesets" --input .github/cny-branch-rules.json
gh api "repos/$repo/rulesets/<ruleset-id>" > /tmp/cny-ruleset.json
node scripts/check-cny-rules.mjs /tmp/cny-ruleset.json
gh api "repos/$repo/rules/branches/naoshengyun" > /tmp/cny-active-rules.json
node scripts/check-cny-rules.mjs /tmp/cny-active-rules.json
gh api "repos/$repo/environments/github-pages/deployment-branch-policies"
gh api "repos/$repo" --jq '{allow_auto_merge, allow_merge_commit}'
```

启用后，新 PR 必须通过最新基线的检查，再由 PR 作者之外的账户批准。修改提交会取消旧批准。审核人核对来源、原币、价格条件、选择和差异，合并操作由人执行。合并策略使用 GitHub 的 merge commit。部署工作流还会核对实际规则、精确的已合并 PR、合并提交的第二个父提交以及当前 PR head 上独立人类批准的记录。

### 核对发布工作流的 Action 允许列表

GitHub 在创建作业前校验整份工作流，包括仅在发布失败后运行的恢复作业。变更发布工作流的 `uses:` 时，用 bash 对比待审核工作流与仓库允许列表。输出为空且仓库仍为 `selected`、`sha_pinning_required: true` 时，本项通过。

```bash
set -euo pipefail
repo=naoshengyun/llm-metadata
gh api "repos/$repo/actions/permissions" --jq '{allowed_actions, sha_pinning_required}'
allowed="$(gh api "repos/$repo/actions/permissions/selected-actions" --jq '.patterns_allowed[]')"
required="$(sed -nE 's/^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]+([^[:space:]#]+).*/\2/p' .github/workflows/naoshengyun-pages.yml)"
LC_ALL=C comm -23 <(LC_ALL=C sort -u <<< "$required") <(LC_ALL=C sort -u <<< "$allowed")
```

恢复作业需要允许 `actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093`，它从当次运行下载已验证的上一版恢复包。2026-11-19，仓库缺少这个精确条目，合并 PR #53 后的发布在创建作业前失败。补齐该条目后，GitHub 仍拒绝重试这次运行。公网继续提供上一版。遇到同类不可重试的启动失败时，修复并读回仓库配置，再通过下一次受保护的人工合并触发发布，并按下节验收新合并提交。[失败运行](https://github.com/naoshengyun/llm-metadata/actions/runs/44448259707)

## 发布结果

业务分支 push 发布同一提交构建的 Pages 包。构建只读已提交并校验的价格和上游资料，前一已发布快照用于撤价/恢复连续性及固定文件留存。当前业务基线领先于已发布快照时，检验也会基于精确的前一业务提交运行，保留已审核但仍待发布的生命周期和收费条件。提交中的 `asOf` 有明确时区，须已到生效时间。待生效报价可作为资料保留，选中的未来价会阻断检查。构建、提升和部署使用不同权限，只有固定的部署步骤持有 Pages/OIDC 权限。发布前再次核对业务分支和已验证的当前指针。工作流串行执行，过期任务不能提升当前版本。

初始包和根 `current.json` 均为 `complete:false`。初次部署后的独立 job 按初始 `site-manifest.json` 校验首页、资源、当前指针、稳定 HTTP JSON、固定版本及全部保留文件，成功时只记录 `cny-pages/candidate-verified`。提升命令同时核验封版收据和这份公网证明，生成绑定源码、release、初始站点/收据/pointer 哈希及 run ID/attempt 的 `completion-receipt.json`。提升只改根 `current.json`、根 `site-manifest.json` 并添加完成收据，不修改 `versions/` 或原生价格 JSON；收据不记录最终哈希，避免循环依赖。

提升和第二次部署前都重新核对业务分支与初始 pointer。第二次部署后的最终 job 按提升后的新站点哈希验证 `complete:true`、完成收据、run ID/attempt 和全部文件，只有成功才记录 `cny-pages/verified`。后续发布只把 final verified 当作 predecessor，候选状态不能成为前驱。失败或未确认记录在 Actions 概要；同一提交不会创建新的候选重发。运营仍通过既有流程自行应用价格，发布完成不等于覆盖完整、实例已应用或可售验收。两阶段边界及用户接受的短暂可见窗口见 [ADR 0006](../adr/0006-two-phase-cny-pages-completion.md)。

```sh
gh run view <run-id> --repo naoshengyun/llm-metadata \
  --json headSha,event,conclusion,jobs,url
node scripts/cny-pages-release.mjs verify-candidate \
  https://naoshengyun.github.io/llm-metadata/ <merged-source-sha> <initial-site-manifest-sha256> <run-id> <attempt>
node scripts/cny-pages-release.mjs verify-complete \
  https://naoshengyun.github.io/llm-metadata/ <merged-source-sha> <final-site-manifest-sha256> <run-id> <attempt>
```

恢复接受旧 predecessor、已知初始失败 pointer 和已知提升后失败 pointer；未知或更新 pointer 会拒绝覆写。恢复仍须验证恢复包和恢复后的公网文件，失败时明确报告，不能声称整个第二次部署和恢复过程绝对原子。普通 `verify`/`snapshot` 继续兼容旧 `complete:false` 或缺少 `complete` 的当前指针，候选验证则严格要求初始 `false`。

暂时不可达或 CDN 切换期间只报告已知事实，保留最后验证的固定版本链接。以记录中的收据为准，确认实际公开版本前不要把 GitHub 部署 API 返回成功当作公网读回。

## 隔离复验

```sh
npm ci --ignore-scripts
npm --prefix web ci --ignore-scripts
npm run test:cny
work="$(mktemp -d)"
node scripts/build-reviewed-cny.mjs "$work"
node scripts/check-unified-site.mjs "$work/site" "$playwright_module" "$work/browser"
```

如需验证固定版本留存，在构建前用 `scripts/cny-pages-release.mjs snapshot <HTTPS 或本机 HTTP 站点> "$work/prior" <前一已发布源码 SHA> retain` 读取前一固定站点。构建后运行 `scripts/cny-pages-release.mjs seal "$work/site" "$work/prior"`，在本机 HTTP 提供该站点并用 `verify-candidate` 核对初始收据。`promote` 只接受匹配的封版收据、候选公网证明及 run ID/attempt，随后用 `verify-complete` 核对提升结果。`tests/pages-release.test.mjs` 通过本机 HTTP 演练成功、提前完成、证明不符、过期/并发、两类失败恢复、未知指针、固定文件保护和旧指针兼容。独立本地演练只产生隔离产物，实际 PR 检查、规则拒绝、人工合并及公网结果分别以 GitHub 和 HTTP 的响应为证。
