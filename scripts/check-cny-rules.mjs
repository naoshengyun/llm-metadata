/** Check authenticated ruleset readback or effective protection for the exact branch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [path] = process.argv.slice(2);
assert.ok(path, 'Pass ruleset or active branch rules JSON');
const actual = JSON.parse(readFileSync(path));
const expected = JSON.parse(
  readFileSync(new URL('../.github/cny-branch-rules.json', import.meta.url)),
);
const rules = Array.isArray(actual) ? actual : actual.rules;
if (!Array.isArray(actual)) {
  assert.equal(actual.name, expected.name);
  assert.equal(actual.target, 'branch');
  assert.equal(actual.enforcement, 'active');
  assert.deepEqual(actual.bypass_actors, [], 'Ruleset bypass actors are forbidden');
  assert.deepEqual(actual.conditions, expected.conditions);
}
const check = (actualValue, expectedValue, label) => {
  assert.notEqual(actualValue, undefined, 'Absent ' + label);
  if (typeof expectedValue !== 'object' || Array.isArray(expectedValue))
    return assert.deepEqual(actualValue, expectedValue, label);
  for (const [key, value] of Object.entries(expectedValue))
    check(actualValue[key], value, label + '.' + key);
};
for (const rule of expected.rules)
  check(
    rules.find(({ type }) => type === rule.type),
    rule,
    rule.type,
  );
console.log('CNY business branch protection matches the required rules');
