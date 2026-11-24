import assert from 'node:assert/strict';

export const WEEKLY_SCHEDULE_EXCEPTION_REASON =
  'user-approved-weekday-schedule-ignores-chinese-legal-holidays-and-adjusted-workdays';
export const WEEKLY_SCHEDULE_CONDITION =
  'weekdays-ignore-chinese-legal-holidays-and-adjusted-workdays';

function validateWindow(window, hours, sourcePrice, modelId) {
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
  const declared = policy.weeklyScheduleExceptions?.[modelId];
  const exclusion = policy.nativeCapabilityExclusions?.[modelId];
  if (!declared) return null;
  assert.ok(exclusion, 'Weekly schedule exception requires native capability evidence: ' + modelId);
  for (const [field, value] of [
    ['providerId', providerId],
    ['endpoint', endpoint],
  ]) {
    assert.equal(declared[field], value, modelId + ' exception ' + field);
    assert.equal(exclusion[field], value, modelId + ' exclusion ' + field);
  }
  assert.equal(declared.reason, WEEKLY_SCHEDULE_EXCEPTION_REASON, modelId + ' exception reason');
  assert.equal(
    exclusion.conditions?.chineseLegalHolidays,
    'off_peak',
    modelId + ' official holiday evidence',
  );
  const schedule = exclusion.sourcePrice?.schedule;
  assert.equal(schedule?.timezone, 'Asia/Shanghai', modelId + ' official timezone');
  assert.equal(schedule?.fallback, 'off_peak', modelId + ' official fallback');
  assert.equal(schedule?.windows?.length, 1, modelId + ' official window count');
  validateWindow(schedule?.windows?.[0], ['09:00-12:00', '14:00-18:00'], exclusion.sourcePrice, modelId);
  if (adapted) {
    const { cost, expr } = adapted;
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
