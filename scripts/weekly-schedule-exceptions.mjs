import assert from 'node:assert/strict';

export const WEEKLY_SCHEDULE_EXCEPTION_REASON =
  'user-approved-weekday-schedule-ignores-chinese-legal-holidays-and-adjusted-workdays';
export const WEEKLY_SCHEDULE_CONDITION =
  'weekdays-ignore-chinese-legal-holidays-and-adjusted-workdays';

const NATIVE_HOLIDAY_REASON =
  'Native weekly schedules cannot express mainland China legal-holiday off-peak pricing';
const IDENTITIES = Object.freeze({
  'deepseek-flash': { chineseLegalHolidays: 'off_peak' },
  'deepseek-v4-flash': {
    chineseLegalHolidays: 'off_peak',
    billedAsModel: 'deepseek-flash',
    servingModel: 'DeepSeek-V4.1-Flash-1017',
  },
  'deepseek-v4-flash-vision-exp': {
    chineseLegalHolidays: 'off_peak',
    billedAsModel: 'deepseek-flash',
    servingModel: 'DeepSeek-V4.1-Flash-1017',
  },
  'deepseek-v4-pro': { chineseLegalHolidays: 'off_peak' },
});
const AUTHORIZED_MODELS = Object.keys(IDENTITIES).sort();

function exactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value ?? {}).sort(), [...expected].sort(), label);
}

function validateWindow(window, hours, sourcePrice, modelId, upstream = false) {
  exactKeys(
    window,
    ['name', 'weekdays', 'hours', 'input', 'output', 'cache_read', ...(upstream ? ['reasoning'] : [])],
    modelId + ' exception window keys',
  );
  if (upstream) assert.equal(window?.reasoning, window?.output, modelId + ' upstream reasoning');
  assert.deepEqual(window?.weekdays, [1, 2, 3, 4, 5], modelId + ' exception weekdays');
  assert.deepEqual(window?.hours, hours, modelId + ' exception hours');
  assert.equal(window?.name, 'peak', modelId + ' exception window name');
  for (const key of ['input', 'output', 'cache_read'])
    assert.equal(window?.[key], sourcePrice.schedule.windows[0][key], modelId + ' exception ' + key);
}

/**
 * Resolve only the user-approved DeepSeek exception from raw policy and upstream evidence.
 * This never trusts a generated quote or relaxes any other native capability exclusion.
 */
export function weeklyScheduleException(policy, modelId, providerId, endpoint, adapted) {
  const declarations = policy.weeklyScheduleExceptions ?? {};
  if (Object.keys(declarations).length)
    assert.deepEqual(
      Object.keys(declarations).sort(),
      AUTHORIZED_MODELS,
      'Weekly schedule exception policy is authorized for exactly four native keys',
    );
  const declared = declarations[modelId];
  const exclusion = policy.nativeCapabilityExclusions?.[modelId];
  if (!declared) return null;
  const officialConditions = IDENTITIES[modelId];
  assert.ok(officialConditions, 'Weekly schedule exception is not authorized for ' + modelId);
  assert.equal(providerId, 'deepseek', modelId + ' exception providerId');
  assert.equal(endpoint, 'https://api.deepseek.com', modelId + ' exception endpoint');
  assert.ok(exclusion, 'Weekly schedule exception requires native capability evidence: ' + modelId);
  exactKeys(declared, ['providerId', 'endpoint', 'reason'], modelId + ' exception declaration keys');
  exactKeys(
    exclusion,
    ['providerId', 'endpoint', 'currency', 'sourceUnit', 'sourcePrice', 'conditions', 'source', 'reason'],
    modelId + ' exclusion shape keys',
  );
  for (const [field, value] of [
    ['providerId', providerId],
    ['endpoint', endpoint],
  ]) {
    assert.equal(declared[field], value, modelId + ' exception ' + field);
    assert.equal(exclusion[field], value, modelId + ' exclusion ' + field);
  }
  assert.equal(declared.reason, WEEKLY_SCHEDULE_EXCEPTION_REASON, modelId + ' exception reason');
  assert.equal(exclusion.reason, NATIVE_HOLIDAY_REASON, modelId + ' exclusion reason');
  assert.equal(exclusion.currency, 'CNY', modelId + ' exclusion currency');
  assert.equal(exclusion.sourceUnit, 'per_million_tokens', modelId + ' exclusion unit');
  assert.deepEqual(exclusion.conditions, officialConditions, modelId + ' exception conditions');
  exactKeys(
    exclusion.sourcePrice,
    ['input', 'output', 'cache_read', 'schedule'],
    modelId + ' exception source price keys',
  );
  const schedule = exclusion.sourcePrice?.schedule;
  exactKeys(schedule, ['timezone', 'fallback', 'windows'], modelId + ' exception schedule keys');
  assert.equal(schedule?.timezone, 'Asia/Shanghai', modelId + ' official timezone');
  assert.equal(schedule?.fallback, 'off_peak', modelId + ' official fallback');
  assert.equal(schedule?.windows?.length, 1, modelId + ' official window count');
  validateWindow(schedule?.windows?.[0], ['09:00-12:00', '14:00-18:00'], exclusion.sourcePrice, modelId);
  if (adapted) {
    const { cost, expr } = adapted;
    exactKeys(
      cost,
      ['input', 'output', 'reasoning', 'cache_read', 'schedule', ...(cost?.currency ? ['currency'] : [])],
      modelId + ' upstream cost keys',
    );
    if (cost?.currency) assert.equal(cost.currency, 'CNY', modelId + ' upstream currency');
    assert.equal(cost?.reasoning, cost?.output, modelId + ' upstream reasoning');
    exactKeys(
      cost?.schedule,
      ['timezone', 'fallback', 'windows'],
      modelId + ' upstream schedule keys',
    );
    assert.ok(typeof expr === 'string' && expr.length > 0, modelId + ' native expression');
    for (const key of ['input', 'output', 'cache_read'])
      assert.equal(cost?.[key], exclusion.sourcePrice[key], modelId + ' upstream CNY ' + key);
    assert.equal(cost?.schedule?.timezone, 'UTC', modelId + ' upstream timezone');
    assert.equal(cost?.schedule?.fallback, 'off_peak', modelId + ' upstream fallback');
    assert.equal(cost?.schedule?.windows?.length, 1, modelId + ' upstream window count');
    validateWindow(
      cost?.schedule?.windows?.[0],
      ['01:00-04:00', '06:00-10:00'],
      exclusion.sourcePrice,
      modelId,
      true,
    );
  }
  return {
    exclusion,
    exception: declared,
    reason: declared.reason,
    conditions: {
      ...exclusion.conditions,
      scheduleApplicability: WEEKLY_SCHEDULE_CONDITION,
    },
  };
}
