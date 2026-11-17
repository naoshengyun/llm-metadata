# 真实 Pages 首发

本阶段用户明确授权真实启用组织仓库Pages及Actions，交付匿名HTTPS页面与静态价格API；不修改new-api实例、供应商或保留夹具。追踪既有地图#6，#18—21开发关闭事实不改。

仓库Pages当前未开通，默认分支naoshengyun，main保持d9f6。正式workflow仅manual，固定expected_sha/release/hash，审核固定输入和明确approval后才构建。build contents:read，deploy单独pages:write/id-token:write；github-pages环境只允许业务分支。本项目allowlist只补固定deploy-pages SHA，保持selected/shaPin及原三pin，不修改组织全局设置。

当前proposed-first-release.json为未批准的43模型+9插件提案，models-only-alternative.json为43模型替代提案，均为新建candidate-purpose包，不是原2模型test改标签。工具不选；官方tool quote仍在原artifact作为参考；新cny-package/v2运营说明区分对客全有效键显式0，非零报价不直接应用。v1历史仍可逐字节验证，旧包不改。只有选择与identity得到明确确认后才写first-release.json approval并执行发布，缺该文件workflow失败关闭。

主页从同一完整快照渲染，所有链接使用相对路径，静态JSON不使用HTML fallback；site-manifest绑定全部实际输出（自身hash由部署读回另记录）。无JS/外部字体/图片依赖。API为静态价格数据，非推理网关。partial/complete=false、136参考/141差5、排除与未选、原核价日期保持；不声称可售/真实账单验收。

真实验收：记录run/deployment/source与workflow SHA/artifact digest；公网匿名HTTPS首页、JSON Content-Type/envelope、fixed manifest/file hashes、stable重复读取、相对链接及CORS实际响应；既有QA独立HTTP与浏览器验收后才关闭本阶段。首次无历史版本，不通过破坏首发入口演示回退；错误/未知先读回，禁止盲重发。后续更新/回退必须先保留旧公开固定版本及新审核快照，首发workflow不用于未经准备的更新。
