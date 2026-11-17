# CNY 可视化发布

范围与逐项交互验收见 GitHub #27。复用 web/ 的上游 React 应用、设计系统、供应商导航/搜索、全局模型搜索、卡片/表格、详情、语言及主题。手机增加可折叠全局搜索，保持原供应商选择器。

构建先运行 `npm ci --ignore-scripts`、`npm --prefix web ci --ignore-scripts`、`npm run test:cny`，再执行：

```
node scripts/build-visual-site.mjs data/cny/publication/first-release.json /tmp/unique-pages-directory
node scripts/check-visual-site.mjs /tmp/unique-pages-directory
```

输出目录必须尚不存在。不得运行上游价格生成器向此输出目录混入全量价格。

适配差异：上游 new-api 面板允许更改部署汇率并重新生成表达式，这与固定 CNY 发布包不兼容。本版保留其工具栏入口，改为复制/下载原快照、查看部署单位要求及固定版本/来源链接。供应商复制只筛选固定表达式，不重新计算。页面不读取旧部署设置的 localStorage，避免旧 USD 偏好改变系数说明。浏览不代表实例设置被修改。

模型元数据仅来自 artifact 中明确选择的官方报价：名称使用原生模型身份，说明/价目/核价日期使用对应 quote。不从上游猜测上下文大小、发布日期或能力。报价字段完整保留 CNY 基础价、阶梯和缓存 TTL，原文说明保留多模态路径及限制。`publication.html` 保留此前发布索引以提供固定包和审计下载；首页改为完整应用。

版本目录、current.json、stable API 继续由原发布器生成。只有可变应用与浏览 API 和 site-manifest 增加/更新。站点 inventory 覆盖全部实际发布文件。Actions 仍限业务分支手动触发及原四个 action pins，不扩大策略。
