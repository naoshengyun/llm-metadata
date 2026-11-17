# PUB-T02：固定版本包的HTTP交付与运营接入

Status: draft-awaiting-user

**What to build:** 运营从固定版本地址取得模型、插件、工具及来源/排除说明，重算清单/hash后获明确接入步骤；缺文件/坏JSON/混版本时整包校验失败，不漏价成功。

**Blocked by:** PUB-T01。

关闭条件：PUB-AC-01/03/04/08/10；本地静态服务器完整包下载与负例、拒覆写通过；manifest绑定所有实际输出、候选/选择/适配器，非秘密信息only；运营示例分别说明模型URL、插件对象、工具千次/独占、CNY预检与实例确认。保留完整参考和excluded，full模式拒incomplete。TDD+独立审查；不接生产目标、不发布公网、不调用供应商。
