# CNY定价stg集成验收计划草案（2026-11-16）

状态：供用户审阅的计划；未执行stg写入、部署、价格应用或供应商调用。只覆盖已批准Spec v0.12的价格源及其后续集成，不改new-api核心/fork、不引入蓝绿或新插件/计量器，不把18平台136配置逐条生产验证当作本批前提。

## 1. 固定输入及目标证据

- Spec：`/Users/kohr/baymax_work/obs/outputs/qa/2026-11-16-脑生云统一CNY定价-专项Spec草稿.md`，v0.12。
- 已有53项候选：`.cache/official-cny/d5a84ca10d8599343370c1541828439a56b8dd1b/artifact.json`；artifactId `18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138`；sourceSha `d5a84ca10d8599343370c1541828439a56b8dd1b`。43模型+9原生任务变体+1工具；当前not-published/not-applied；完整包及覆盖仍incomplete。后续CI修订不能悄悄重建并沿用此候选确认，执行前分别固定“执行器源码SHA”和“原候选sourceSha/artifactId”。若候选本身变化，重新生成diff和确认。执行前重核本批来源时效/促销/退役条件；变化只触发本批重新核价，不把历史日期改成自动同步成功。
- 原版契约（目标若不满足则停止该项执行，不自动升级或放宽）：new-api `v1.0.0-rc.50`，提交 `f2aa91232ed3e5878a614762ace6736a2b74257f`。既有本地证据指向缓存官方制品 `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9`；此处须保持证据原有类型，执行时核对实际镜像ID/registry digest/OCI revision，不把镜像ID与registry digest互换。
- **真实stg目标尚无文档证据**：实例标识、目标origin、运行版本/镜像、单/多副本、存储、业务账单版本均未知；现有T7仅是随机localhost端口、tmpfs SQLite、运行后清理的隔离容器，不是现存stg。不得把旧BE/FE的stg分支SHA当作new-api部署证据。
- 实际账号、渠道/alias、分组绑定未写入候选。执行前只补齐下列获选项的脱敏绑定和目标回执；不要求全136或私人账号值。运行凭证通过既有安全方式提供，计划和证据不含凭证。

## 2. 首批拟验项目及映射表

这是代表形状的建议批次，不是获选全部53项的可售结论。目录身份已知，真实stg绑定未知。运营可用已有通路替换建议项；替换须保留价目/协议/形状并重新确认选择，不猜测短名和后缀。

| 拟验项 | 候选官方记录/计费名 | 价目及重点 | 拟验协议/端点 | stg渠道→实际上游ID→对客alias/计费名 |
|---|---|---|---|---|
| USD文本、缓存/TTL | `us-openai-gpt-6.1-terra-standard` / `gpt-6.1-terra` | Standard/global；USD单次×7；272000边界；30m/12h缓存 | Responses；实际路径待确认，12h仅验证已支持路径 | **未知，待运营提供** |
| Messages协议及21元/M算例来源 | `us-anthropic-claude-sonnet-4-5-standard` / `claude-sonnet-4-5` | Standard/global；USD3/15→CNY21/105；5m/1h TTL；来源注明11月30日退役，执行日须核对可用性或换选 | Messages；路径待确认 | **未知，待运营提供**；目录便利alias的官方证明不能代替私有渠道映射 |
| 国产原币保真 | `cn-moonshot-kimi-k3.1-pro-standard` / `kimi-k3.1-pro` | CNY13/68；cache read1.3、write5m13/1h26；命中不二次write | OpenAI兼容或Messages，实际路径待确认 | **未知，待运营提供**；不得与highspeed合并，1h写入必须有原生独立usage字段证据 |
| 直接图像Token | `us-openai-gpt-image-2-direct-images-standard` / `gpt-image-2` | raster；文本/图像输入与普通output_tokens分开；非缓存；输出不假设img_o | `/v1/images/generations`或`/edits`，二者分别记适用性 | **未知，待运营提供**；1k/2k/4k后缀不推定alias |
| 按张图像任务 | `volcengine--doubao-seedream-5-0-flash-260915--cn-beijing-task-online-original` | doubao已有profile；每成功输出张0.12CNY；两档image counter，输入图官方免费 | 固定原生doubao任务插件；实际端点待确认 | **未知，待运营提供**；插件→model绑定需读回 |
| 视频Token任务 | `volcengine--doubao-seedance-2-0-fast-260128--cn-beijing-task-online-original` | doubao已有profile；completion_tokens/1M；video_input分支22/37CNY，不能用秒估算Token | 固定原生doubao任务插件；实际端点待确认 | **未知，待运营提供**；`seedance-2.0-fast`短名没有绑定证据 |
| 独立工具费 | `cn-zhipu-search-std-standard` / `search_std` | CNY0.01/次→原生10/千次；模型Token另计 | 既有GLM Chat search_std meter；触发模型待运营选定 | **未知，待运营提供**；不能把工具价目录名当模型渠道 |

每项最小执行记录：非敏感目标ID、协议/端点类型、渠道内部标识（证据限制访问）、真实上游ID、官方记录、原生计费名/alias、地域服务档、插件schema及usage字段、选定分组有效倍率；缺项只阻止相应路径。选项未获确认前不写入。

## 3. 执行顺序及可核验结果

1. **冻结本批及现场基线。** CI通过后记录执行器SHA、候选artifactId及全部manifest/分区哈希；核对实际stg目标与原版rc50运行证据。使用原生只读接口保存选定model/plugin完整配置、expected_version、工具全表、未选键、倍率、单位以及消费前钱包/套餐/日志基线。记录previewIdentity、选择集合、运行时actor与目标确认；确认后数据或目标变化即失效。
2. **CNY与倍率预检。** 必须读回`USDExchangeRate=1`、`QuotaPerUnit=500000`；报价、余额、充值、分配、消费、账单统一CNY语义，分配额不是消费。读取实际有效分组/特殊倍率，验证同模型同口径A＜B＜C（如本批启用）；0.8仅作原生倍率输入，不写新的倍率管理。单位/目标/权限/形状不符即停相应应用，不以页面人民币符号代替单位核对。
3. **原生preview→选择确认→配置应用→逐项读回。** 模型/插件走原生GET/PATCH `/api/option/model_pricing`，完整合并保留未选字段，带fresh expected_version；工具使用GET全表、新鲜合并、PUT `/api/option/`的`tool_price_setting.prices`字符串。工具PUT无原生CAS，必须由运营提供覆盖最后一次读取至PUT/读回的独占窗口；无法独占则本批不应用工具项。模型、插件、工具跨分区不承诺全局原子性；每项输出applied/conflict/failed/mismatch/unknown，部分成功不得报全成功。
4. **实际usage、扣费、日志和账单链路。** 在获批stg测试组织/Key及预算内执行选定请求，记录原生存在的request/task/attempt标识与账单关联（缺失字段不补造，不因此引入新恢复系统）、脱敏usage、CNY oracle、实际适用钱包/套餐余额前后差额、native日志quota、业务查询CNY。真实供应商联调需另行明确调用授权与预算；本次计划编写不授权调用。保留“配置已应用”“调用通过”“计费通过”“可售批准”各状态。
5. **异常和恢复演练。** 使用授权隔离路径制造版本冲突、请求超时、读回失败和跨分区部分失败；模型409先读新版本，不强盖；超时包括可能已提交的场景，必须先读回，以实际匹配结果判定，unknown保持待核对，绝不盲重试。只在新意图/新确认后恢复选定价格字段；以恢复时fresh版本/工具独占窗口合并，不覆盖别人的未选键。恢复后读回并留审计，不重算历史消费。原先缺失的字段必须按原版已验证的unset/继承语义恢复；若该删除语义尚未验证，则保留为恢复演练阻塞，不能用0冒充删除。快照保存至受控证据位置，脱敏版本只含必要价格字段与状态，不上传账号凭证或生产配置至公开仓库。

## 4. 计费矩阵（配置成功不替代消费证据）

- 固定AC09/10：21CNY/M、1000输入Token、0输出/缓存/工具，倍率1应实际扣10500quota＝0.021CNY，倍率0.8应扣8400quota＝0.0168CNY。可通过stg隔离的确定性上游回放精确usage来检验**真实网关消费/钱包/日志**；这项不冒充真实供应商计量。若目标禁止隔离回放，则待可获得该精确usage再关闭AC09/10；真实供应商正常请求按实际usage独立计算，不把“归一到1000的算术”冒充10500/8400实际扣费。已有原版离线ComputeTieredQuota向量验证了10500/8400数值，但未产生真实网关钱包消费，本批仍待消费链路实测。
- 每协议分别核对input/output/reasoning、cache read/write、长TTL字段归属及不重复计入input。同名模型的Responses、Messages、OpenAI兼容不共用usage通过结论。逐项对照原始usage与原版p/c/cr/cc/cc1h/cc12h及图像变量；Kimi等1h写价存在不等于实际OpenAI兼容回包已提供独立1h计数，只有合计或缺TTL明细时不得猜拆，也不能把1h写计为免费。TTL条件不改为汇率系数；适用阶梯T-1/T/T+1按官方边界检查，12h只在受支持Responses路径，缺TTL/meter时标阻塞/unsupported而非免费。
- 图像：生成/编辑、1张与多张、输入图、质量/分辨率及partial images按实际官方收费维度选边界；直接Images的output_tokens普通输出计费与task按张分开；不以出图成功替代金额通过。
- 视频：支持分辨率/时长/音频/video_input条件及取整按固定schema逐项确认；实际completion_tokens有证据且显式/1M，核对任务完成、quota补差/退回和日志关联。异步取消、未知、提交丢ID、迟到及退款恢复若触发，保留未关闭风险，不新造恢复层，也不作零费用假设。
- 工具：实际0/1/多次调用、原生次数采集、CNY0.01/次和模型Token可分别解释，总额不漏不重复。无对应meter或真实触发路径则仅配置通过，计费状态未通过。
- 历史消费先结算留基线，再改价并新请求；旧账单固定为旧quota/500000，新请求依适用规则用新价。文本实时改价和同组重试新价沿用已接受规则；图片/视频同一次任务用原生提交快照，合法新尝试取新价；不新增准入锁价/跨套餐跨组重试。
- 失败/截断路径区分实际调用及计费；不因HTTP200、DONE、任务完成、native日志ok就宣称客户端/账单完整成功。已测本地fake/CLI范围不外推真实供应商。

## 5. 快照恢复与应用镜像回滚的分界

本批改变的是价格配置。恢复使用执行前配置快照，以新确认、fresh expected_version/工具独占窗口、逐项读回进行；不能简单回放旧版本号、全表盲覆盖或自动抹平部分成功。**应用镜像回滚**针对软件版本，既不自动恢复数据库价格，也不回滚已结算账单；本计划不部署或切换镜像，不设计蓝绿。任何镜像变更需另立计划和授权。

## 6. 开始实测前最小缺口与完成口径

待提供/核验：①真实stg非敏感目标ID与固定运行版本证据；②表中实际获选项的渠道/alias/官方条目/协议绑定及可用schema；③现有受控身份、获批测试组织/Key及调用预算（不在文档收集秘密）；④具体选择、应用及恢复确认；⑤工具项独占窗口；⑥业务消费/账单可查询的关联接口/版本。缺口按项记录，不扩为全136前置。本方案依据已审的T1—T7/维护资料及Spec；历史tickets保留为证据指针，不重复迁移成新任务，线上ticket状态另在执行前只读核对。

本批完成需要固定候选/目标身份、配置读回、全部选定适用场景的真实usage→quota→适用钱包/套餐扣减→日志→CNY账单可解释、未知和差异可见、恢复演练读回及证据脱敏。局部通过按项报告；本批没有证明全53/136可售、141/136差5已关闭、通用异步恢复已解决、真实托管Actions链已启用或生产价格已发布。原始记录的missing-source/incomplete/unsupported、官方价目时效/促销与退役限制继续保留。

## 依据

- `tickets/T7.md`：原生版本化配置、工具独占窗口、超时读回及既有I证据边界。
- `tickets/VALIDATION.md`：本地镜像/版本、10500/8400仅算术、无supplier/production请求。
- `tickets/OFFICIAL-PRICE-MAINTENANCE.md`：53项及136参考、排除与不支持边界、候选独立确认。
- `data/cny/proposed-selection.json`、`data/cny/official-catalog.json`：官方条目与费用/TTL/原生profile身份。
- 候选`artifact.json`/`status.json`：固定指纹、未发布未应用、完整性未关闭。
- obs `2026-11-16-脑生云线上启用模型清单与定价覆盖矩阵.md`：参考而非开发门槛，别名归运营；`2026-11-11-脑生云newapi-G6成员共享限额与多套餐验证方案.md`：实时改价已接受、本地原版与历史patched证据边界。


## 本轮工程集成记录（不等于stg验收）

- PR1已合并至业务分支04e0ab7279b7ddd6b6ecfab7d500f3f162767a2f，main仍上游d9f6cf3d1b643ac186f1be82dfcab754505a9343。
- 工程配置PR2独立QA通过并合并26fb5a2dcbf56289a5f8b0288f91a0f476e1e41c。
- 受控CIPR3修复后独立代码门禁通过，合并f5e02bb28e93a2a57a25ff069ff267f9f98e4b5e；手动run43855884901已完成success，54测试通过，实际下载ZIP与GitHubdigest及全部文件/身份验证一致。API约束引发的两次停止与受审修订见docs/ci/CNY-CI-ACTIVATION.md。
- CI新候选5390a70419ebf58e4b1fc3ca4844b3d2e946c97c04674881a6d80068f1f72ad3仅为本轮代码/构建证据，原价/政策/分区hash与d5候选相同，但不是上表原18098469候选的同一身份，不自动替换任何应用确认。
- 以上是合并与测试/候选构建；本stg方案未部署、未应用配置、未调用供应商。真实stg目标、映射和授权条件仍按第6节列出。
