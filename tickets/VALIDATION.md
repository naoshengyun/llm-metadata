# Local verification and review handoff — 2026-11-16

Integration branch: `cindy/sweet-einstein`. Fixed review base: `d9f6cf3d1b643ac186f1be82dfcab754505a9343` (resolve full SHA with git rev-parse). Original research base `9e73e8bb3` exists as ancestor; work began on supplement `d9f6cf3d1`.

No local tracker configuration was found; T1–T7 are individual local files, with original ticket names, dependencies and D AC references. All source development stays here; no remote repository, upstream push, schedule activation, deploy or production price change. Remote PR is **待提交PR**: needs authorized fork owner/hosting target; current origin is upstream basellm/llm-metadata.

## Repeatable entry points

- `npm ci --ignore-scripts` (locked dev dependencies only).
- `npm run test:cny`: strict TypeScript builds to `.cache/cny-build`, then G/S/A + real local-history fixtures. Does not rebuild upstream dist or translations.
- `npm run cny:generate -- data/cny/synthetic-example.json .cache/cny-example`: explicitly synthetic example. Produces original/CNY catalogue, diagnostics, independent ratio/plugin/tool partitions, immutable manifest/identity. No automatic fetch, publish or apply.
- `node scripts/check-native-expressions.mjs --new-api /Users/kohr/brainx_ai/new-api --go /Users/kohr/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.10.darwin-arm64/bin/go`: isolated exact rc50 archive, actual original parser/quota computation, 12 independent vectors. Source tree is unmodified. Does not launch gateway.
- T7 native API library: `previewArtifact`, then explicit artifact/target/plan/actor confirmation into `applyArtifact`; caller supplies native authenticated fetch. Native server owns permission checks.

## Self-review evidence

Standards and Spec reviewed separately at initial commit 649feed06 against d9f6cf3d1. Neither is independent Reviewer/QA acceptance. No documented style/browser-safety breaches. Findings: incomplete tool quote leaked sibling prices; unselected catalogue unsupported shapes retained ready; task variant selected name differed from plugin declaration; upstream snapshot was unused. Follow-up stages each record across all partitions, validates catalogue before selection, lists not-selected exclusions, validates native task binding, replaces entire cost over upstream metadata before expression building, and supports explicit upstreamKey pin with missing/deletion rejection. Regression cases cover each path. QuotaPerUnit option concern was retracted after checking exact rc50 model/option.go (it is present).

## Explicit limits

- I native instance import/save/readback has not run; offline parser and A mocks do not constitute I or production/O/R completion.
- Coverage reference retains all supplied 18 platforms / 136 triples, order and duplicates; reported141/difference5 are reference metadata. No fabricated original official prices or production mappings. Real official records require maintenance; example fixture is not a verified market price.
- upstreamKey explicitly pins models which must exist in the source snapshot. Independent maintained quotes can exist without models.dev entries; no stale upstream fee is inherited.
- Tool PUT has no native CAS; last-read-to-write races cannot be eliminated here. Use external exclusive update window. No cross-partition global atomicity, automatic rollback or retries of unknown outcomes.
- Actions template remains inactive; inherited workflows quarantined on business branch. Immutable mirror main may contain unknown upstream workflows, therefore hosted repository Actions must remain disabled until a safe hosting policy is approved. No actual scheduled/bot/PR hosted chain is claimed.
- No remote target authorized, so no PR URL or independent review approval is fabricated. No tickets closed as end-to-end sales/production Done.
