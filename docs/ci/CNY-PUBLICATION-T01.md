# PUB-T01：模型源发布封装与本地 H 验证

实现范围：[正式Spec](https://github.com/naoshengyun/llm-metadata/issues/18)、[首票PUB-T01](https://github.com/naoshengyun/llm-metadata/issues/19)的PUB-AC-01/02/03/09。规范由Planner维护；本文只说明开发验证，不改变AC或首发选择。

`buildModelRelease`接受有效固定artifact及显式models/mode/purpose，验证原价资格和模型mode/expr完整成对，生成success/data模型响应、固定adapter版本、新releaseId及响应字节hash。原始来源日期、policy、全reference/coverage、excluded与逐条未选原因保留；full模式拒绝incomplete，partial不伪装成全量。purpose=test只表示测试选择，不是首发批准。插件/工具标为独立配置，不混入模型URL。

`writeModelRelease`仅在调用者指定的既存本地目录内排他创建releaseId子目录，写release.json及ratio_config.json；不存在网络发布或稳定入口提升动作。重复目录/文件/链接拒覆写，身份或所选模型响应不完整时拒绝。完整包inventory/HTTP交付、稳定入口/回退分别属后票，不以本票代做。

## S

```sh
npm run test:cny
```

发布测试通过导出的生成/本地固定版本接口检验：确定性/输入不变、缺mode/expr、混币/缺收费项、选择合法性、partial与排除/日期、拒覆写、重复quoteId、hash重算仍缺字段等行为。真实维护资料用固定测试选择校验完整136参考及141差5原值不变；不重新请求官网价目。

## H（独立隔离 rc50，非原 I 夹具）

先编译，再显式提供原固定artifact路径：

```sh
node scripts/check-publication-source.mjs .cache/official-cny/d5a84ca10d8599343370c1541828439a56b8dd1b/artifact.json
```

命令只使用已缓存的固定官方镜像（pull=never），新建随机cny-h-*容器、loopback端口与tmpfs数据库，初始化一次性身份；不复用/清理原I容器。HTTP服务器只绑定宿主127.0.0.1，原版经host.docker.internal实际读取随机路径，不能假设容器localhost是宿主。真实可达性由fetch成功证明。

测试选择仅Kimi/Claude两个模型，显式purpose=test。H调用原生ratio_sync/fetch及model_pricing/preview，逐字段比较所选mode/expr；没有价格/单位/组/工具保存接口调用。前后完整options与model_pricing哈希一致、渠道0、原artifact字节不变；finally只移除本命令创建的容器，复查其不存在，保留本地临时证据与release文件。`H-report.json`含实现HEAD、完整imageID/revision、releaseId、原始fetch/preview结果、负例、请求路径、前后hash和清理回执，凭证不入日志。

Native rc50 limitation: a missing/false `success` with an empty `message` can be labelled `success` in `test_results` while returning no prices. A nonempty rejection message produces an explicit error. H records both cases and checks actual selected prices; it does not claim the native status flag validates a complete source. Canonical PUB-AC-02 v1.3 records this distinction; no new-api change is made.

`--legacy-envelope`是开发红例：在正例位置供应缺success旧格式，所选字段断言失败；不是生产构建开关，也不能将此失败运行称为通过。正常H负例分别包含带message的拒绝响应、无message的缺success响应、success=false且空message响应；它们均不产生可用所选价格，配置前后不变。

## 证据边界

S/H不是实际运营页面、公开Pages、实例应用或真实供应商调用。PUB-AC-11由后票承担，后续前置关闭后才开工。此票不启用workflow/许可/Pages，不默认首发名单，不改旧artifact、不触碰保留I夹具。独立QA必须绑定固定实现commit并区分其自有执行证据与实施日志；不能以本票关闭代替发布或整体O/R。
