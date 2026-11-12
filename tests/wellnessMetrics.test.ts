import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMindfulStreak,
  computeSelfReportedEnergyScore,
  computeWellnessStatistics,
  formatSleepMinutes,
  getChronologicalReflectiveNotes,
  hasAnyRecordedMetric,
} from '../src/lib/wellnessMetrics';

test('self-reported energy score never fabricates missing scores and multiplies 1..10 by 10', () => {
  assert.equal(computeSelfReportedEnergyScore(null), null);
  assert.equal(computeSelfReportedEnergyScore(1), 10);
  assert.equal(computeSelfReportedEnergyScore(7), 70);
  assert.equal(computeSelfReportedEnergyScore(10), 100);
});

test('statistics include only recorded values, preserve 0 values, and separate different local dates', () => {
  const entries = {
    '2026-11-01': {
      date: '2026-11-01',
      energyRating: 6,
      steps: 0, // recorded zero
      sleepMinutes: 420, // 7h 0m
      updatedAt: '2026-11-01T20:00:00.000Z',
    },
    '2026-11-02': {
      date: '2026-11-02',
      energyRating: 8,
      steps: null, // missing
      sleepMinutes: 480, // 8h 0m
      updatedAt: '2026-11-02T09:00:00.000Z',
    },
    '2026-10-15': {
      date: '2026-10-15',
      energyRating: 4,
      steps: 5000,
      sleepMinutes: null,
      updatedAt: '2026-10-15T09:00:00.000Z',
    },
  };

  const stats = computeWellnessStatistics(entries, [], '2026-11-02');
  assert.equal(stats.daysWithCheckIn, 3);
  assert.equal(stats.recordedDaysInLast7, 2);
  assert.equal(stats.mindfulStreak.currentStreak, 2);
  assert.equal(stats.mindfulStreak.longestStreak, 2);
  assert.deepEqual(stats.averageSleep7d, {
    averageMinutes: 450,
    includedCount: 2,
  });
  assert.equal(formatSleepMinutes(stats.averageSleep7d.averageMinutes), '7h 30m');
  assert.deepEqual(stats.averageEnergy7d, {
    averageRating: 7,
    averageScore: 70,
    includedCount: 2,
  });
  assert.deepEqual(stats.averageSteps7d, {
    averageSteps: 0,
    includedCount: 1,
  });
});

test('hasAnyRecordedMetric distinguishes empty entries from recorded zeros', () => {
  assert.equal(hasAnyRecordedMetric(null), false);
  assert.equal(
    hasAnyRecordedMetric({
      date: '2026-11-02',
      energyRating: null,
      steps: null,
      sleepMinutes: null,
      updatedAt: '2026-11-02T10:00:00.000Z',
    }),
    false
  );
  assert.equal(
    hasAnyRecordedMetric({
      date: '2026-11-02',
      energyRating: null,
      steps: 0,
      sleepMinutes: 0,
      updatedAt: '2026-11-02T10:05:00.000Z',
    }),
    true
  );
});

test('computeMindfulStreak combines entries and sessions, deduplicates same day, and preserves longestStreak', () => {
  // Empty state never fabricates a streak
  const empty = computeMindfulStreak({}, [], '2026-11-12');
  assert.equal(empty.currentStreak, 0);
  assert.equal(empty.longestStreak, 0);
  assert.equal(empty.activeToday, false);
  assert.equal(empty.lastActiveDate, null);

  // Earlier 3-day run (Oct 29 - Oct 31 across month boundary), gap, then Nov 10 (entry) + Nov 11 (session)
  const entries = {
    '2026-10-29': {
      date: '2026-10-29',
      energyRating: 6,
      steps: null,
      sleepMinutes: null,
      updatedAt: '2026-10-29T10:00:00.000Z',
    },
    '2026-10-30': {
      date: '2026-10-30',
      energyRating: 7,
      steps: null,
      sleepMinutes: null,
      updatedAt: '2026-10-30T10:00:00.000Z',
    },
    '2026-11-10': {
      date: '2026-11-10',
      energyRating: null,
      steps: 0,
      sleepMinutes: null,
      updatedAt: '2026-11-10T10:00:00.000Z',
    },
  };
  const sessions = [
    {
      completionId: 'c1',
      runId: 'r1',
      sessionId: 'mindfulness',
      title: 'Mindfulness',
      durationSeconds: 300,
      completedAt: '2026-10-31T18:00:00.000Z',
      date: '2026-10-31',
    },
    {
      completionId: 'c2',
      runId: 'r2',
      sessionId: 'gentle-breathing',
      title: 'Gentle breathing',
      durationSeconds: 180,
      completedAt: '2026-11-11T19:00:00.000Z',
      date: '2026-11-11',
    },
    {
      // Extra session on same day must not double-count day 2
      completionId: 'c3',
      runId: 'r3',
      sessionId: 'sleep-wind-down',
      title: 'Sleep wind-down',
      durationSeconds: 300,
      completedAt: '2026-11-11T22:00:00.000Z',
      date: '2026-11-11',
    },
  ];

  // Morning of Nov 12 before logging today: yesterday's 2-day chain remains intact
  const morningStreak = computeMindfulStreak(entries, sessions, '2026-11-12');
  assert.equal(morningStreak.currentStreak, 2);
  assert.equal(morningStreak.longestStreak, 3);
  assert.equal(morningStreak.activeToday, false);
  assert.equal(morningStreak.todayHasEntry, false);
  assert.equal(morningStreak.todayHasSession, false);
  assert.equal(morningStreak.totalActiveDays, 5);
  assert.equal(morningStreak.lastActiveDate, '2026-11-11');

  // After logging an entry on Nov 12, streak extends to 3 days and activeToday becomes true
  const withTodayEntry = computeMindfulStreak(
    {
      ...entries,
      '2026-11-12': {
        date: '2026-11-12',
        energyRating: 8,
        steps: null,
        sleepMinutes: null,
        updatedAt: '2026-11-12T12:00:00.000Z',
      },
    },
    sessions,
    '2026-11-12'
  );
  assert.equal(withTodayEntry.currentStreak, 3);
  assert.equal(withTodayEntry.longestStreak, 3);
  assert.equal(withTodayEntry.activeToday, true);
  assert.equal(withTodayEntry.todayHasEntry, true);
  assert.equal(withTodayEntry.todayHasSession, false);

  // If user skips Nov 12 and checks on Nov 13, currentStreak resets to 0 while longestStreak remains 3
  const brokenStreak = computeMindfulStreak(entries, sessions, '2026-11-13');
  assert.equal(brokenStreak.currentStreak, 0);
  assert.equal(brokenStreak.longestStreak, 3);
  assert.equal(brokenStreak.activeToday, false);
});

test('computeWellnessStatistics aggregates daily completedSessionsCount and preserves null energyScore in sevenDayWindow', () => {
  const entries = {
    '2026-11-08': {
      date: '2026-11-08',
      energyRating: 6,
      steps: 4200,
      sleepMinutes: 430,
      updatedAt: '2026-11-08T09:00:00.000Z',
    },
    '2026-11-12': {
      date: '2026-11-12',
      energyRating: 9,
      steps: 7100,
      sleepMinutes: 470,
      updatedAt: '2026-11-12T08:30:00.000Z',
    },
  };

  const sessions = [
    {
      completionId: 's-old',
      runId: 'r-old',
      sessionId: 'mindfulness',
      title: 'Mindfulness',
      durationSeconds: 300,
      completedAt: '2026-11-01T12:00:00.000Z',
      date: '2026-11-01', // outside 7-day window (Nov 6..Nov 12)
    },
    {
      completionId: 's1',
      runId: 'r1',
      sessionId: 'mindfulness',
      title: 'Mindfulness',
      durationSeconds: 300,
      completedAt: '2026-11-10T18:00:00.000Z',
      date: '2026-11-10', // session-only day without a daily check-in
    },
    {
      completionId: 's2',
      runId: 'r2',
      sessionId: 'gentle-breathing',
      title: 'Gentle breathing',
      durationSeconds: 180,
      completedAt: '2026-11-10T21:00:00.000Z',
      date: '2026-11-10',
    },
    {
      completionId: 's3',
      runId: 'r3',
      sessionId: 'energy-reset',
      title: 'Energy reset',
      durationSeconds: 180,
      completedAt: '2026-11-12T15:00:00.000Z',
      date: '2026-11-12',
    },
  ];

  const stats = computeWellnessStatistics(entries, sessions, '2026-11-12');

  assert.equal(stats.sevenDayWindow.length, 7);
  assert.equal(stats.recordedDaysInLast7, 2);
  assert.equal(stats.completedSessionsInLast7, 3);
  assert.equal(stats.activeDaysInLast7, 3); // Nov 8 (entry), Nov 10 (sessions only), Nov 12 (both)

  const byDate = Object.fromEntries(stats.sevenDayWindow.map((day) => [day.date, day]));
  assert.equal(byDate['2026-11-08'].energyScore, 60);
  assert.equal(byDate['2026-11-08'].completedSessionsCount, 0);

  // Nov 10 had 2 sessions and no check-in: energyScore must stay null (never 0)
  assert.equal(byDate['2026-11-10'].energyScore, null);
  assert.equal(byDate['2026-11-10'].completedSessionsCount, 2);

  // Nov 11 had neither check-in nor sessions
  assert.equal(byDate['2026-11-11'].energyScore, null);
  assert.equal(byDate['2026-11-11'].completedSessionsCount, 0);

  assert.equal(byDate['2026-11-12'].energyScore, 90);
  assert.equal(byDate['2026-11-12'].completedSessionsCount, 1);
});

test('hasAnyRecordedMetric and getChronologicalReflectiveNotes track and order daily reflections chronologically', () => {
  assert.equal(
    hasAnyRecordedMetric({
      date: '2026-11-12',
      energyRating: null,
      steps: null,
      sleepMinutes: null,
      reflectiveNote: '   ',
      updatedAt: '2026-11-12T10:00:00.000Z',
    }),
    false
  );

  assert.equal(
    hasAnyRecordedMetric({
      date: '2026-11-12',
      energyRating: null,
      steps: null,
      sleepMinutes: null,
      reflectiveNote: 'Quiet evening reading.',
      updatedAt: '2026-11-12T10:00:00.000Z',
    }),
    true
  );

  const entries = {
    '2026-11-08': {
      date: '2026-11-08',
      energyRating: 6,
      steps: 4500,
      sleepMinutes: 420,
      reflectiveNote: 'Took a slow morning stretch.',
      updatedAt: '2026-11-08T09:00:00.000Z',
    },
    '2026-11-10': {
      date: '2026-11-10',
      energyRating: 8,
      steps: null,
      sleepMinutes: null,
      reflectiveNote: null, // day without a note should be skipped
      updatedAt: '2026-11-10T09:00:00.000Z',
    },
    '2026-11-12': {
      date: '2026-11-12',
      energyRating: null,
      steps: null,
      sleepMinutes: null,
      reflectiveNote: '  Unplugged before bed.  ',
      updatedAt: '2026-11-12T20:00:00.000Z',
    },
    '2026-11-09': {
      date: '2026-11-09',
      energyRating: 7,
      steps: 6100,
      sleepMinutes: 465,
      reflectiveNote: 'Steady focus after lunch walk.',
      updatedAt: '2026-11-09T18:00:00.000Z',
    },
  };

  const descNotes = getChronologicalReflectiveNotes(entries, 'desc');
  assert.deepEqual(
    descNotes.map((n) => n.date),
    ['2026-11-12', '2026-11-09', '2026-11-08']
  );
  assert.equal(descNotes[0].note, 'Unplugged before bed.');
  assert.equal(descNotes[0].energyScore, null);
  assert.equal(descNotes[1].energyScore, 70);

  const ascNotes = getChronologicalReflectiveNotes(entries, 'asc');
  assert.deepEqual(
    ascNotes.map((n) => n.date),
    ['2026-11-08', '2026-11-09', '2026-11-12']
  );
});

