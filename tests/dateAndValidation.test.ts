import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalDateKey, getPastLocalDateKeys, isValidDateKey } from '../src/lib/dateUtils';
import {
  isValidWellnessGoal,
  validateEnergyRating,
  validatePreferredName,
  validateSleepInputs,
  validateStepsInput,
} from '../src/lib/validation';

test('getLocalDateKey uses local calendar components rather than UTC shifting', () => {
  const localLateNight = new Date(2026, 10, 2, 23, 45, 0); // Nov 2, 2026 11:45 PM local
  assert.equal(getLocalDateKey(localLateNight), '2026-11-02');
  assert.equal(isValidDateKey('2026-11-02'), true);
  assert.equal(isValidDateKey('2026-02-30'), false);

  const past7 = getPastLocalDateKeys(7, '2026-11-02');
  assert.equal(past7.length, 7);
  assert.equal(past7[0], '2026-10-27');
  assert.equal(past7[6], '2026-11-02');
});

test('validation distinguishes missing inputs from recorded zero values and enforces bounds', () => {
  // Goal validation
  assert.equal(isValidWellnessGoal('sleep'), true);
  assert.equal(isValidWellnessGoal('unknown'), false);

  // Name validation
  assert.deepEqual(validatePreferredName('   Maya   Lin  '), {
    valid: true,
    value: 'Maya Lin',
  });
  assert.equal(validatePreferredName('   ').valid, false);

  // Energy rating
  assert.deepEqual(validateEnergyRating(''), { valid: true, value: null });
  assert.deepEqual(validateEnergyRating(8), { valid: true, value: 8 });
  assert.equal(validateEnergyRating(0).valid, false);
  assert.equal(validateEnergyRating(11).valid, false);

  // Steps: empty -> null, "0" -> 0
  assert.deepEqual(validateStepsInput(''), { valid: true, value: null });
  assert.deepEqual(validateStepsInput('0'), { valid: true, value: 0 });
  assert.deepEqual(validateStepsInput('7450'), { valid: true, value: 7450 });
  assert.equal(validateStepsInput('-10').valid, false);
  assert.equal(validateStepsInput('12.5').valid, false);

  // Sleep: both empty -> null, 0h 0m -> 0, 24h 0m -> 1440, 24h 15m -> invalid
  assert.deepEqual(validateSleepInputs('', ''), { valid: true, value: null });
  assert.deepEqual(validateSleepInputs('0', '0'), { valid: true, value: 0 });
  assert.deepEqual(validateSleepInputs('7', '30'), { valid: true, value: 450 });
  assert.deepEqual(validateSleepInputs('24', '0'), { valid: true, value: 1440 });
  assert.equal(validateSleepInputs('24', '15').valid, false);
  assert.equal(validateSleepInputs('6', '60').valid, false);
});
