# PUB-T02 页面验收矩阵

规范：[Spec #18](https://github.com/naoshengyun/llm-metadata/issues/18)、[PUB-T02 #20](https://github.com/naoshengyun/llm-metadata/issues/20)，正式v1.3。用户已接受每次粘贴完整URL、刷新/关闭后重填，保留固定原版页面；不新增持久化源或后台。

2026-11-17 已在独立临时目标完成下列只读页面步骤，并在新明确授权后执行单位和两模型页面保存/读回，实际保存批次已获独立QA验收。目标、固定包、初始基线见[应用意图材料](CNY-PUBLICATION-UI-INTENT.md)，实际授权、顺序与读回见[执行记录](CNY-PUBLICATION-UI-EXECUTION.md)。没有使用旧I夹具，工具/插件未保存。整票原条件与各固定版本证据的对应见[收口核对](CNY-PUBLICATION-T02-CLOSEOUT.md)。

| 阶段 | 通过证据 | 当前状态 |
|---|---|---|
| Root/SUPER_ADMIN页面访问 | 原版rc50页面；个人资料为cnyui、超级管理员、用户ID1 | 已验，只读 |
| 输入固定模型URL/核对来源 | 完整URL替换原官方行Endpoint；名称/Official徽标不变，实际URL单独核对 | 已验，只读 |
| 拉取 | 原版页面请求 `/api/ratio_sync/fetch`；Claude/Kimi全部mode/expr与固定包一致 | 已验，只读 |
| 逐模型选择/差异预览 | 两行分别选择后2/2；应用同步仅打开预览，两条完整表达式匹配；此前只读阶段未点击确认更改，后续获准保存另列 | 已验，独立QA支持 |
| 刷新/关闭重填 | 刷新回原默认Endpoint；模型metadata同步外窗关闭再开也回默认；内层选择器取消重开但外窗未关闭时暂保留 | 已验，已重新粘贴拉取 |
| Confirm Changes真实保存 | 原用户2026-11-17T08:31:30.945Z明确批准；同目标fresh预检后，原版页面unit Save及2模型Confirm Changes；native metadata均200 | 已执行，独立QA PASS |
| 应用后核对 | 重载原版页面分别打开Claude/Kimi编辑器，完整表达式和值一致；辅助完整GET279未选项/版本及其他options保持 | 独立QA PASS |
| 插件独立页面 | 既有sora-2 → 编辑 → Sora → 单独设置草稿 → 表达式编辑器；未保存并导航丢弃 | 通用入口已验；本候选doubao插件未应用 |
| 工具独立页面 | visual/JSON入口、每千次单位及独立保存按钮真实可见；未编辑/保存 | 入口已验，未应用 |

模型候选路径为原版 `/system-settings/billing/model-pricing` → Upstream price sync，或 `/models/metadata` → Sync pricing，来源选择中的既有custom字段；页面实测前不把源码路径当通过。插件/工具分别验证已有入口，不假设一个模型URL已导入它们。

UI登录若需用户本人交接，保留目标、已完成的包验证和可审操作，不绕过登录墙或把API/CLI代替实际页面。不操作Confirm Changes、单位/组/工具Save按钮，除非已有对应明确授权。任何不可满足能力回Planner，不改new-api核心/升级/新增代理应用器。

## 本轮现场与证据界限

用户完成登录后，标准受控snapshot返回200并显示已登录页面；历史handoff pending不是当前锁证据，没有再要求用户找卡片、截图或重登，没有绕过宿主控制。后续仅使用标准snapshot/ref/导航。两个“应用同步/同步价格”按钮含糊命名曾被自动审查拒绝；核对固定原版源码证明仅打开内存预览后，同一标准操作获准，此前只读阶段实际保存按钮未触发。后续新授权保存记录分别保留。

只读阶段价格页显示USD，货币页美元汇率为7.3。后续经新授权原版页面保存USDExchangeRate=1并重载读回，显示模式仍USD。同步页仍显示站点汇率转换提示，未使用乘除汇率按钮；保持来源价格并在实际保存后逐项核对，不能把预览、提示或空diff当保存证据。

插件入口以原版既有sora-2/Sora演示，只切换未保存的本地草稿。当前279项基线没有doubao-seedance-2-0-fast-260128对应entry/variant；新增同名模型草稿也未出现插件tab。不能宣称本候选doubao插件已从UI配置，也不安装插件或伪造变体。通用入口证明与具体插件接入条件分开记录。

工具JSON界面接受工具键→数字的平铺map；tool_prices.json外层 `tool_price_setting.prices` 是配置分区标识，不能把整个wrapper直接粘贴到该编辑器。应提取内层所选map，与fresh全表基线合并并另行确认；页面展示的默认工具值不是已写入override（现场配置仍为 `{}`）。本次没有工具写入。

只读脱敏证据保存在 `/tmp/cny-pub-t02-evidence/ui20-*.json` 与 `ui-price-preview.jpg`，包括来源输入/拉取/逐行选择/预览/刷新/关闭/身份/插件/工具/单位页面。只读结束snapshot-1794903426395.json的完整pricing hash为 `b89dbb0d98f4226b04f61cdd9d0bb6f0f8ca9fb749c02fb85acbe30f1c2cefb6`，规范化options hash为 `83f452792752b553d3b44380b4474873ab8e71158c8d795aebd898a4f73a7cbb`，与初始化完全一致。此为历史保存前状态。零Save为执行者报告，由预览/取消及当前状态佐证；helper请求列表不是完整浏览器审计，前后相等不能单独证明所有瞬时写入均为零。后续实际保存另保留native浏览器请求metadata/状态及各中间GET，不倒改此阶段证据。辅助GET用于保全配置证据，不代替页面操作。

旧I、历史H和独立测试通过不外推此表。#20按原AC及整票独立审查收口，关闭后才开工#21。页面恢复不是原定关闭条件；后续已明确取消等待恢复确认这个额外阻塞，恢复提案仅作单独后续处置，当前实例保持应用态、不恢复或销毁。实际发布、Pages/权限/定时/供应商/生产及实例清理均未授权。
