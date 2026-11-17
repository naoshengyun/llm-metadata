# 运营接入草稿（未批准、无可用发布URL）

1. 发布后由维护者给出稳定发现入口、固定releaseId/manifest/模型源URL、plugin/tool文件及校验值。运营先读取coverage/selection/excluded、原价日期和partial标记；下载/发布成功不等于实例已应用或可售。
2. 固定目标rc50、USDExchangeRate=1、QuotaPerUnit500000；只读保存选中价格和未选键/版本/工具全表/有效组。原始USD×7已经在源内完成，不再乘7；组倍率由运营独立配置，不写入价格源。临时I夹具当前恢复为7.3，不是本次新的CNY应用目标。
3. 模型：使用原生上游倍率fetch/preview，指定获选固定版本的完整Endpoint（不能空置而误读/api/pricing，也不能仍选内置basellm preset）。预期success:true/data内billing_mode/billing_expr。确认差异后走现有受控选择/保存；原版UI自定义源可见性仍待实现阶段验证，不承诺新增后台。
4. 插件：从同一release读取指定model→plugin→expression，核对已有schema/profile，另经原生版本化model_pricing接口选择保存/读回；模型源同步成功不能替代此步。
5. 工具：同release中每千次单位的tool表，原生GET全表fresh合并、独占窗口PUT/读回；没有CAS，不自动与模型/插件合成全局原子。无独占则不应用该分区并报告部分状态。
6. 本次发布执行、目标实例写入和恢复意图均需各自明确确认；目标/候选/diff改变则重呈。冲突不强盖，超时先读回，unknown不报成功。源版本回退只改变源入口；实例恢复须新确认、fresh版本及工具独占，保留未选键，不重算旧账单。
7. 接入记录分别标识模型/插件/工具：下载已校验、配置已应用、调用/usage、扣费/账单、可售批准。后三项等待真实业务目标、渠道/alias/协议/schema与测试预算；不要求全136才能开始发布开发，不把配置I当真实O。

权限及核价频率尚待用户决定。本草稿不携带账号Key、不要求填秘密；不触发自动同步、发布、供应商或生产调用。
