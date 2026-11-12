import type {
  CompletedSessionRecord,
  DailyEntry,
  DaySummaryItem,
  MindfulStreakState,
  WellnessStatistics,
} from '../types/wellness';
import {
  getPastLocalDateKeys,
  isValidDateKey,
  shiftLocalDateKey,
} from './dateUtils';

/**
 * Converts a 1..10 self-reported energy rating into a 10..100 display score.
 * Never fabricates a score when no rating is recorded (`null` -> `null`).
 */
export function computeSelfReportedEnergyScore(
  energyRating: number | null | undefined
): number | null {
  if (energyRating === null || energyRating === undefined) {
    return null;
  }
  if (!Number.isInteger(energyRating) || energyRating < 1 || energyRating > 10) {
    return null;
  }
  return energyRating * 10;
}

export function hasAnyRecordedMetric(entry: DailyEntry | null | undefined): boolean {
  if (!entry) return false;
  return (
    entry.energyRating !== null ||
    entry.steps !== null ||
    entry.sleepMinutes !== null
  );
}

/**
 * Calculates Mindful Streaks from consecutive local calendar days where the user
 * recorded a daily check-in entry and/or completed a guided session.
 *
 * - A day with both an entry and a session counts once toward the consecutive-day streak.
 * - If today has no activity yet, a streak ending yesterday stays alive until today ends
 *   (`activeToday: false`), then extends as soon as today logs an entry or session.
 */
export function computeMindfulStreak(
  entriesByDate: Record<string, DailyEntry>,
  completedSessions: CompletedSessionRecord[],
  todayDateKey: string,
  nowIso: string = new Date().toISOString()
): MindfulStreakState {
  const activeDates = new Set<string>();
  let todayHasEntry = false;
  let todayHasSession = false;

  for (const [dateKey, entry] of Object.entries(entriesByDate)) {
    if (!isValidDateKey(dateKey) || !hasAnyRecordedMetric(entry)) {
      continue;
    }
    if (dateKey <= todayDateKey) {
      activeDates.add(dateKey);
    }
    if (dateKey === todayDateKey) {
      todayHasEntry = true;
    }
  }

  for (const session of completedSessions) {
    if (!isValidDateKey(session.date)) {
      continue;
    }
    if (session.date <= todayDateKey) {
      activeDates.add(session.date);
    }
    if (session.date === todayDateKey) {
      todayHasSession = true;
    }
  }

  const activeToday = todayHasEntry || todayHasSession;
  const sortedActiveDates = Array.from(activeDates).sort();
  const totalActiveDays = sortedActiveDates.length;
  const lastActiveDate =
    totalActiveDays > 0 ? sortedActiveDates[totalActiveDays - 1] : null;

  let longestStreak = 0;
  let runningBest = 0;
  for (let i = 0; i < sortedActiveDates.length; i += 1) {
    if (
      i === 0 ||
      shiftLocalDateKey(sortedActiveDates[i - 1], 1) !== sortedActiveDates[i]
    ) {
      runningBest = 1;
    } else {
      runningBest += 1;
    }
    if (runningBest > longestStreak) {
      longestStreak = runningBest;
    }
  }

  const yesterdayDateKey = isValidDateKey(todayDateKey)
    ? shiftLocalDateKey(todayDateKey, -1)
    : '';
  let currentStreak = 0;
  let cursor = activeToday
    ? todayDateKey
    : yesterdayDateKey && activeDates.has(yesterdayDateKey)
      ? yesterdayDateKey
      : '';

  while (cursor && activeDates.has(cursor)) {
    currentStreak += 1;
    cursor = shiftLocalDateKey(cursor, -1);
  }

  return {
    currentStreak,
    longestStreak,
    activeToday,
    todayHasEntry,
    todayHasSession,
    totalActiveDays,
    lastActiveDate,
    updatedAt: nowIso,
  };
}

export function formatSleepMinutes(sleepMinutes: number | null | undefined): string {
  if (sleepMinutes === null || sleepMinutes === undefined) {
    return 'Not recorded';
  }
  const safe = Math.max(0, Math.round(sleepMinutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}h ${mins}m`;
}

export function splitSleepMinutesToInputs(sleepMinutes: number | null | undefined): {
  hours: string;
  minutes: string;
} {
  if (sleepMinutes === null || sleepMinutes === undefined) {
    return { hours: '', minutes: '' };
  }
  const safe = Math.max(0, Math.round(sleepMinutes));
  return {
    hours: String(Math.floor(safe / 60)),
    minutes: String(safe % 60),
  };
}

export function formatStepsCount(steps: number | null | undefined): string {
  if (steps === null || steps === undefined) {
    return 'Not recorded';
  }
  return `${steps.toLocaleString('en-US')} steps`;
}

export function computeWellnessStatistics(
  entriesByDate: Record<string, DailyEntry>,
  completedSessions: CompletedSessionRecord[],
  todayDateKey: string
): WellnessStatistics {
  const daysWithCheckIn = Object.values(entriesByDate).filter((entry) =>
    hasAnyRecordedMetric(entry)
  ).length;
  const mindfulStreak = computeMindfulStreak(
    entriesByDate,
    completedSessions,
    todayDateKey
  );

  const past7Keys = getPastLocalDateKeys(7, todayDateKey);
  const sevenDayWindow: DaySummaryItem[] = past7Keys.map((date) => {
    const entry = entriesByDate[date];
    const energyRating = entry ? entry.energyRating : null;
    const steps = entry ? entry.steps : null;
    const sleepMinutes = entry ? entry.sleepMinutes : null;
    return {
      date,
      energyRating,
      energyScore: computeSelfReportedEnergyScore(energyRating),
      steps,
      sleepMinutes,
      hasData: hasAnyRecordedMetric(entry),
    };
  });

  const recordedDaysInLast7 = sevenDayWindow.filter((d) => d.hasData).length;

  const recordedSleepValues = sevenDayWindow
    .map((d) => d.sleepMinutes)
    .filter((v): v is number => v !== null);
  const averageSleepMinutes =
    recordedSleepValues.length > 0
      ? Math.round(
          recordedSleepValues.reduce((sum, val) => sum + val, 0) /
            recordedSleepValues.length
        )
      : null;

  const recordedEnergyRatings = sevenDayWindow
    .map((d) => d.energyRating)
    .filter((v): v is number => v !== null);
  const averageEnergyRating =
    recordedEnergyRatings.length > 0
      ? Number(
          (
            recordedEnergyRatings.reduce((sum, val) => sum + val, 0) /
            recordedEnergyRatings.length
          ).toFixed(1)
        )
      : null;
  const averageEnergyScore =
    averageEnergyRating !== null ? Math.round(averageEnergyRating * 10) : null;

  const recordedStepValues = sevenDayWindow
    .map((d) => d.steps)
    .filter((v): v is number => v !== null);
  const averageSteps =
    recordedStepValues.length > 0
      ? Math.round(
          recordedStepValues.reduce((sum, val) => sum + val, 0) /
            recordedStepValues.length
        )
      : null;

  return {
    totalCompletedSessions: completedSessions.length,
    daysWithCheckIn,
    mindfulStreak,
    sevenDayWindow,
    recordedDaysInLast7,
    averageSleep7d: {
      averageMinutes: averageSleepMinutes,
      includedCount: recordedSleepValues.length,
    },
    averageEnergy7d: {
      averageRating: averageEnergyRating,
      averageScore: averageEnergyScore,
      includedCount: recordedEnergyRatings.length,
    },
    averageSteps7d: {
      averageSteps,
      includedCount: recordedStepValues.length,
    },
  };
}
