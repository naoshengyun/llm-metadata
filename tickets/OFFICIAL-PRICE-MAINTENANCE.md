# First official original-price maintenance candidate — 2026-11-16

Scope: follow-up authorized after independent acceptance of generator commit `923b2f667bb4051c0530f31a6e9bf552643cbc2f`. Maintain current original first-party quotations, generate an auditable candidate, keep all reference rows and exclusions, then request QA. This is not authorization to publish/apply prices, create a remote repository, enable Actions or change routes/groups.

## Inputs and proposal

- `data/cny/official-catalog.json`: original USD/CNY amounts with URLs, checked date, units, TTL/context/condition details. 63 complete generator-compatible records; 115 alternative/incomplete/unsupported source entries retain known raw prices and reasons. Two optional tool-fee groups remain separately declared and excluded from the proposed tool config.
- `data/cny/proposed-selection.json`: review-only selection of 54 official records: 44 model prices, 9 existing native task-plugin variants, 1 native tool price. Selection contains exact official IDs and tariff identities, not private endpoint/channel/alias/account/group mappings. Explicit-cache alternatives, Batch, protocol duplicates and historical Hunyuan tariff are retained without default proposal.
- `data/cny/coverage-reference.json`: unchanged 18 platforms / 136 provided triples, including duplicate model names across protocols, source order and the zero-model platform. Reported141/provided136/difference5 remain reference metadata; no fabricated rows.
- Research: `price-research-west.md`, `price-research-domestic-a.md`, `price-research-domestic-b.md`, `price-research-tools.md` in this directory. Primary live official documentation only; no Exa or paid supplier calls. Model-name suffixes are not inferred as aliases without official proof.

All 136 reference rows receive an assessment: 49 ready price-data entries, 52 exact-ID/original-price sources unverified, 8 incomplete, 27 unsupported. These are price-source contract states, not actual availability, consumption, billing or sale acceptance. Historical Hunyuan-a13b's published legacy tariff can be represented but is deliberately not proposed for application; its platform retirement notice is retained. Exact canonical native task models can be quoted even when a supplied private short name remains unmapped.

## Important tariff boundaries

- Domestic original CNY stays unchanged; foreign original USD is multiplied by7 once, using the accepted generator. No rounded upstream USD reverse calculation or ratio-wide multiplication.
- “Original” Alibaba list figures are publicly stated list-price bases, **not current effective net prices**: applicable promotions remain disclosed in the source research. This proposal does not claim a customer can opt out of an automatic discount. Batch, cache mode, speed, region, endpoint and other official lists stay distinct.
- DeepSeek peak periods exclude Chinese statutory holidays; no weekday-only approximation is emitted. Its original rates are retained as unsupported. Successful/nonempty-only independent search/fetch fees are preserved separately because not every rc50 fallback count enforces that condition.
- Paid token-hour storage, cached-audio prices, unsupported4K/profile dimensions and free-first-input-image conditions are not silently discarded. Google mixed-modality image accounting and OpenAI2.6/cache/SVG gaps remain explicit. Direct OpenAI Images2/2.5 raster quotes use ordinary output variable c, not an absent image-output detail; their cache discounts are not applicable to that endpoint.
- Original Kimi China TTL5m/1h prices are explicit; BigModel temporarily free storage stays a million-token-hour declaration and is not invented as cache_write0. Exact thresholds are accepted only with official numeric/boundary evidence. M3/GLM5.1 unresolved K boundaries stay incomplete.
- Search-Std has one independently sourced0.01 CNY/call record, converted to10 CNY/1000 calls in its separate native tool package. No other tool fee is silently included in model coefficients.

## Reproduce the fixed candidate

`npm run test:cny` compiles to `.cache/cny-build` and tests the accepted generator plus the new snapshot seam. Current local result:45/45. New snapshot tests check all original triples, invalid ready declarations, original CNY/one USD conversion, direct Images output meter, and explicit optional fee exclusions. Synthetic snapshot behaviors were developed one red→green slice at a time; additional maintained-price assertions use independently verified official literal examples.

After committing the source/data snapshot, run:

```
npm run cny:official:build
```

The maintenance command refuses uncommitted source/scripts/data inputs, fixes source SHA, hashes the entire original catalogue and coverage reference, and writes only `.cache/official-cny/<sourceSha>/`. It produces artifact/manifest, original+CNY catalogue, all136 coverage rows, source/shape diagnostics, independent ratio/plugin/tool partitions, status and semantic-diff files. An optional previous immutable artifact path makes a real candidate-to-candidate semantic diff. Without one, changes are expressly first-candidate additions; no production baseline or current applied-price change is claimed. Full manifest stays incomplete while any exclusions remain.

For isolated I save/readback of the actual fixed candidate (no provider requests):

```
node scripts/check-native-instance.mjs .cache/official-cny/<sourceSha>/artifact.json
```

The existing script still runs its six original synthetic contract cases and native conflict check, then optionally imports all selected real candidate entries into the same disposable, localhost-only pinned rc50 instance. It binds candidate sourceSha to checkout, verifies each selected native result, preserves group/unselected tool fields and cleans its container in finally. This is configuration validation, not real provider billing.

Independent QA must review the new source/data commit and the real first-party price facts; the earlier accepted generator head does not automatically approve this maintenance addition. Version-specific final artifact fingerprint, logs and receipt will be supplied for that review. No release, production application or remote PR is implied.
