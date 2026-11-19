/** A candidate's reviewed cutoff may never be later than the runner's real clock. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'data/cny/unified-policy.json';
const { asOf } = JSON.parse(readFileSync(path));
assert.match(asOf, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
assert.ok(Number.isFinite(Date.parse(asOf)), 'Invalid review cutoff');
assert.ok(Date.parse(asOf) <= Date.now(), 'Review cutoff is in the future');
