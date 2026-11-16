# Fork CI activation design (read-only investigation, 2026-11-16)

## Decision

Do not enable Actions with the present default `main`. After PR1 merges and the separate configuration review passes, a defensible first activation is manual-only tests + offline candidate generation on reviewed `naoshengyun`, with `main` hard-locked and default switched to `naoshengyun` before enabling. Keep the mirror's commits unchanged. A repository action allowlist is not a workflow allowlist.

This is a proposed protocol, not a claim that activation occurred. No GitHub mutations or repository edits were performed for this investigation.

## Live facts

Authenticated GETs against `naoshengyun/llm-metadata` returned:

- Fork parent: `basellm/llm-metadata`; default: `main`; current account admin access.
- Actions: `enabled:false`, `sha_pinning_required:false`.
- Token default: `read`; `can_approve_pull_request_reviews:false`.
- Workflows: `total_count:0`; both filename lookups below return HTTP 404.
- Runs: `total_count:0`.
- `main` branch protection GET: HTTP 404 (not protected).

All three branch-head Git trees were read:

| Branch | SHA | Executable workflow files |
| --- | --- | --- |
| main | d9f6cf3d1b643ac186f1be82dfcab754505a9343 | build.yml; issue-submission-pr.yml |
| naoshengyun | 04e0ab7279b7ddd6b6ecfab7d500f3f162767a2f | none |
| cny/official-price-source | d5a84ca10d8599343370c1541828439a56b8dd1b | none |

Both business branches contain `.github/upstream-workflows/` copies and `.github/naoshengyun-workflow-templates/check.yml`, outside the executable directory. The inactive check template includes manual + PR triggers and mutable action tags; do not activate it unchanged.

Inherited blob inventory (main and quarantined copies have identical blob IDs):

- `.github/workflows/build.yml`: `16139ce55c460db302da001475c98b8080d9a478`. Main/master push + daily schedule + manual. Writes contents/pages/id-token; commits dist/translations, pushes, tags/releases, deploys Pages. **Keep disabled.**
- `.github/workflows/issue-submission-pr.yml`: `8e2a9db4e09ed09de8aeccdfb46d20d10df9472b`. Issue mutations + manual; writes content/issues/PRs, creates/pushes branches and PRs. **Keep disabled.**

## Why simple enabling fails review

Default `read` token permissions can be increased by workflow YAML; they are not a maximum permission boundary. Selected actions limit referenced dependencies and still permit local actions/reusable workflows. They do not select executable workflow IDs. Full SHA policy applies to actions, while reusable workflow tag references are still permitted. [GitHub repository settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

There are currently **no IDs to pre-disable**. Do not claim a successful disable from an empty list. Use the real workflow ID disable API before enable whenever IDs exist; require `disabled_manually` on readback. The filename lookup currently returns 404, so its availability cannot be assumed. [Workflow REST API](https://docs.github.com/en/rest/actions/workflows).

## Activation sequence (all steps evidence-gated)

1. Finish PR1 merge and separate CI config review while repository Actions remain OFF. Re-read all branch heads and workflow trees immediately before activation; stop on unexpected branches/files/triggers. Review YAML, called scripts, package/lockfiles and generated-candidate behavior at the exact proposed commit.
2. Commit only reviewed `.github/workflows/naoshengyun-ci.yml` onto the business branch through the reviewed configuration change. Initial trigger: **workflow_dispatch only**. No push, PR, schedule, workflow_run, repository_dispatch, issue or target-PR triggers.
3. Switch repository default to `naoshengyun`, verify receipt and readback. This changes default routing, not mirror commits. All inherited default-branch events must now have no executable default workflow files. In particular, schedule and manual dispatch require the workflow on default; scheduled runs use default. [Event rules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows).
4. Protect `main` with branch lock, enforce administrators, no force pushes/deletion, and **allow_fork_syncing:false**. Verify effective protection including overlapping rulesets and bypass actors. Preserve any stronger existing protections. Hard requirement: no commits or upstream sync into main while Actions are on. A locked branch is read-only; optional fork syncing would bypass the intended freeze. [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
5. List ALL registered workflows (paginated) while Actions remain OFF; disable every inherited/unreviewed workflow by real ID if present and verify state. Zero remains a documented special case: rely on the verified default switch + hard mirror lock, not imaginary disabled IDs. If review requires pre-disabled IDs specifically, activation remains blocked until GitHub supports registering/disabling them safely while repository execution is off.
6. Set and read back `allowed_actions:selected`, `sha_pinning_required:true`, default token read, PR approval false, while Actions remain OFF. Set selected patterns only to exact reviewed action commit SHAs, with `github_owned_allowed:false` and `verified_allowed:false`; no wildcards. If these settings cannot be staged and verified while disabled, stop rather than briefly enable broadly. [Permissions REST API](https://docs.github.com/en/rest/actions/permissions).
7. Enable repository Actions preserving selected+SHA policy in the same policy update. Verify receipt and immediately re-read permissions, default branch, mirror lock, workflow inventory and active/queued runs. Enable only the reviewed CI ID if necessary. Disable any inherited IDs that register, then verify. No unreviewed workflow should run; if one does, immediately disable repo Actions and separately cancel existing/queued runs. Disabling a workflow does not cancel existing runs. [Disable behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows).
8. Explicitly dispatch reviewed CI with `ref:naoshengyun`. Capture run ID/URL, event, actor, head SHA, workflow path, exact workflow revision and logs. Wait for completed success and inspect actual steps/token scopes, not just YAML or badge. Download candidate artifacts, verify hashes independently and check business/main/data/dist heads remained unchanged.

## Exact settings shapes for the implementation review

These are review inputs, not executed commands. Use `gh api --method PUT ... --input <json-file>` with explicit `repos/naoshengyun/llm-metadata/...`, preserve unrelated settings, and retain response/readback evidence.

```json
{"enabled":false,"allowed_actions":"selected","sha_pinning_required":true}
```

Endpoint: `actions/permissions`. After all gates pass, change only `enabled` to true, retaining both restrictions.

```json
{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}
```

Endpoint: `actions/permissions/workflow`.

```json
{"github_owned_allowed":false,"verified_allowed":false,"patterns_allowed":["actions/checkout@11d5960a326750d5838078e36cf38b85af677262","actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020","actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"]}
```

Endpoint: `actions/permissions/selected-actions`. These three v4 tag objects were independently read from official action repositories and are commit objects on 2026-11-16. They are candidate pins, not a source-code audit. If review picks different versions, update YAML and allowlist together. Verify originating repository and exact commit, not a fork. [SHA guidance](https://docs.github.com/en/actions/reference/security/secure-use).

Branch protection: `branches/main/protection`, full PUT payload including required nullable fields, `enforce_admins:true`, `lock_branch:true`, `allow_fork_syncing:false`, `allow_force_pushes:false`, `allow_deletions:false`. Do not replace existing protections blindly. Keep `main` pointing to the same d9 commit before and after.

Default change: PATCH repository with `{"default_branch":"naoshengyun"}`. Verify existing PR bases and human default expectations, but do not rewrite PR branches automatically.

## Reviewed CI contract

- `permissions: {contents: read}` explicitly; no contents-write, PR/issue/page/release permissions, OIDC, environment or credentials. Hosted fresh runner; timeout and concurrency set. No self-hosted runner or cache import.
- Job guard checks exact repository, workflow_dispatch, and `refs/heads/naoshengyun`; checkout uses explicit reviewed SHA/context SHA and `persist-credentials:false`. No arbitrary user-provided ref/script input. Branch naming guard is defense in depth, not a substitute for review of workflow changes.
- Use pinned official checkout/setup-node/upload-artifact; node 22. `npm ci --ignore-scripts`; run `npm run test:cny` then `npm run cny:official:build` only. Review all called code and lockfile first. Current commands compile under `.cache/cny-build`; official candidate is offline under `.cache/official-cny/<sourceSha>` and explicitly not published/applied.
- No npm build/check/translate (the upstream build path writes dist), production API calls, automatic upstream merge, commits/pushes, release tags or Pages.
- Fail if tracked working tree changed (at minimum all data/prices/dist/i18n); include full source SHA, workflow commit, catalog+selection hashes, tests, candidate manifest/semantic diff and SHA256SUMS in the candidate. Upload only candidate files with finite retention, fail if missing. Explicitly handle `.cache` hidden paths (stage to non-hidden runner temp before upload).
- Record upload artifact ID and digest plus file SHA256 values. Download and recompute; a successful build or hash alone is not business acceptance or authenticity. Artifact action digest checks can produce warnings rather than a failed run. [Artifact validation](https://docs.github.com/en/actions/tutorials/store-and-share-data).

## Independent QA and limitations

QA must verify exact reviewed YAML/script/lockfile commit, live default/business/main heads, ALL workflow files on ALL branches, hard mirror lock/no syncing/no bypass, disabled inherited IDs when available, hard SHA-only action policy, token scopes in real logs, event=`workflow_dispatch`, branch and head SHA, successful tests, candidate file hashes, and zero tracked writes/releases/deployments. Confirm no unexpected runs before and after manual dispatch. A skipped job is not test evidence.

Default switch alone leaves main push workflows live on main. Mirror lock alone leaves inherited default-branch issue/schedule/manual triggers. The combined controls are necessary here. The allowlist is secondary containment and cannot block arbitrary shell-only workflows or all locally referenced code. A repo writer/admin who changes workflows or settings is still trusted; settings are not an isolation boundary against an administrator. Avoid all branch writes during the enable/verify window.

Any future upstream sync: turn repository Actions OFF first, verify no in-progress runs (cancel separately if necessary), update mirror, inventory every new upstream workflow, rebuild sanitized business candidate, review, re-lock mirror, then repeat activation gates. Never allow a mirror sync job or unattended upstream merge while Actions are on. Initial manual-only run evidence does not prove PR/push triggers or automatic syncing safe; those require their own reviewed change.

## Implemented workflow and artifact contract

`.github/workflows/naoshengyun-ci.yml` is manual-only and uses the three exact official pins above. Dispatch requires `expected_sha` matching the selected business-branch commit, failing before checkout/dependencies on a mismatch. Other refs/events/repositories are outside its job guard. No environment, secrets, Pages/release, price application, push, issue mutation or upstream sync is configured. A skipped job is not acceptance.

Steps: lockfile install without lifecycle scripts → `npm run test:cny` → `npm run cny:official:build` → `scripts/ci-candidate-evidence.mjs` → finite-retention evidence upload from runner temp. Receipt staging requires source/workflow/expected SHA equality, a clean repository and valid candidate source/identity. It preserves candidate bytes, binds each SHA256, adds receipt and checksum file. Verify downloaded contents with `node scripts/ci-candidate-evidence.mjs verify <downloaded-directory>` after normal local compilation. GitHub upload digest/run identity and source SHA must also match; self-contained hashes are integrity, not an independent signature.

The candidate generated by a new CI source SHA is a new artifact, even when quote values are unchanged. It remains not-published/not-applied and packageComplete=false where exclusions exist. It does not replace the previously accepted d5a84ca/18098469 candidate or authorize production application. There is no production baseline implied by candidate-addition diff output.

Local S regressions cover byte preservation, corrupted artifact rejection, mismatched confirmation SHA and dirty source rejection. This document is the activation plan; actual settings receipts/run URL/download verification are required separately. No Actions success is claimed from this text.

## Upstream sync remains a review operation

No hosted sync job or cron is enabled. To update main: first turn repository Actions OFF, verify no active runs, obtain a fixed approved upstream commit, temporarily unlock main only for a fast-forward mirror update, then re-lock with fork syncing disabled. Inventory all branches and workflows again. Use the existing isolated candidate merge CLI and its conflict/protected-path diagnostics; push only the sanitized candidate branch and open a PR against naoshengyun. Failed merge/guard/test must remain failed and must not publish or auto-merge. Any change to the controlled workflow—including its quarantine by the generic sync script—must be resolved and independently reviewed before merge. Repeat activation gates before restoring CI. No automatic price-source refresh or automatic production release is added.
