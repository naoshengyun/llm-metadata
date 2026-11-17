# 发布准备：事实与证据（2026-11-17）

调查只读，未实时研究全量价格、未部署/调用供应商/改fixture。

## 当前工程与托管

- 起始worktree docs/cny-isolated-inputs@9df03386干净；远程业务naoshengyun=f616d0a927caae1cab5b3fad96784c7d10c588f6、main=d9f6cf3d1b643ac186f1be82dfcab754505a9343。新草稿从实际业务head建分支；不覆盖旧分支。
- `gh repo view`：public组织库，default=naoshengyun。8个实际branch heads已查询；只有1个注册workflow，ID420020133，路径naoshengyun-ci.yml，active但仅workflow_dispatch。
- Actions selected/pin=true，仅checkout/setup-node/upload-artifact三精确SHA许可，owned/verified=false。唯一run43855884901 success/source f5e02bb…；候选附件retention14天，不是长期公开价格服务。
- `GET repos/naoshengyun/llm-metadata/pages` 返回404，未发现已配置Pages；`gh release list`无版本。404只证明此API查询未返回站点，不证明组织无权限或没有其他私有部署。未发现本项目可复用的组织域名/Cloudflare部署凭据约定，不擅自新增服务。
- README中的basellm.github.io和llm-metadata.pages.dev是上游地址。继承build.yml被移入非执行目录，含push/schedule和写权限；不能当本fork发布通道启用。现有候选CI只有contents:read，没有Pages写权限。
- GitHub官方文档说明public组织库可用Pages，项目站点默认路径owner.github.io/repository。部署workflow需pages:write/id-token:write及部署environment；当前3个许可action不包含Pages发布actions，新增必须固定SHA并单独审查/批准。参考：[Pages能力](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。这里只建议可用路径，未证实中国网络可达性/延迟/SLA。

## 固定原版消费契约

以下全部以只读 `git show f2aa91232ed3e5878a614762ace6736a2b74257f:<path>` 查询，不能用工作目录f36c460…冒充rc50：

- `controller/ratio_sync.go`的FetchUpstreamRatios：req.Upstreams可指定http BaseURL，Endpoint支持绝对http(s)URL或相对路径；空Endpoint默认/api/pricing。请求体原生Upstreams模式不必新增采购channel。内置官方preset仍硬编码basellm来源，不会自动变为组织CNY源。实际UI自定义入口可见性尚未复验，运营草稿以原生管理API能力为界，不宣称已有专用按钮。
- 同文件pricingSyncFields包括billing_mode/billing_expr等模型价字段，不包括plugin_billing_expr/工具。HTTP响应先解success/data，success=false或缺失即拒绝；上限10MiB、默认超时10s，交付需覆盖包体积及下载失败。
- 当前生成器ratio_config输出只有data，没有success:true。**不能直接把现有该文件托管就声称rc50源URL已兼容**。发布侧需生成标准success:true/data封装并绑定新输出hash/releaseId，不改原artifact身份。旧公开生成出口也须按实际格式区分，不能把配置保存I通过当URL fetch通过。
- 当前build-official-cny产物：artifact/catalog/coverage/diagnostics/status/semantic-diff/ratio_config/plugin_prices/tool_prices及报告。插件管理需要每model的plugin→expression对象，经原生model_pricing版本化接口保存；工具是独立tool_price_setting.prices全表字符串、单价每千次，无CAS需独占。源URL不能一键覆盖三分区。
- 原版model_pricing接口支持fresh expected_version、完整草稿合并、unset/继承；本地动态恢复QA已通过，但不扩展为新的源URL抓取测试或真实消费。

核对位置：本仓库 `scripts/build-official-cny.mjs`、`src/cny/cli.ts`、`src/cny/artifact.ts`、`src/cny/apply.ts`、`.github/workflows/naoshengyun-ci.yml`、`.github/upstream-workflows/build.yml`；原版 `controller/ratio_sync.go`、`controller/model_pricing_config.go`、`model/model_pricing_config.go`。未来开发需对固定对象补可执行契约测试，本轮仅静态核对。

## 尚未证实 / 不能推导

Pages已开通、稳定URL已存在、token可部署、域名/中国访问SLA；任何默认完整性发布政策；首版53候选全部可售/现价；自动定时维护、最新官方价持续成立；真实目标/渠道/倍率和账单已验收。均不得由历史CI、候选包或本轮“推进”推定。

## Planner固定输入复核（2026-11-17）

- 本轮工作树从干净镜像上下文切至独立 `docs/cny-publication-planner-review`，父候选固定为 `fb78b59a12d6043575b91cef72ff441e26e9c856`；远程候选仍为该hash，业务分支仍为 `f616d0a927caae1cab5b3fad96784c7d10c588f6`。原候选分支查询无PR，Issues仅原5—11，无发布执行票。
- 亲自读取原版仓库的固定git对象 `f2aa91232ed3e5878a614762ace6736a2b74257f:controller/ratio_sync.go`：L417—431先验success；L435—451只要data含至少一个pricingSyncFields字段就按type1接受。因此“缺模型字段或其他分区原版必拒绝”不是事实。发布侧必须验证所选模型mode/expr配对与全包完整性，原生fetch仅证明协议可消费。
- 亲自核对候选 `scripts/build-official-cny.mjs` L195及 `src/cny/cli.ts` L61：ratio_config只有data，缺success。新增封装须产生独立发布输出身份，不能覆盖旧artifact。
- 本轮再次读取组织库API：PUBLIC/default=naoshengyun；Pages查询404；Release列表为空；selected-actions仍仅checkout/setup-node/upload-artifact三固定SHA，github_owned_allowed=false、verified_allowed=false。这些是当次查询事实，不保证未来状态。
- 直接读取地图及恢复回执：#6/#10/#11 OPEN，#5/#7/#8/#9 CLOSED。#6移入“发布规划”并保留执行禁区，语义与当前委派一致；未据Dev修改反推业务批准。本次未查询或更改运行中fixture。

## PUB-D1后续决定（2026-11-17）

用户经原Planner线程正式选择现有组织仓库GitHub Pages；本次宿主核实转交明确只授权规划方向。见[决定记录（#14）](https://github.com/naoshengyun/llm-metadata/issues/14)。这更新的是决策状态，不更新上文API核对时点：没有因选择而开通站点、发布端点或改变权限。

2026-11-17后续：PUB-D2已确认允许符合资料完整、原版可表达且经用户确认条件的模型子集分批发布；全136参考和未发布原因、partial/complete=false、141差5保留。见[决定记录（#15）](https://github.com/naoshengyun/llm-metadata/issues/15)。具体首发名单与真实发布未批准；D3后续已确认（#16），原待答状态已被替代。

2026-11-17最新：PUB-D3已确认人工核价PR→审阅固定候选→手动发布指定版本，无定时/代码提交自动发布，上游同步分开；实际发布版本另确认。[决定记录（#16）](https://github.com/naoshengyun/llm-metadata/issues/16)。长期SLA、精确名单、权限启用或部署未获批准；剩余审批见[三票/S-H及D4表](CNY-PUBLICATION-APPROVAL.md)。
