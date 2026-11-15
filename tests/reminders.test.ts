import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REMINDER_SCHEDULE,
  evaluateReminderState,
  formatTimeLabel,
  hasCompletedEveningWindowSession,
  parseTimeToMinutes,
  pruneDismissalsToDate,
  sanitizeReminderSchedule,
} from '../src/lib/reminders';

test('time formatting, parsing, and schedule sanitization handle valid, overnight, and malformed inputs (L8)', () => {
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

  // Overnight / shift-worker schedule (morning 22:00, evening 07:00) is preserved
  const overnight = sanitizeReminderSchedule({
    morning: { enabled: true, time: '22:00' },
    evening: { enabled: true, time: '07:00' },
    browserNotifications: false,
  });
  assert.equal(overnight.morning.time, '22:00');
  assert.equal(overnight.evening.time, '07:00');

  // Exact tie (both 08:30) still adjusts evening away cleanly
  const tied = sanitizeReminderSchedule({
    morning: { enabled: true, time: '08:30' },
    evening: { enabled: true, time: '08:30' },
    browserNotifications: false,
  });
  assert.notEqual(tied.morning.time, tied.evening.time);
});

test('evaluateReminderState surfaces morning/evening accurately and separates morning sessions from evening reflection (L8)', () => {
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

  // Completing a 9:00 AM guided session must NOT suppress the 8:30 PM evening reflection reminder!
  const morningSessionLocal = new Date(2026, 10, 12, 9, 0, 0).toISOString();
  const eveningAfterMorningSession = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: true,
    todayHasSession: true,
    completedSessions: [
      {
        completionId: 'c-am',
        runId: 'r-am',
        sessionId: 'gentle-breathing',
        title: 'Gentle breathing',
        durationSeconds: 120,
        completedAt: morningSessionLocal,
        date: today,
      },
    ],
    dismissals: {},
  });
  assert.equal(eveningAfterMorningSession.dueReminder?.slot, 'evening');

  // Completing a session at 8:45 PM DOES satisfy the evening reflection reminder
  const eveningSessionLocal = new Date(2026, 10, 12, 20, 45, 0).toISOString();
  assert.equal(
    hasCompletedEveningWindowSession(
      [
        {
          completionId: 'c-pm',
          runId: 'r-pm',
          sessionId: 'sleep-wind-down',
          title: 'Sleep wind-down',
          durationSeconds: 300,
          completedAt: eveningSessionLocal,
          date: today,
        },
      ],
      today,
      20 * 60 + 30
    ),
    true
  );

  const eveningDone = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: true,
    todayHasSession: true,
    completedSessions: [
      {
        completionId: 'c-pm',
        runId: 'r-pm',
        sessionId: 'sleep-wind-down',
        title: 'Sleep wind-down',
        durationSeconds: 300,
        completedAt: eveningSessionLocal,
        date: today,
      },
    ],
    dismissals: {},
  });
  assert.equal(eveningDone.dueReminder, null);
  assert.match(eveningDone.statusSummary, /Next: Morning check-in tomorrow at 8:30 AM/);

  // Fallback to unlogged morning check-in after evening completion
  const fallbackMorning = evaluateReminderState({
    schedule: DEFAULT_REMINDER_SCHEDULE,
    todayDateKey: today,
    nowMinutes: 21 * 60,
    todayHasEntry: false,
    todayHasSession: true,
    completedSessions: [
      {
        completionId: 'c-pm',
        runId: 'r-pm',
        sessionId: 'sleep-wind-down',
        title: 'Sleep wind-down',
        durationSeconds: 300,
        completedAt: eveningSessionLocal,
        date: today,
      },
    ],
    dismissals: {},
  });
  assert.equal(fallbackMorning.dueReminder?.slot, 'morning');
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
  assert.deepEqual(
    pruneDismissalsToDate({ '2026-11-12': { morning: true } }, 'bad-date'),
    {}
  );

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
