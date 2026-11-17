# 完整上游目录与 CNY 价格发布

当前规范为 Planner 维护的 Spec v2.0，入口见 `docs/requirements/catalog-publication-sources.json`；实施/验收矩阵 #29。旧43首发及其Spec、固定目录保持历史身份，不作为新目录上限。

固定上游 `b755761bf19fdcd4d4ad433d2431882c370ad05e` 的三语言 `dist/api/**/all.json` 与 native config 复制到 `data/upstream/b755761bf/`；`source.json` 记录原文件路径/SHA。此固定源与继承UI代码同步核对，不在构建时联网滚动抓取或用自有raw补价。

```
npm ci --ignore-scripts
npm --prefix web ci --ignore-scripts
npm run test:cny
node scripts/build-visual-site.mjs data/cny/publication/upstream-release.json /tmp/new-exclusive-site
node scripts/check-visual-site.mjs /tmp/new-exclusive-site
```

全部50供应商、616条模型与i18n保留。只适配 `model.cost` 为 CNY 价格视图，原始完整成本另留 `model.sourceCost`；非价格元数据逐字段不变，不以核价日期覆写模型更新时间。`model.cnyPrice`记录资格/币种/导出去向，元数据存在不代表有价或可售。无价格时cost只有CNY币种无数值，UI显示缺源与—，不能显示为0。非原生单位价可仅供资料，不生成表达式。

币种选择：明确CNY主sheet优先，其次明确CNY alternate。国内端点缺原CNY不采用USD估算。其他USD按金额白名单×7一次；嵌套tiers/schedule价格同样转换，阈值、时间、TTL、模型limit等不变。源cost所有字段仍可追溯。默认平台CNY/显示汇率1，不提供重算另一套汇率的新需求。

国内默认映射在 `scripts/upstream-cny.mjs` 明确列出。全部订阅/国际区域导航仍可点击；初始导航默认alibaba-cn，全局同名搜索优先国内资料。原生API按模型键分组，若有国内非订阅记录，只在国内集合内选合格项，不降级到国际报价；否则在其他非订阅集合选。可表达同名冲突以provider ID稳定排序，记录每个winner和排除，完全不使用上游priority。不同端点的cost绝不混合。页面保留所有区域价，只有被选中项目提供原生表达式/复制；供应商复制是全量新API按provider的分区，不重算。

`buildBillingExpr`复用共享原生核心；费用未知、缺必要输出、未知价格字段、非支持单位、生成器warning或订阅都拒出，原因逐记录发布。明确官方0保留，缺失不造0。全量页面记录数/合格区域记录数/去重API键数分别报告，API不等于616键。

新版本身份由固定source、全部派生三语言catalog、选择和排除产生；manifest包括每个固定文件SHA，`upstream-release.json`为已批准政策范围的具体构建回执。Pages workflow仍手动、业务分支、exact source/release/manifest输入和原4个SHA pins。构建先重现旧首发fixed目录，再新增新版本、切current和stable。严禁覆写旧versions目录。

`publication.html`提供新来源、固定manifest、选择/缺源排除清单及旧发布索引；旧43原发布页移至 `legacy-publication.html`。旧current/stable属于可变入口允许切换，旧fixed字节必须保持。CI检查固定源/目录/API/排除/旧hash/inventory；独立QA另做逐字段、原价深层核对、浏览器实际复制/下载/搜索/详情/手机及公网验证。没有写实例、付费调用或自动定时改价。
