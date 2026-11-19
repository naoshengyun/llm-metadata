#!/usr/bin/env bash
# Run from the trusted business checkout after preparing $1/source and $1/preparation.json.
set -euo pipefail
work="${1:?Pass the sync run directory}"
image='node:22-bookworm@sha256:e13726ca604184d7a91fcacab1fc09eefd642dc28e79ac34e85540dd93b78cfb'
isolated="$work/isolated"
results="$work/results"
mkdir "$isolated" "$results"

# Known business code computes independently what the proposed data should publish.
npm ci --ignore-scripts
npm run cny:unified:build -- "$work/previous"
rel="$(jq -er '.upstreamDirectory | select(test("^data/upstream/[a-f0-9]{8}$"))' "$work/source/data/cny/unified-policy.json")"
node scripts/build-unified-cny.mjs "$work/trusted" "$work/source/data/cny/unified-policy.json" \
  data/cny/official-catalog.json data/cny/proposed-selection.json "$work/source/$rel" "$work/previous"

# Give the candidate only its own checkout, read-only comparison data and a results directory.
runner=(docker run --rm --init --user "$(id -u):$(id -g)" --env HOME=/tmp \
  --cap-drop ALL --security-opt no-new-privileges --workdir /candidate \
  --mount "type=bind,source=$isolated,target=/candidate")
if ! "${runner[@]}" --mount "type=bind,source=$work/source,target=/incoming,readonly" \
  "$image" bash -euc 'cp -a /incoming/. .; npm ci --ignore-scripts; npm --prefix web ci --ignore-scripts' \
  > "$work/candidate-install.log" 2>&1; then
  tail -60 "$work/candidate-install.log" | sed 's/^/candidate: /'
  exit 1
fi
if ! "${runner[@]}" --network none \
  --mount "type=bind,source=$work/previous,target=/previous,readonly" \
  --mount "type=bind,source=$results,target=/results" \
  "$image" bash -euc '
    npm run test:cny
    upstream_directory="$(node -p "require(\"./data/cny/unified-policy.json\").upstreamDirectory")"
    node scripts/build-unified-cny.mjs /results/candidate data/cny/unified-policy.json \
      data/cny/official-catalog.json data/cny/proposed-selection.json "$upstream_directory" /previous
    node scripts/build-visual-site.mjs data/cny/publication/upstream-release.json /results/site /results/candidate
  ' > "$work/candidate-check.log" 2>&1; then
  tail -80 "$work/candidate-check.log" | sed 's/^/candidate: /'
  exit 1
fi

test -z "$(find "$results" -type l -print -quit)"
for file in coverage.json selection.json price-diff.json api/newapi/ratio_config.json \
  api/all.json api/i18n/zh/all.json api/i18n/ja/all.json; do
  cmp "$work/trusted/$file" "$results/candidate/$file"
done
node scripts/report-upstream-sync.mjs "$work/preparation.json" "$work/previous" "$results/candidate" \
  "$results/site" > "$work/validation.json"
