# 每日上游同步

GitHub Actions 每天北京时间 09:17 从业务分支 `naoshengyun` 检查 `basellm/llm-metadata` 的 `main`。手动入口使用同一流程，读取运行启动时固定的业务提交和上游提交。组织 fork 的镜像分支保持原样。

```sh
gh workflow run naoshengyun-upstream-sync.yml --repo naoshengyun/llm-metadata --ref naoshengyun
gh run list --repo naoshengyun/llm-metadata --workflow naoshengyun-upstream-sync.yml --limit 5
```

## 读回运行结果

- `unchanged` 表示上游提交与业务分支的已固定来源一致。运行只留下检查收据。
- `candidate-ready` 表示用上次固定上游、当前业务提交、本次固定上游三方计算候选，再以实际站点和价格文件验证。已选自有价目和表达式、币种政策、正式撤价、延期和恢复状态必须保持。上游工作流变更保留在隔离目录。失败原因在作业日志和检查产物中。
- `created` 或 `reused` 表示同一上游提交对应的候选分支和 App 审核 PR 已创建或复用。已有 PR 关闭时保留该决定。业务分支前进后，如已有 PR 需要更新到新基线，审核人可按常规 PR 流程更新并重跑必需检查。

打开运行的 Summary 和 `cny-upstream-check-*` / `cny-upstream-proposal-*` 产物，可查固定提交、候选、产物差异和 PR 链接。PR 要通过 [CNY reviewed build 和人工门禁](CNY-REVIEWED-PAGES.md)，人工合并后才由现有 Pages 工作流发布。

## 仓库配置

- `cny-upstream-sync` 是独立的 Actions 环境，部署分支仅允许 `naoshengyun`。在该环境保存 `CNY_UPSTREAM_PR_APP_PRIVATE_KEY`。App `Naoshengyun CNY PR Codex` 只安装到业务仓库，权限为 Pull requests 写入和 Metadata 读取。
- 检查作业持有只读仓库权限。候选的依赖安装在独立容器中执行并禁用安装脚本，候选测试和构建在断网容器中执行。业务分支的已审核构建独立生成目录、价格和差异，并与候选实际产物逐字节核对。提 PR 作业只重现已检查的 Git 提交，使用仓库令牌推送 `codex/upstream-sync/<upstream-sha>`，使用 App 安装令牌创建 PR。
- 保留仓库的精确 Action SHA 允许列表。新工作流使用现有已允许的 checkout、setup-node 和 upload-artifact 固定版本。
