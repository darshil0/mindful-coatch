import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMindfulStreak,
  computeSelfReportedEnergyScore,
  computeWellnessStatistics,
  formatSleepMinutes,
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
