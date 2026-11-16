# Controlled CNY CI: activation and observed evidence

This runbook covers tests and offline candidate artifacts only. It does not authorize deployment, supplier calls, price publication/application or O/R acceptance. Workflow/source changes require a new fixed-head review. Repository administrators remain trusted operators; these controls do not resist an administrator changing settings.

## Integrated versions and reviewed scope (2026-11-16)

| Change | Independent fixed head | Integrated business commit |
| --- | --- | --- |
| PR #1 source + original-price candidate | d5a84ca10d8599343370c1541828439a56b8dd1b | 04e0ab7279b7ddd6b6ecfab7d500f3f162767a2f |
| PR #2 engineering configuration | 60c8561aa5d5fe992e9e6c2b5bd4d1c2b6180f43 | 26fb5a2dcbf56289a5f8b0288f91a0f476e1e41c |
| PR #3 controlled CI, including CI-S1/CI-F1 repairs | d5a733fe74ee34ba48f931ebc99e4b2ee964c562 | f5e02bb28e93a2a57a25ff069ff267f9f98e4b5e |

The PR #3 integrated tree is `d3e3f99d002d1a45b1ed474344ae53be0d98fba0`, exactly the independently reviewed head tree. Workflow blob: `72f6edd982882e7baca8be6cfec0ada8feff79c9`. The initial bcb9353 CI head failed review; its incomplete checksum/coherence paths were repaired and independently closed before integration. Successful earlier local tests were not activation approval.

## Inherited workflows and execution boundary

The mirror `main` remains upstream commit `d9f6cf3d1b643ac186f1be82dfcab754505a9343` and retains these original executable files:

- `build.yml`, blob `16139ce55c460db302da001475c98b8080d9a478`: main/master push, schedule and manual; writes source/dist/translations, tags/releases and Pages; contents/pages/id-token write. It is not the controlled CI.
- `issue-submission-pr.yml`, blob `8e2a9db4e09ed09de8aeccdfb46d20d10df9472b`: issue/manual events and content/issues/PR writes. It is not activated for business automation.

Their business-branch copies remain non-executable data in `.github/upstream-workflows/`. The old check template also remains inactive; do not activate its mutable tags or PR trigger.

Default branch is `naoshengyun`. Main protection requires lock_branch and enforced administrators, fork syncing/force pushes/deletion disabled. Source commits are not changed by this lock/default change. Future mirror updates require Actions OFF, a fixed approved upstream commit and a fresh complete workflow audit before reactivation.

An action allowlist is not a workflow allowlist, and default read token permissions are not a ceiling on YAML. Inherited registered workflow IDs must be disabled with actual readback; absence of IDs is not a successful disable. Previous/manual workflows can remain dispatchable on other refs. Audit every branch and registered ID, not only the default tree. [Workflow controls](https://docs.github.com/en/rest/actions/workflows), [branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## Actual API limits and reviewed replacement protocol

The original OFF-state pre-staging proposal was **not achievable**, and must not be recorded as having passed:

1. GitHub returned HTTP409 for `enabled:false` together with `allowed_actions:selected`; selected-actions GET also returns409 while OFF.
2. A successful OFF-state request for SHA pinning was not effective on readback.
3. GitHub rejected an empty selected list with both owned/verified false. This is not a supported deny-all action mode.

Both attempts stopped and restored/retained OFF, with no run. Existing QA reviewed two operational amendments before proceeding. The replacement execution barrier is **every registered workflow disabled**, plus the frozen reviewed refs/trigger inventory, default business branch and main lock. No enabled/all request or unknown-policy dispatch is permitted. Selected/local-only policies do not prevent arbitrary local/shell code and are not described as universal deny-all.

Mandatory sequence for activation or policy reconfiguration:

1. Keep repository Actions OFF. Disable every registered workflow ID and require disabled_manually readback. Freeze branch/workflow/settings writes by other operators; no dispatch/rerun during policy staging. Audit all branch trees, main effective lock/rules/bypass, business commit/tree and default branch. Require no active/queued runs; inspect historical runs/IDs for unexpected activity. The first activation had exactly five branches, one newly registered CI ID and zero historical runs.
2. Confirm read token/no PR approval. Enable the repository in a **single** policy PUT `{ "enabled": true, "allowed_actions": "selected", "sha_pinning_required": true }`. Immediately verify these values, all workflow IDs still disabled, refs/lock unchanged and no unexpected runs. This policy request alone does not certify the selected list.
3. GET and archive the existing selected list. Replace it using the complete object below (not append/merge), then require both booleans false, three unique entries, length3 and exact equality. No empty-list transition or wildcard fallback. [Selected-actions API](https://docs.github.com/en/rest/actions/permissions#set-allowed-actions-and-reusable-workflows-for-a-repository).

```json
{
  "github_owned_allowed": false,
  "verified_allowed": false,
  "patterns_allowed": [
    "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
    "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020",
    "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02"
  ]
}
```

4. Re-read policy/pinning, token permissions, refs/trees/default/main lock, workflows and runs. Only then enable the independently reviewed CI ID (`420020133` for this rollout). **After enablement and before dispatch**, query all workflow states and runs again: require only the approved ID active, all others disabled, no active/queued or unexpected run, and unchanged reviewed refs/default/main protection/policy/token. On any mismatch restore OFF and cancel runs separately. Only after this explicit post-enable gate passes dispatch `naoshengyun` with exact reviewed integrated `expected_sha`. Stop rather than substitute a new latest SHA or a historical branch.
5. Wait for actual completed success and inspect jobs/steps/token scopes. A dispatch receipt or skipped job is not test success. Download the artifact, compare GitHub archive digest and file checksums, validate complete semantic package and source/workflow/run identity, and recheck refs/no releases/deployments/unexpected runs.
6. Any API failure, mismatch or incomplete evidence: restore OFF, separately cancel queued/active runs, preserve receipts and obtain renewed assessment. Disabling does not cancel runs. Do not continue on partially verified settings.

This sequence is the independently reviewed amendment to the failed proposal, not a claim of cross-endpoint atomicity. Review decisions are archived in the existing QA task `82c7ef89-4746-403e-a2b8-51a880c07eef`, `qa-evidence/activation-f5e02bb/REVIEW-ADDENDUM.md` and `direct-replacement/AMENDMENT.md`.

## Workflow and artifact contract

`.github/workflows/naoshengyun-ci.yml` is workflow_dispatch only, with exact repository/event/business-ref job guard, expected40hex SHA check before checkout, fixed action SHAs, contents read, no persisted credentials, secrets, environment, cache import or self-hosted runner. It performs lockfile install without lifecycle scripts, price-source tests, offline candidate generation and finite14-day artifact upload. It has no push/PR/schedule/issue/sync trigger, release, Pages, production API or price application.

`scripts/ci-candidate-evidence.mjs` requires clean source and source/workflow/expected SHA equality. Staging and download verification require all ten candidate files, parse JSON and rebuild candidate consistency against the recorded sourcebook/reference/selection. Price partitions, status, coverage, diagnostics, first-candidate diff and report identity must match. A unique exact receipt/checksum inventory rejects missing/extra/duplicate/nonregular files and contradicting completeness/publication/application metadata. Public S regressions plus independent mutations verified the repaired contract. Self-contained hashes are integrity, not a signature; compare against GitHub run/source/digest receipts.

## First real hosted run

[Actions run 43855884901](https://github.com/naoshengyun/llm-metadata/actions/runs/43855884901), workflow_dispatch by `lgsimle`, source/workflow/expected SHA `f5e02bb28e93a2a57a25ff069ff267f9f98e4b5e`: completed **success**. Real logs show54 tests/54pass/0fail and token Contents:read, Metadata:read. No claim that the original PR #1 had GitHub CI; Actions was disabled at that merge.

- Artifact ID: `14220897163`; 14-day retention.
- GitHub/upload digest and downloaded ZIP SHA256: `f515df8f9700aaaf25d8721ddd0b2f82b733734f1d3f75e7bc2879b9b1cc7c95`.
- CI candidate ID: `5390a70419ebf58e4b1fc3ca4844b3d2e946c97c04674881a6d80068f1f72ad3`.
- Download: ten payload files plus receipt.json and SHA256SUMS; complete verifier passed; run/source/workflow/ref/repo identities matched GitHub.
- Sourcebook/reference/policy/price partition hashes equal the prior accepted d5a84ca candidate, but the new source SHA creates a **different immutable artifact**. It does not replace the original `18098469191dc513e23644a1afbe59219ca3cfae908631f3b0794af25fc3b138` confirmation.
- After run: main d9/business f5 unchanged, only the expected run existed, releases/deployments empty, packageComplete=false, not-published/not-applied.

Implementation receipts/downloads are under `/tmp/cny-ci-real-run-43855884901/`; settings and rejected-attempt history under `/tmp/cny-ci-activation/`. Independent QA accepted this exact hosted run after its own API reads, direct ZIP download, digest/file/semantic checks and source comparison: existing QA task `82c7ef89-4746-403e-a2b8-51a880c07eef`, `qa-evidence/run-43855884901/REVIEW.md`. This is distinct from implementation assertions. The current verifier can silently skip its CLI body when invoked through a macOS absolute `/tmp` alias; use its canonical source path or the documented relative invocation, and require explicit JSON `valid:true` rather than an exit code alone. The successful Linux workflow is unaffected; portability remains a nonblocking future change. Retention-limited GitHub assets should be copied to the designated controlled evidence store before expiry when needed for stg; no credential-bearing state belongs in this public repository.

## Upstream synchronization

No hosted sync job/cron or automatic merge is enabled. Before any mirror change: Actions OFF, inspect/cancel active runs separately, fixed approved upstream SHA, temporarily unlock solely for mirror fast-forward, relock with fork syncing disabled, then re-audit every branch/workflow. The existing isolated merge CLI must prepare a sanitized business candidate and explicit failure report; push only a candidate branch and open a PR against naoshengyun. Conflict/guard/test failure must remain failed, never publish/auto-merge. Generic quarantine may also remove the controlled workflow; restore/change it only through independent review before integration and repeat activation gates.
