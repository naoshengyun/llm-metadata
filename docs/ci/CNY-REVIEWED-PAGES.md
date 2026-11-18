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

## 发布结果

业务分支 push 发布同一提交构建的 Pages 包。构建只读已提交并校验的价格和上游资料，前一已发布快照用于退价/恢复连续性及固定文件留存。提交中的 `asOf` 有明确时区，须已到生效时间。待生效报价可作为资料保留，选中的未来价会阻断检查。构建和部署使用不同权限，只有固定的部署步骤持有 Pages/OIDC 权限。发布前再次核对业务分支和已验证的当前指针。工作流串行执行，过期任务不能提升当前版本。

部署后的独立 job 校验公网 `site-manifest.json` 是否与构建收据一致，并读取首页、资源、当前指针、稳定 HTTP JSON、固定版本及已保留文件。仅该 job 的成功结果确认发布。失败或未确认记录在 Actions 概要。已产生成功部署但 CDN 读回未确认时，按原收据重复核对；同一提交不会创建新的候选重发。过期任务保留已有固定文件及最后验证版本。运营仍通过既有流程自行应用价格。

```sh
gh run view <run-id> --repo naoshengyun/llm-metadata \
  --json headSha,event,conclusion,jobs,url
node scripts/cny-pages-release.mjs verify \
  https://naoshengyun.github.io/llm-metadata/ <merged-source-sha> <site-manifest-sha256>
```

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

如需验证固定版本留存，在构建前用 `scripts/cny-pages-release.mjs snapshot <HTTPS 或本机 HTTP 站点> "$work/prior" <前一已发布源码 SHA> retain` 读取前一固定站点。构建后运行 `scripts/cny-pages-release.mjs seal "$work/site" "$work/prior"`，在本机 HTTP 提供该站点并用 `verify` 核对收据。独立本地演练只产生隔离产物，实际 PR 检查、规则拒绝、人工合并及公网结果分别以 GitHub 和 HTTP 的响应为证。
