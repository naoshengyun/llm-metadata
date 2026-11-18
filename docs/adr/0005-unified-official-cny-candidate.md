---
status: accepted
recorded_at: 2026-11-18
scope: unified-official-cny / issues-34-39
---

# 统一构建完整目录与经选中的官方报价

[#34](https://github.com/naoshengyun/llm-metadata/issues/34) 批准上游完整目录、本仓库官方价目和明确增补汇合到同一固定候选。目录按供应商端点和型号保留地区、订阅及本地化资料。原生计费模型名只选一种完整官方价目。显式选择按精确身份校验。缺少显式选择时，国产优先使用国内价目，国内缺源时保留缺口。多个合格身份即使价格相同也需选价。报价的完整性由原始收费声明、当前编译诊断及既有选中收费条件一起检查。

[当前固定上游](../../data/upstream/24d3f35c/source.json) 的成本字段采用其声明的币种规则。上游缺省 USD 属于其数据约定，已知国内估算和明确缺少原币依据的型号按当前政策排除。完整保留上游报告值供复核。Sarvam 历史 USD 键的纠错通过候选差异报告审核。延期记录沿用精确端点和型号，Thinking Machines 的延期证据是其完整收费表所需的缓存用量依据。Seedance 2.5 标准版保留包括两种 4K 费率在内的参考价目，[#32](https://github.com/naoshengyun/llm-metadata/issues/32) 指定的两种真实结算证据为后续放行条件。

工具官方参考与 New API 中运营配置的零价分开。任务表达式由固定 rc.50 插件用量契约编译为模型级 `billing_expr`，因此任务与普通模型共用同步入口。既有插件专属配置可继续优先。

## 构建及交接

在仓库根目录运行 `npm run cny:unified:build -- <尚不存在的候选目录>`。命令在本地读取固定且带校验和的输入，生成完整英文、简体中文和日文的目录、供应商和搜索入口。构建同时产出以下文件。

- `api/newapi/ratio_config.json` 提供 New API 的模型同步响应。工具和独立插件配置均无模型键。
- `coverage.json` 包含逐端点型号、上游价目、全部自有价目及工具参考。模型行提供是否可同步、选择和原因。
- `price-diff.json` 对比固定历史发布或已明确提供的前一候选，逐原生键展示旧值、新值、排除或选择理由。
- `manifest.json` 将代码提交、代码字节、上游、原价、选择、政策及各输出文件校验和绑定为固定候选。

再审候选时可依次提供政策、官方价目、选价、上游目录和上一固定候选目录。提供上一经审核候选会校验其 manifest 与参与比较的文件，并保护选项、持久撤价历史和前次审查有效时间。发布门禁应传入已审核的前一固定候选目录。构建只生成本地文件。

`unified-policy.json` 的 `asOf` 是人工审核的固定时间，并带时区。晚于该时间的正式价目保留为待生效，选中会使构建失败。到期时通过新的审核变更更新选择与审查时间。撤价和恢复以原生键维护附带证据的有序事件。撤价屏蔽全部同名自动候选，恢复需要显式选择与新的匹配证据。日期推进与选价变化均由审查处理。

历史仅上游发布由 [ADR 0004](0004-separate-upstream-catalog-and-cny-eligibility.md) 记录。#40 接通页面交互与原生实例全量读回，#44 接通固定候选的发布门禁。

## 网站与原生验证

用下列命令把同一统一候选的目录、覆盖表与原生同步 JSON 装配到网站。两个输出目录须尚不存在。站点首页从当次加载的清单选定固定版本，后续目录导航、搜索和导出均使用这个版本。站点同时提供同字节的 `api/newapi/ratio_config.json` 入口。此前两版的固定产物继续以原 ID 提供，历史价格页中的下载指向各自的固定入口。

```sh
npm ci
npm --prefix web ci
npm run cny:unified:build -- "$candidate_dir"
node scripts/build-visual-site.mjs data/cny/publication/upstream-release.json "$site_dir" "$candidate_dir"
```

在已安装 Chrome 和 Playwright 的机器运行浏览器验收。验收包含桌面、移动端、三语目录和价格、完整剪贴板与下载校验、地区导航、订阅及 Seedance 2.5 的整模型排除。原生验收在本地 Docker 中用固定官方 rc.50 镜像新建临时无渠道实例，从同一站点产物通过 HTTP 拉取，逐键预览、按配置版本选择保存和读回，并对任务插件检查覆盖、移除与继承。两个验收程序分别向尚不存在的证据目录写入候选身份和执行结果。

```sh
node scripts/check-unified-site.mjs "$site_dir" "$playwright_module" "$browser_evidence_dir"
node scripts/check-unified-native.mjs "$site_dir" "$native_evidence_dir"
```

隔离实例保存通过仅确认配置能力。生产实例应用与实际供应商计费分别验收，工具参考价由运营按免费政策另行处理，Seedance 2.5 继续等待目标部署两种 4K 结算验证。
