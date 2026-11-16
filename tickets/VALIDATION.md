# Local verification and review handoff — 2026-11-16

Integration branch: `cindy/sweet-einstein`. Fixed review base: `d9f6cf3d1b643ac186f1be82dfcab754505a9343` (resolve full SHA with git rev-parse). Original research base `9e73e8bb3` exists as ancestor; work began on supplement `d9f6cf3d1`.

No local tracker configuration was found; T1–T7 are individual local files, with original ticket names, dependencies and D AC references. All source development stays here; no remote repository, upstream push, schedule activation, deploy or production price change. Remote PR is **待提交PR**: needs authorized fork owner/hosting target; current origin is upstream basellm/llm-metadata.

## Repeatable entry points

- `npm ci --ignore-scripts` (locked dev dependencies only).
- `npm run test:cny`: strict TypeScript builds to `.cache/cny-build`, then G/S/A + real local-history fixtures. Does not rebuild upstream dist or translations.
- `npm run cny:generate -- data/cny/synthetic-example.json .cache/cny-example`: explicitly synthetic example. Produces original/CNY catalogue, diagnostics, independent ratio/plugin/tool partitions, immutable manifest/identity. No automatic fetch, publish or apply.
- `node scripts/check-native-expressions.mjs --new-api /Users/kohr/brainx_ai/new-api --go /Users/kohr/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.10.darwin-arm64/bin/go`: isolated exact rc50 archive, actual original parser/quota computation, 12 independent vectors. Source tree is unmodified. Does not launch gateway.
- `node scripts/check-native-instance.mjs`: I seam. Requires Docker and the cached exact digest pinned in the script; starts a fresh tmpfs SQLite rc50 container bound to localhost random port, performs only native management API requests, and removes its own container in finally. Logs contain no credentials. Run after compilation and the final source commit to bind evidence to the delivered revision.
- T7 native API library: `previewArtifact`, then explicit artifact/target/plan/actor confirmation into `applyArtifact`; caller supplies native authenticated fetch. Native server owns permission checks.

## Self-review evidence

Standards and Spec reviewed separately at initial commit 649feed06 against d9f6cf3d1. Neither is independent Reviewer/QA acceptance. No documented style/browser-safety breaches. Findings: incomplete tool quote leaked sibling prices; unselected catalogue unsupported shapes retained ready; task variant selected name differed from plugin declaration; upstream snapshot was unused. Follow-up stages each record across all partitions, validates catalogue before selection, lists not-selected exclusions, validates native task binding, replaces entire cost over upstream metadata before expression building, and supports explicit upstreamKey pin with missing/deletion rejection. Regression cases cover each path. QuotaPerUnit option concern was retracted after checking exact rc50 model/option.go (it is present).

## Explicit limits

- I native instance import/save/readback subset passed on 2026-11-16 with official rc50 image digest `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9`, OCI revision `f2aa91232ed3e5878a614762ace6736a2b74257f`. Actual generator→fixed artifact→previewArtifact/applyArtifact→native save/readback covered USD token 3/15→21/105, per-image, CNY image/token/cache/TTL1h/context tiers, factory Alibaba image and Doubao video Token `u("tokens") * 21 / 1000000`, and USD tool10/1000→CNY70/1000. Six selected items applied. Native expected_version conflict was observed without overwrite; configured ModelRatio/CacheRatio, unselected tool key and default group multiplier0.8 were preserved. `/tmp/cny-I.log` records the latest repeatable run; all created containers removed. No supplier requests or runtime consumption/settlement occurred. Quota10500/8400 examples are arithmetic only, not actual debits. This I subset does not constitute production/O/R completion.
- Coverage reference retains all supplied 18 platforms / 136 triples, order and duplicates; reported141/difference5 are reference metadata. No fabricated original official prices or production mappings. Real official records require maintenance; example fixture is not a verified market price.
- upstreamKey explicitly pins models which must exist in the source snapshot. Independent maintained quotes can exist without models.dev entries; no stale upstream fee is inherited.
- Tool PUT has no native CAS; last-read-to-write races cannot be eliminated here. Use external exclusive update window. No cross-partition global atomicity, automatic rollback or retries of unknown outcomes.
- Actions template remains inactive; inherited workflows quarantined on business branch. Immutable mirror main may contain unknown upstream workflows, therefore hosted repository Actions must remain disabled until a safe hosting policy is approved. No actual scheduled/bot/PR hosted chain is claimed.
- No remote target authorized, so no PR URL or independent review approval is fabricated. No tickets closed as end-to-end sales/production Done.

## Final verification update

`npm run test:cny`: 35/35 passed. `scripts/check-native-expressions.mjs`: 12/12 actual original parser/quota vectors passed. `node scripts/check-native-instance.mjs`: disposable SQLite official image pinned digest `sha256:096feb95eed27a8e4f34d4b4908d7d216d019b79349e70ca9b74ba947986fdd9`, labels revision `f2aa91232ed3e5878a614762ace6736a2b74257f`, version `v1.0.0-rc.50`. Six selected items saved and read back via actual T7 adapter: text, per-image, CNY image/cache/TTL/threshold model, Alibaba image plugin, Doubao video Token plugin, and independent tool price. Actual stale expected_version conflicts without overwrite; ModelRatio/CacheRatio and GroupRatio0.8 remain unchanged. Supplier calls=0; this is I configuration acceptance, not real consumption/settlement. Container tmpfs data discarded and created container removed in finally.

Additional self-review fixes: conflicting duplicate tools reject entire record; malformed task tiers/charges/required paths return item diagnostic; sync defaults protect actual data/cny and src/cny paths; CLI requires committed source snapshot and reads its own repository SHA, reports built/not-published/not-applied separately.

Logs are reproducible with the above scripts. Local run outputs: `/tmp/cny-tests.log`, `/tmp/cny-native.log`, `/tmp/cny-I.log`. Independent Reviewer/QA discovery succeeded but dispatch returned `AGENT_NOT_READY: Bot permissions changed before dispatch`; no independent acceptance or review completion is claimed.
