# PUB-T02 页面验收矩阵（开发开始登记）

规范：[Spec #18](https://github.com/naoshengyun/llm-metadata/issues/18)、[PUB-T02 #20](https://github.com/naoshengyun/llm-metadata/issues/20)，正式v1.3。用户已接受每次粘贴完整URL、刷新/关闭后重填，保留固定原版页面；不新增持久化源或后台。

当前仅登记，不代表运行通过。独立UI目标尚未准备，不能使用旧I夹具。目标应为单独的固定rc50 f2aa912/image096feb…隔离实例，记录容器完整ID/origin/tmpfs/身份/基线、明确test selection与固定包hash；初始化与只读验证在开发范围内，任何价格/单位保存前须向Planner提交具体动作并取得实际执行意图。

| 阶段 | 通过证据 | 当前状态 |
|---|---|---|
| Root/SUPER_ADMIN页面访问 | 实际原版页面及受控身份，版本/目标记录 | 未验 |
| 输入固定模型URL/核对来源 | UI输入完整Endpoint，实际URL与固定包一致；原预设名称/Official徽标限制呈现 | 未验 |
| 拉取 | 页面发起请求，全部所选模型和值齐全；不可只看success/“无差异” | 未验 |
| 逐模型选择/差异预览 | 选择集合和差异与固定包精确一致 | 未验 |
| 刷新/关闭重填 | 原版URL内存行为如实观察，用户已接受；不是需求待定 | 未验 |
| Confirm Changes真实保存 | 同目标/selection/基线diff明确批准后，仅从原版页面操作 | 未授权、未执行 |
| 应用后核对 | 页面刷新/结果与获准选择一致，未选字段/倍率/配额保持 | 未验，依赖获准保存 |
| 插件独立页面 | 模型编辑/插件表达式对象入口真实可见，与模型源独立 | 未验 |
| 工具独立页面 | 工具visual/JSON入口真实可见；全表无CAS/独占限制明确 | 未验 |

模型候选路径为原版 `/system-settings/billing/model-pricing` → Upstream price sync，或 `/models/metadata` → Sync pricing，来源选择中的既有custom字段；页面实测前不把源码路径当通过。插件/工具分别验证已有入口，不假设一个模型URL已导入它们。

UI登录若需用户本人交接，保留目标、已完成的包验证和可审操作，不绕过登录墙或把API/CLI代替实际页面。不操作Confirm Changes、单位/组/工具Save按钮，除非已有对应明确授权。任何不可满足能力回Planner，不改new-api核心/升级/新增代理应用器。

旧I、历史H和独立测试通过不外推此表。整票PUB-AC-11未完成前 #20 保持OPEN，#21不能提前开工。实际发布、Pages/权限/定时/供应商/生产及实例清理均未授权。
