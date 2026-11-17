# PUB-T02 原版页面应用记录

本轮仅临时本地配置I。原版页面实际保存及读回已经完成，并获新独立QA PASS，固定执行aac600fff、文档c98403dc9；不是包级/只读阶段审查套用。报告SHA256 `7b982d744a642f646b0d7c97d71c69bf4eda5b98f18ec2a5b8d565043454f340`，位于独立QA工作树 `qa-evidence/pr24-c98403d-ui-save/REVIEW.md`。整票仍按[原条件收口核对](CNY-PUBLICATION-T02-CLOSEOUT.md)与新固定head独立结论处理。

## 授权和固定身份

实际读取Planner线程 `8bfd5c3c-28db-436b-8f99-d3b3a18e5ebb` 原用户消息 `hmgp29cszl33qb66zszqjpux` / `2026-11-17T08:31:30.945Z`，含问题全文及答复“同意，执行页面保存与验证（推荐）”。范围为同临时实例USD7.3→1，再原版页面仅Kimi/Claude保存/读回；其他279项、Quota、Group、插件工具保持，恢复另确认。

执行源码head `aac600fff568179876f132556ac60161c566155e`，不是后续文档commit。包准备进程来自a6d8538；正常包与修复后d087536字节相同，执行前重新完整HTTP校验10文件。原始artifact/源码、完整参考和partial/complete=false均不改。

- 目标 `cny-ui20-e3d6b71ed592` / `http://127.0.0.1:53836`，完整ID `d08f09905ec5498a71b5305e9c87df8ffb6a58194b4e34a2170338271923660d`，StartedAt `2026-11-17T06:55:40.719764305Z`。
- 原版rc50 image `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9` / OCI `f2aa91232ed3e5878a614762ace6736a2b74257f`；loopback、tmpfs、无bind、cnyui/id1/role100、渠道0均fresh核对。
- test release `67249fee2a6946d6a4b1d8fe32aa3892a744e10f0cefbc922d2384bd4591e187` / manifest SHA256 `99982caa63031a33d17f53e28f3587a1a4be410e90ea254e405375acf709eb1e`。
- 原artifact `18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138` / 原文件SHA256 `f2f6540a24b7730b1d2122c5cba1c5904d5797a715dcb97c2d75d6ee624ab914`。

## 实际顺序与结果

| 顺序 | 原版页面动作与证据类型 | 实施结果 |
|---|---|---|
| 1 | fresh inspect/GET/HTTP包校验，同基线；货币页仅USDExchangeRate7.3→1并保存 | native浏览器r329，08:35:18.797Z，PUT `/api/option/`，HTTP200 |
| 2 | 重载货币页仍USD/汇率1；完整GET读回 | pricing仍原279项，其他options不变 |
| 3 | 同步页重新粘贴固定完整URL→拉取→仅两行分别选择→完整mode/expr预览→保持来源价格→确认更改一次 | native浏览器r383，08:37:19.958Z，PATCH `/api/option/model_pricing`，HTTP200；原版把两模型组成一次batch PATCH |
| 4 | 完整GET、原版页面刷新后分别搜索/打开Claude与Kimi编辑器，再完整GET | 两模型configured精确匹配、281项；原279项完整entry/版本和未选options保持，渠道0 |

Claude持久化：`tier("standard", p * 21 + cr * 2.1 + cc * 26.25 + cc1h * 42 + c * 105)`；Kimi持久化：`tier("standard", p * 13 + cr * 1.3 + cc * 13 + cc1h * 26 + c * 68)`。两者mode均 `tiered_expr`，仅各自mode/expr新增。页面独立展示全部单价/缓存TTL项与完整表达式，不以toast或保存后的空diff代替验证。

| 状态 | 全pricing hash | 规范化全options hash |
|---|---|---|
| 保存前 | `b89dbb0d98f4226b04f61cdd9d0bb6f0f8ca9fb749c02fb85acbe30f1c2cefb6` | `83f452792752b553d3b44380b4474873ab8e71158c8d795aebd898a4f73a7cbb` |
| 仅单位保存后 | 与保存前相同 | `b03e69d73c6311cd793ce89c4aa1b2781cf29e02923f8aa5226a61efc98ac744` |
| 两模型保存后/复读 | `1641d8a7674112e0e60c016c2e1b43c24d8075c0b41c932143aa471d1a8f52dc` | `3e5be67703e366b7b0f9a3dcb54fdfd90efde0c496330cfa502ae444038a8972` |

## 证据与限制

本地安全证据目录 `/tmp/cny-ui20-save-20261117/`：原授权读回、实际原生工具snapshots、native网络metadata、完整中间状态/optionOrder、持久化页面截图、应用receipt及恢复提案。实际密码/token只进程内读取，不进入附件。`check-state.mjs`只GET+inspect/下载校验，无配置写入；实际保存全部通过原版受控页面。

网络记录证明本工具观测到r329 PUT、r383 PATCH的顺序及HTTP200，不能声称捕获了请求/响应body或所有瞬时流量。原生responseBody对单位响应的一次捕获返回未找到；保留失败，不重放保存，改以已捕获status、fresh GET和重载页面分别核对。helper日志不替代browser网络证据。

首次模型保存后GET检查误把整个授权价格map当未选option而断言失败；修正检查仅剔除两获准键，分别校验其值，并对所有其他map键及原279项entry/版本逐一相等，检查通过，没有追加写入。保留该验证脚本失败记录，不伪称初次全部通过。

同步页仍提示站点货币转换不可用，乘除按钮未使用；真实USDExchangeRate=1且已保持原始来源表达式。未扩大为修复new-api、改显示币种或写入其他货币设置。

## 恢复提案，不自动执行

应用receipt ID `ee68f2153883320d36e171ac79598c6811303ef9e48cf516252208d032139d08`。fresh恢复proposal ID `b72deb392c30487768dd56b1d74fa669e46c6c6c4b15159a0ccee48e663efea2`，文件SHA256 `87b18e1f05610e7da9371a1fd5447652e2cdf0e348acf24ad42f35d0f57d3dba`；绑定当前完整pricing/options原数组顺序、两模型当前version/configured、目标及测试包。这是本地可复算提案，不是native server planId或授权。

拟新确认：fresh无漂移后，通过原版页面仅移除这两模型新增override并保存，先读回两模型configured `{}`/继承、原279项及完整pricing回基线（USD仍1）；成功后再原版货币页面USD1→7.3，页面与GET精确回原完整基线。不能用0代替unset；工具插件不变，无工具PUT。409/超时先读回，不盲重试；任何实质漂移停相关写入并呈具体差异。

当前保留应用态，恢复需独立的新用户确认；实例不销毁、不触旧I。实际保存批次及恢复提案身份已获独立QA核对。后续用户明确推进#20原条件收口与#21开发，页面恢复只是补充验证，不再等待恢复确认作为额外门槛；恢复提案和此前等待状态原证据不改写。无供应商调用、真实消费、业务stg、生产、Pages/部署/定时/新CI或全部O/R完成声明。
