---
status: accepted
recorded_at: 2026-11-16
---

# 单 fork 分离上游镜像与业务维护

既有批准采用一个 fork：main 保留上游提交，naoshengyun 承载业务规则/报价，上游更新通过候选与审查 PR 吸收，而不把业务构建回写到纯镜像或用强制同步覆盖业务历史。保留共同祖先和资料归属可降低长期合并歧义；代价是继承工作流与发布权限必须独立隔离，Git 同步、核价、候选构建、价格发布和实例应用不能合为一个自动生效动作。

组织归属和受控手动 CI 后续已在用户授权下落地；当前 main 锁定、CI 开启期间不直接同步镜像，后续镜像更新先关闭 Actions 并重新审计。具体可变的 API 门禁与实际运行证据只维护于[CI 运行手册](../ci/CNY-CI-ACTIVATION.md)，不在 ADR 复制一套操作步骤。依据：[批准 Spec 快照](../requirements/snapshots/spec-v0.12.md) §2 及[来源/后续授权索引](../requirements/CNY-SOURCE-REGISTRY.md)。
