import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REMINDER_SCHEDULE,
  evaluateReminderState,
  formatTimeLabel,
  parseTimeToMinutes,
  pruneDismissalsToDate,
  sanitizeReminderSchedule,
} from '../src/lib/reminders';

test('time formatting, parsing, and schedule sanitization handle valid and malformed inputs', () => {
  assert.equal(formatTimeLabel('08:30'), '8:30 AM');
  assert.equal(formatTimeLabel('00:05'), '12:05 AM');
  assert.equal(formatTimeLabel('12:00'), '12:00 PM');
  assert.equal(formatTimeLabel('20:30'), '8:30 PM');

  assert.equal(parseTimeToMinutes('08:30'), 510);
  assert.equal(parseTimeToMinutes('25:99'), null);

  const sanitized = sanitizeReminderSchedule({
    morning: { enabled: false, time: '99:99' },
    evening: { enabled: true, time: '19:45' },
    browserNotifications: 'yes',
  });
  assert.equal(sanitized.morning.enabled, false);
  assert.equal(sanitized.morning.time, DEFAULT_REMINDER_SCHEDULE.morning.time);
  assert.equal(sanitized.evening.enabled, true);
  assert.equal(sanitized.evening.time, '19:45');
  assert.equal(sanitized.browserNotifications, false);
});

test('evaluateReminderState surfaces morning and evening reminders only when due, incomplete, and undismissed', () => {
  const today = '2026-11-12';

  // Before 8:30 AM: neither reminder is due yet
  const early = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 7 * 60 + 30,
    todayHasEntry: false,
    todayHasSession: false,
    dismissals: {},
  });
  assert.equal(early.dueReminder, null);
  assert.match(early.statusSummary, /Next: Morning check-in at 8:30 AM/);

  // Midday (13:36): morning reminder is due when no check-in has been saved yet
  const morningDue = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 13 * 60 + 36,
    todayHasEntry: false,
    todayHasSession: false,
    dismissals: {},
  });
  assert.equal(morningDue.dueReminder?.slot, 'morning');
  assert.equal(morningDue.dueReminder?.scheduledLabel, '8:30 AM');

  // Once check-in is saved, morning reminder clears and points to evening
  const afterCheckIn = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 13 * 60 + 36,
    todayHasEntry: true,
    todayHasSession: false,
    dismissals: {},
  });
  assert.equal(afterCheckIn.dueReminder, null);
  assert.match(afterCheckIn.statusSummary, /Today’s check-in logged/);
  assert.match(afterCheckIn.statusSummary, /Evening reflection at 8:30 PM/);

  // If dismissed instead of completed, morning reminder stays dismissed for today
  const afterDismiss = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 13 * 60 + 36,
    todayHasEntry: false,
    todayHasSession: false,
    dismissals: { [today]: { morning: true } },
  });
  assert.equal(afterDismiss.dueReminder, null);
  assert.match(afterDismiss.statusSummary, /Morning reminder dismissed for today/);

  // Evening (21:00): evening reflection reminder activates until a session is completed or dismissed
  const eveningDue = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: true,
    todayHasSession: false,
    dismissals: {},
  });
  assert.equal(eveningDue.dueReminder?.slot, 'evening');
  assert.equal(eveningDue.dueReminder?.secondaryActionLabel, 'Reflect with Coach');

  const eveningDone = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: true,
    todayHasSession: true,
    dismissals: {},
  });
  assert.equal(eveningDone.dueReminder, null);
  assert.match(eveningDone.statusSummary, /Next: Morning check-in tomorrow at 8:30 AM/);
});

test('pruneDismissalsToDate drops stale days and paused schedules report paused state', () => {
  const pruned = pruneDismissalsToDate(
    {
      '2026-11-11': { morning: true, evening: true },
      '2026-11-12': { morning: true },
    },
    '2026-11-12'
  );
  assert.deepEqual(pruned, { '2026-11-12': { morning: true } });

  const paused = evaluateReminderState({
    schedule: {
      morning: { enabled: false, time: '08:30' },
      evening: { enabled: false, time: '20:30' },
      browserNotifications: false,
    },
    todayDateKey: '2026-11-12',
    nowMinutes: 12 * 60,
    todayHasEntry: false,
    todayHasSession: false,
    dismissals: {},
  });
  assert.equal(paused.dueReminder, null);
  assert.equal(paused.statusSummary, 'Daily reminders are paused.');
});

test('evaluateReminderState falls back to unlogged morning check-in after evening completion and sanitizes inverted times', () => {
  const today = '2026-11-12';

  // Even at 9:00 PM, if evening session is completed/dismissed and morning check-in was never logged,
  // morning reminder surfaces rather than disappearing silently.
  const fallbackMorning = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: false,
    todayHasSession: true,
    dismissals: {},
  });
  assert.equal(fallbackMorning.dueReminder?.slot, 'morning');

  // If both were dismissed in the evening, status mentions morning dismissal
  const bothDismissed = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: false,
    todayHasSession: false,
    dismissals: { [today]: { morning: true, evening: true } },
  });
  assert.equal(bothDismissed.dueReminder, null);
  assert.match(bothDismissed.statusSummary, /Morning reminder dismissed for today/);
  assert.match(bothDismissed.statusSummary, /Evening reminder dismissed for today/);

  // Equal or inverted enabled slot times reset safely so morning is never shadowed
  const inverted = sanitizeReminderSchedule({
    morning: { enabled: true, time: '21:00' },
    evening: { enabled: true, time: '09:00' },
    browserNotifications: false,
  });
  assert.equal(inverted.morning.time, DEFAULT_REMINDER_SCHEDULE.morning.time);
  assert.equal(inverted.evening.time, DEFAULT_REMINDER_SCHEDULE.evening.time);

  // Invalid todayDateKey returns empty dismissals
  assert.deepEqual(
    pruneDismissalsToDate({ '2026-11-12': { morning: true } }, 'bad-date'),
    {}
  );
});
