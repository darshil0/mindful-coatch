import type {
  CompletedSessionRecord,
  DailyEntry,
  DaySummaryItem,
  MindfulStreakState,
  ReflectiveNoteEntry,
  WeeklyProgressHighlight,
  WeeklyProgressReport,
  WeeklyScoreInsight,
  WeeklyWellnessScore,
  WeeklyWellnessScoreComponent,
  WellnessGoal,
  WellnessStatistics,
} from '../types/wellness';
import { getGoalMetadata } from '../data/goals';
import {
  formatReadableDate,
  getLocalDateKey,
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
  const hasNote =
    typeof entry.reflectiveNote === 'string' &&
    entry.reflectiveNote.trim().length > 0;
  return (
    entry.energyRating !== null ||
    entry.steps !== null ||
    entry.sleepMinutes !== null ||
    hasNote
  );
}

/**
 * Extracts and sorts all saved reflective notes chronologically by local calendar date (`YYYY-MM-DD`).
 */
export function getChronologicalReflectiveNotes(
  entriesByDate: Record<string, DailyEntry>,
  order: 'asc' | 'desc' = 'desc'
): ReflectiveNoteEntry[] {
  const notes: ReflectiveNoteEntry[] = [];

  for (const [dateKey, entry] of Object.entries(entriesByDate)) {
    if (!entry || !isValidDateKey(dateKey)) {
      continue;
    }
    const rawNote = typeof entry.reflectiveNote === 'string' ? entry.reflectiveNote.trim() : '';
    if (!rawNote) {
      continue;
    }
    notes.push({
      date: dateKey,
      note: rawNote,
      energyScore: computeSelfReportedEnergyScore(entry.energyRating),
      sleepMinutes: entry.sleepMinutes,
      steps: entry.steps,
      updatedAt: entry.updatedAt,
    });
  }

  notes.sort((a, b) =>
    order === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
  );
  return notes;
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

/**
 * Scores a single recorded night of sleep (0..100) relative to a restorative 7–9h window.
 */
export function scoreSleepMinutesForWellness(sleepMinutes: number): number {
  const safe = Math.max(0, Math.min(1440, sleepMinutes));
  if (safe >= 420 && safe <= 540) {
    return 100;
  }
  if (safe < 420) {
    return Math.round((safe / 420) * 100);
  }
  return Math.max(40, Math.round(100 - ((safe - 540) / 360) * 60));
}

/**
 * Scores a single day's recorded step count (0..100) against a balanced 8,000-step benchmark.
 */
export function scoreStepsForWellness(steps: number): number {
  const safe = Math.max(0, steps);
  return Math.min(100, Math.round((safe / 8000) * 100));
}

function getWeeklyScoreTierLabel(score: number | null): string {
  if (score === null) return 'No 7-day data yet';
  if (score >= 80) return 'Thriving rhythm';
  if (score >= 60) return 'Steady balance';
  if (score >= 40) return 'Building momentum';
  return 'Gentle start';
}

/**
 * Computes a transparent 0..100 weekly wellness score from the 7-day window.
 * Only recorded categories contribute (weighted renormalization), and missing data is never treated as 0.
 */
export function computeWeeklyWellnessScore(
  sevenDayWindow: DaySummaryItem[],
  averageEnergyScore: number | null,
  averageEnergyCount: number,
  averageSleepMinutes: number | null,
  averageSleepCount: number,
  averageSteps: number | null,
  averageStepsCount: number
): WeeklyWellnessScore {
  const activeDaysInLast7 = sevenDayWindow.filter(
    (d) => d.hasData || d.completedSessionsCount > 0
  ).length;

  const sleepScores = sevenDayWindow
    .map((d) => d.sleepMinutes)
    .filter((v): v is number => v !== null)
    .map(scoreSleepMinutesForWellness);
  const sleepComponentScore =
    sleepScores.length > 0
      ? Math.round(sleepScores.reduce((sum, s) => sum + s, 0) / sleepScores.length)
      : null;

  const stepScores = sevenDayWindow
    .map((d) => d.steps)
    .filter((v): v is number => v !== null)
    .map(scoreStepsForWellness);
  const stepsComponentScore =
    stepScores.length > 0
      ? Math.round(stepScores.reduce((sum, s) => sum + s, 0) / stepScores.length)
      : null;

  const consistencyScore =
    activeDaysInLast7 > 0 ? Math.round((activeDaysInLast7 / 7) * 100) : null;

  const components: WeeklyWellnessScoreComponent[] = [
    {
      id: 'energy',
      label: 'Energy',
      score: averageEnergyScore,
      weightPercent: 35,
      recordedDays: averageEnergyCount,
      detail:
        averageEnergyScore !== null
          ? `Avg ${averageEnergyScore}/100 (${averageEnergyCount} ${averageEnergyCount === 1 ? 'day' : 'days'})`
          : 'Not recorded',
    },
    {
      id: 'sleep',
      label: 'Sleep',
      score: sleepComponentScore,
      weightPercent: 25,
      recordedDays: averageSleepCount,
      detail:
        averageSleepMinutes !== null
          ? `Avg ${formatSleepMinutes(averageSleepMinutes)} (${averageSleepCount} ${averageSleepCount === 1 ? 'day' : 'days'})`
          : 'Not recorded',
    },
    {
      id: 'consistency',
      label: 'Consistency',
      score: consistencyScore,
      weightPercent: 25,
      recordedDays: activeDaysInLast7,
      detail:
        activeDaysInLast7 > 0
          ? `${activeDaysInLast7} of 7 active ${activeDaysInLast7 === 1 ? 'day' : 'days'}`
          : 'No active days',
    },
    {
      id: 'steps',
      label: 'Movement',
      score: stepsComponentScore,
      weightPercent: 15,
      recordedDays: averageStepsCount,
      detail:
        averageSteps !== null
          ? `Avg ${averageSteps.toLocaleString('en-US')} steps (${averageStepsCount} ${averageStepsCount === 1 ? 'day' : 'days'})`
          : 'Not recorded',
    },
  ];

  const availableComponents = components.filter((c) => c.score !== null);
  const totalWeight = availableComponents.reduce((sum, c) => sum + c.weightPercent, 0);

  const score =
    activeDaysInLast7 > 0 && totalWeight > 0
      ? Math.round(
          availableComponents.reduce(
            (sum, c) => sum + (c.score as number) * c.weightPercent,
            0
          ) / totalWeight
        )
      : null;

  return {
    score,
    activeDaysInLast7,
    recordedCategoriesCount: availableComponents.length,
    tierLabel: getWeeklyScoreTierLabel(score),
    components,
  };
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

  const sessionCountsByDate = new Map<string, number>();
  for (const session of completedSessions) {
    if (!isValidDateKey(session.date)) continue;
    sessionCountsByDate.set(
      session.date,
      (sessionCountsByDate.get(session.date) ?? 0) + 1
    );
  }

  const past7Keys = getPastLocalDateKeys(7, todayDateKey);
  const sevenDayWindow: DaySummaryItem[] = past7Keys.map((date) => {
    const entry = entriesByDate[date];
    const energyRating = entry ? entry.energyRating : null;
    const steps = entry ? entry.steps : null;
    const sleepMinutes = entry ? entry.sleepMinutes : null;
    const completedSessionsCount = sessionCountsByDate.get(date) ?? 0;
    return {
      date,
      energyRating,
      energyScore: computeSelfReportedEnergyScore(energyRating),
      steps,
      sleepMinutes,
      completedSessionsCount,
      hasData: hasAnyRecordedMetric(entry),
    };
  });

  const recordedDaysInLast7 = sevenDayWindow.filter((d) => d.hasData).length;
  const completedSessionsInLast7 = sevenDayWindow.reduce(
    (sum, d) => sum + d.completedSessionsCount,
    0
  );
  const activeDaysInLast7 = sevenDayWindow.filter(
    (d) => d.hasData || d.completedSessionsCount > 0
  ).length;

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
  const exactMeanEnergy =
    recordedEnergyRatings.length > 0
      ? recordedEnergyRatings.reduce((sum, val) => sum + val, 0) /
        recordedEnergyRatings.length
      : null;
  const averageEnergyRating =
    exactMeanEnergy !== null ? Number(exactMeanEnergy.toFixed(1)) : null;
  const averageEnergyScore =
    exactMeanEnergy !== null ? Math.round(exactMeanEnergy * 10) : null;

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

  const weeklyWellnessScore = computeWeeklyWellnessScore(
    sevenDayWindow,
    averageEnergyScore,
    recordedEnergyRatings.length,
    averageSleepMinutes,
    recordedSleepValues.length,
    averageSteps,
    recordedStepValues.length
  );

  return {
    totalCompletedSessions: completedSessions.length,
    daysWithCheckIn,
    mindfulStreak,
    weeklyWellnessScore,
    sevenDayWindow,
    recordedDaysInLast7,
    completedSessionsInLast7,
    activeDaysInLast7,
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

function getGoalNextStepSuggestion(
  goal: WellnessGoal,
  statistics: WellnessStatistics
): string {
  switch (goal) {
    case 'sleep':
      if (statistics.averageSleep7d.includedCount === 0) {
        return 'Try logging sleep hours on 2 or 3 mornings next week to spot how bedtime timing affects your energy.';
      }
      if (
        statistics.averageSleep7d.averageMinutes !== null &&
        statistics.averageSleep7d.averageMinutes < 420
      ) {
        return 'Your recorded sleep averaged under 7 hours—experiment with starting an evening wind-down cue 15 minutes earlier.';
      }
      return 'Keep protecting a consistent evening wind-down cue to support steady restorative sleep.';
    case 'stress':
      if (statistics.completedSessionsInLast7 === 0) {
        return 'Try one 3-to-5 minute Gentle breathing or Mindfulness session between daytime tasks next week.';
      }
      return 'Continue pairing short breathing pauses with daily check-ins to catch tension early.';
    case 'energy':
      if (statistics.averageEnergy7d.includedCount === 0) {
        return 'Record a quick 1–10 energy rating on a few days next week to see which sleep or movement habits lift your focus.';
      }
      return 'Notice which days yielded your steadier energy scores and repeat one simple pacing or daylight habit from them.';
    case 'weight':
      if (statistics.averageSteps7d.includedCount === 0) {
        return 'Add optional step counts on walking days to observe comfortable movement patterns without rigid targets.';
      }
      return 'Build on enjoyable, unhurried movement and regular meal-and-rest check-ins rather than strict daily numbers.';
  }
}

function buildComponentFocusTip(
  component: WeeklyWellnessScoreComponent & { score: number }
): string {
  switch (component.id) {
    case 'energy':
      return component.score < 60
        ? `Your 7-day energy average (${component.score}/100) dipped this week, so try scheduling brief daylight or hydration breaks before afternoon fatigue sets in.`
        : `To support your ${component.score}/100 weekly energy average, pair steady morning routines with a short midday reset when focus fades.`;
    case 'sleep':
      return component.score < 70
        ? `With your weekly sleep score at ${component.score}/100, setting a gentle wind-down cue 15 minutes earlier can ease the transition toward 7–9 hours of rest.`
        : `Your ${component.score}/100 sleep score is close to the 7–9 hour range, and keeping a consistent lights-out cue helps protect that rest.`;
    case 'consistency':
      return component.score < 70
        ? `A ${component.score}/100 consistency score leaves room for gentle cues—try pairing your daily check-in with an existing morning or evening habit.`
        : `Your ${component.score}/100 consistency score shows steady check-ins, and even a brief reflection on busy days keeps your rhythm alive.`;
    case 'steps':
      return component.score < 60
        ? `At ${component.score}/100 for movement this week, a relaxed 10-minute walk after a meal is an approachable way to add comfortable daily steps.`
        : `Your ${component.score}/100 movement average shows solid activity, and short stretch or stroll breaks can keep energy steady between seated blocks.`;
  }
}

function buildComponentStrengthTip(
  component: WeeklyWellnessScoreComponent & { score: number }
): string {
  switch (component.id) {
    case 'energy':
      return `Your energy average (${component.score}/100) was a bright spot this week—notice which daily routines helped you feel most steady and repeat them.`;
    case 'sleep':
      return `Sleep was a steady anchor at ${component.score}/100 this week, giving the rest of your daily habits a reliable foundation.`;
    case 'consistency':
      return `Your ${component.score}/100 consistency score stands out this week—showing up regularly matters more than chasing perfect numbers.`;
    case 'steps':
      return `Movement stood out at ${component.score}/100 this week, offering natural support for your daily mood and evening rest.`;
  }
}

/**
 * Generates compact, collapsible one-sentence wellness insight cards
 * strictly grounded in the user's weekly wellness score and recorded component averages.
 */
export function buildWeeklyScoreInsights(
  weeklyScore: WeeklyWellnessScore,
  primaryGoal: WellnessGoal
): WeeklyScoreInsight[] {
  if (weeklyScore.score === null) {
    return [
      {
        id: 'overall-score',
        title: 'Score readiness',
        metricLabel: 'No 7-day score yet',
        tip: 'Save one daily check-in or finish a brief guided session to unlock personalized weekly score tips.',
      },
    ];
  }

  const score = weeklyScore.score;
  const goalLabel = getGoalMetadata(primaryGoal).label.toLowerCase();

  let overallTip: string;
  if (score >= 80) {
    overallTip = `Your weekly score of ${score}/100 reflects a strong rhythm—keep your ${goalLabel} habits light and repeatable so consistency stays effortless.`;
  } else if (score >= 60) {
    overallTip = `With a steady weekly score of ${score}/100, adding one small ${goalLabel}-focused pause on busy days can gently lift your baseline.`;
  } else if (score >= 40) {
    overallTip = `At ${score}/100 this week, choosing a single repeatable anchor—such as a 3-minute guided session or steady check-in time—helps build calm momentum.`;
  } else {
    overallTip = `Starting from ${score}/100 this week, focus on one low-effort win each day like a quick energy check-in rather than trying to improve everything at once.`;
  }

  const insights: WeeklyScoreInsight[] = [
    {
      id: 'overall-score',
      title: 'Weekly score insight',
      metricLabel: `${score} / 100 · ${weeklyScore.tierLabel}`,
      tip: overallTip,
    },
  ];

  const recordedComponents = weeklyScore.components.filter(
    (c): c is WeeklyWellnessScoreComponent & { score: number } => c.score !== null
  );

  if (recordedComponents.length > 0) {
    const lowest = recordedComponents.reduce((min, cur) =>
      cur.score < min.score ? cur : min
    );
    insights.push({
      id: lowest.id,
      title: `${lowest.label} focus`,
      metricLabel: `${lowest.score} / 100 · ${lowest.detail}`,
      tip: buildComponentFocusTip(lowest),
    });

    const highest = recordedComponents.reduce((max, cur) =>
      cur.score > max.score ? cur : max
    );
    if (highest.id !== lowest.id && highest.score >= 70) {
      insights.push({
        id: highest.id,
        title: `${highest.label} strength`,
        metricLabel: `${highest.score} / 100 · ${highest.detail}`,
        tip: buildComponentStrengthTip(highest),
      });
    }
  }

  return insights;
}

/**
 * Generates a structured 7-day progress report directly from the computed WellnessStatistics engine.
 * Never fabricates missing data or treats unrecorded days as zero.
 */
export function buildWeeklyProgressReport(params: {
  statistics: WellnessStatistics;
  preferredName: string;
  primaryGoal: WellnessGoal;
  entriesByDate?: Record<string, DailyEntry>;
  generatedAt?: string;
}): WeeklyProgressReport {
  const {
    statistics,
    preferredName,
    primaryGoal,
    entriesByDate = {},
    generatedAt = new Date().toISOString(),
  } = params;

  const fallbackEnd = getLocalDateKey();
  const periodStart =
    statistics.sevenDayWindow[0]?.date ?? shiftLocalDateKey(fallbackEnd, -6);
  const periodEnd =
    statistics.sevenDayWindow[statistics.sevenDayWindow.length - 1]?.date ??
    fallbackEnd;

  const reflectiveNotesInLast7 = statistics.sevenDayWindow.filter((day) => {
    const note = entriesByDate[day.date]?.reflectiveNote;
    return typeof note === 'string' && note.trim().length > 0;
  }).length;

  const hasAnyActivity = statistics.activeDaysInLast7 > 0;
  const goalLabel = getGoalMetadata(primaryGoal).label;

  const headline = !hasAnyActivity
    ? 'No activity recorded in this 7-day window yet'
    : statistics.weeklyWellnessScore.score !== null
      ? `${statistics.weeklyWellnessScore.tierLabel} · ${statistics.activeDaysInLast7} of 7 active days`
      : `${statistics.activeDaysInLast7} of 7 active days recorded`;

  const highlights: WeeklyProgressHighlight[] = [];

  const energyDays = statistics.sevenDayWindow.filter(
    (d): d is DaySummaryItem & { energyScore: number } => d.energyScore !== null
  );
  if (energyDays.length > 0) {
    const peakEnergy = energyDays.reduce((best, cur) =>
      cur.energyScore >= best.energyScore ? cur : best
    );
    highlights.push({
      id: 'peak-energy',
      label: 'Peak energy day',
      value: `${peakEnergy.energyScore} / 100`,
      detail: `${formatReadableDate(peakEnergy.date)} (${peakEnergy.energyRating}/10 self-reported)`,
    });
  }

  const sleepDays = statistics.sevenDayWindow.filter(
    (d): d is DaySummaryItem & { sleepMinutes: number } => d.sleepMinutes !== null
  );
  if (sleepDays.length > 0) {
    const bestSleep = sleepDays.reduce((best, cur) => {
      const curScore = scoreSleepMinutesForWellness(cur.sleepMinutes);
      const bestScore = scoreSleepMinutesForWellness(best.sleepMinutes);
      if (curScore > bestScore) return cur;
      if (curScore === bestScore && cur.date > best.date) return cur;
      return best;
    });
    highlights.push({
      id: 'best-sleep',
      label: 'Most restorative sleep',
      value: formatSleepMinutes(bestSleep.sleepMinutes),
      detail: formatReadableDate(bestSleep.date),
    });
  }

  const stepDays = statistics.sevenDayWindow.filter(
    (d): d is DaySummaryItem & { steps: number } => d.steps !== null
  );
  if (stepDays.length > 0) {
    const topSteps = stepDays.reduce((best, cur) =>
      cur.steps >= best.steps ? cur : best
    );
    highlights.push({
      id: 'top-steps',
      label: 'Highest movement day',
      value: formatStepsCount(topSteps.steps),
      detail: formatReadableDate(topSteps.date),
    });
  }

  if (statistics.completedSessionsInLast7 > 0) {
    highlights.push({
      id: 'sessions',
      label: 'Guided sessions',
      value: `${statistics.completedSessionsInLast7} completed`,
      detail: `${statistics.totalCompletedSessions} total completed overall`,
    });
  }

  if (reflectiveNotesInLast7 > 0) {
    highlights.push({
      id: 'reflections',
      label: 'Journal reflections',
      value: `${reflectiveNotesInLast7} ${reflectiveNotesInLast7 === 1 ? 'note' : 'notes'}`,
      detail: 'Recorded in this 7-day window',
    });
  }

  // Build narrative summary strictly from recorded statistics
  let narrativeSummary: string;
  if (!hasAnyActivity) {
    narrativeSummary = `Between ${formatReadableDate(periodStart)} and ${formatReadableDate(periodEnd)}, no daily check-ins or guided sessions were logged yet. Missing days are never estimated or penalized—save a check-in or complete a short guided session whenever you feel ready to populate your weekly summary.`;
  } else {
    const parts: string[] = [];
    parts.push(
      `Across ${formatReadableDate(periodStart)}–${formatReadableDate(periodEnd)}, you stayed active on ${statistics.activeDaysInLast7} of 7 days (${statistics.recordedDaysInLast7} ${statistics.recordedDaysInLast7 === 1 ? 'check-in' : 'check-ins'} and ${statistics.completedSessionsInLast7} guided ${statistics.completedSessionsInLast7 === 1 ? 'session' : 'sessions'}).`
    );

    if (statistics.weeklyWellnessScore.score !== null) {
      parts.push(
        `Your weekly wellness score is ${statistics.weeklyWellnessScore.score}/100 (${statistics.weeklyWellnessScore.tierLabel}), based on ${statistics.weeklyWellnessScore.recordedCategoriesCount} recorded input ${statistics.weeklyWellnessScore.recordedCategoriesCount === 1 ? 'category' : 'categories'}.`
      );
    }

    const metricSegments: string[] = [];
    if (statistics.averageEnergy7d.averageScore !== null) {
      metricSegments.push(
        `energy averaged ${statistics.averageEnergy7d.averageScore}/100 across ${statistics.averageEnergy7d.includedCount} ${statistics.averageEnergy7d.includedCount === 1 ? 'day' : 'days'}`
      );
    }
    if (statistics.averageSleep7d.averageMinutes !== null) {
      metricSegments.push(
        `sleep averaged ${formatSleepMinutes(statistics.averageSleep7d.averageMinutes)} over ${statistics.averageSleep7d.includedCount} ${statistics.averageSleep7d.includedCount === 1 ? 'night' : 'nights'}`
      );
    }
    if (statistics.averageSteps7d.averageSteps !== null) {
      metricSegments.push(
        `movement averaged ${statistics.averageSteps7d.averageSteps.toLocaleString('en-US')} steps across ${statistics.averageSteps7d.includedCount} ${statistics.averageSteps7d.includedCount === 1 ? 'day' : 'days'}`
      );
    }

    if (metricSegments.length > 0) {
      parts.push(`From your recorded entries, ${metricSegments.join('; ')}.`);
    }

    if (statistics.mindfulStreak.currentStreak > 0) {
      parts.push(
        `You currently hold a ${statistics.mindfulStreak.currentStreak}-day Mindful Streak (personal best: ${statistics.mindfulStreak.longestStreak} ${statistics.mindfulStreak.longestStreak === 1 ? 'day' : 'days'}).`
      );
    }

    narrativeSummary = parts.join(' ');
  }

  const nextWeekFocus: string[] = [];
  nextWeekFocus.push(getGoalNextStepSuggestion(primaryGoal, statistics));

  if (!hasAnyActivity) {
    nextWeekFocus.push(
      'Start small with one 1–10 energy rating or one 3-minute guided session today.'
    );
  } else {
    const missingCategories: string[] = [];
    if (statistics.averageEnergy7d.includedCount === 0) missingCategories.push('energy');
    if (statistics.averageSleep7d.includedCount === 0) missingCategories.push('sleep');
    if (statistics.averageSteps7d.includedCount === 0) missingCategories.push('steps');

    if (missingCategories.length > 0) {
      nextWeekFocus.push(
        `Optional: try logging ${missingCategories.join(' or ')} once or twice next week if helpful—unrecorded fields always stay neutral.`
      );
    } else if (statistics.activeDaysInLast7 < 5) {
      nextWeekFocus.push(
        `Aim for ${Math.min(7, statistics.activeDaysInLast7 + 1)}–${Math.min(7, statistics.activeDaysInLast7 + 2)} active check-in or session days next week using your morning or evening reminders.`
      );
    } else {
      nextWeekFocus.push(
        'Your 7-day consistency is strong—keep routines light and flexible so they stay effortless.'
      );
    }

    if (reflectiveNotesInLast7 === 0) {
      nextWeekFocus.push(
        'Add a brief one-sentence reflective note on a check-in day to capture what helped most.'
      );
    }
  }

  const plainLines: string[] = [
    `MINDFUL COACH — WEEKLY PROGRESS REPORT`,
    `Period: ${formatReadableDate(periodStart)} – ${formatReadableDate(periodEnd)} (${periodStart} to ${periodEnd})`,
    `Prepared for: ${preferredName} | Primary focus: ${goalLabel}`,
    `Status: ${headline}`,
    ``,
    `SUMMARY`,
    narrativeSummary,
    ``,
    `7-DAY METRICS`,
    `- Weekly wellness score: ${
      statistics.weeklyWellnessScore.score !== null
        ? `${statistics.weeklyWellnessScore.score}/100 (${statistics.weeklyWellnessScore.tierLabel})`
        : 'Not enough recorded data yet'
    }`,
    `- Active days: ${statistics.activeDaysInLast7} of 7 (${statistics.recordedDaysInLast7} check-in ${statistics.recordedDaysInLast7 === 1 ? 'day' : 'days'}, ${statistics.completedSessionsInLast7} guided ${statistics.completedSessionsInLast7 === 1 ? 'session' : 'sessions'})`,
    `- Mindful streak: ${statistics.mindfulStreak.currentStreak} consecutive ${statistics.mindfulStreak.currentStreak === 1 ? 'day' : 'days'} (Best: ${statistics.mindfulStreak.longestStreak} ${statistics.mindfulStreak.longestStreak === 1 ? 'day' : 'days'})`,
    `- Average energy: ${
      statistics.averageEnergy7d.averageScore !== null
        ? `${statistics.averageEnergy7d.averageScore}/100 (Avg ${statistics.averageEnergy7d.averageRating}/10 across ${statistics.averageEnergy7d.includedCount} ${statistics.averageEnergy7d.includedCount === 1 ? 'day' : 'days'})`
        : 'Not recorded'
    }`,
    `- Average sleep: ${
      statistics.averageSleep7d.averageMinutes !== null
        ? `${formatSleepMinutes(statistics.averageSleep7d.averageMinutes)} (across ${statistics.averageSleep7d.includedCount} ${statistics.averageSleep7d.includedCount === 1 ? 'night' : 'nights'})`
        : 'Not recorded'
    }`,
    `- Average movement: ${
      statistics.averageSteps7d.averageSteps !== null
        ? `${statistics.averageSteps7d.averageSteps.toLocaleString('en-US')} steps (across ${statistics.averageSteps7d.includedCount} ${statistics.averageSteps7d.includedCount === 1 ? 'day' : 'days'})`
        : 'Not recorded'
    }`,
  ];

  if (highlights.length > 0) {
    plainLines.push(``, `HIGHLIGHTS`);
    for (const item of highlights) {
      plainLines.push(`- ${item.label}: ${item.value} (${item.detail})`);
    }
  }

  plainLines.push(``, `NEXT WEEK FOCUS`);
  for (const tip of nextWeekFocus) {
    plainLines.push(`- ${tip}`);
  }

  const scoreInsights = buildWeeklyScoreInsights(
    statistics.weeklyWellnessScore,
    primaryGoal
  );

  return {
    periodStart,
    periodEnd,
    generatedAt,
    preferredName,
    primaryGoal,
    hasAnyActivity,
    headline,
    narrativeSummary,
    activeDaysInLast7: statistics.activeDaysInLast7,
    recordedDaysInLast7: statistics.recordedDaysInLast7,
    completedSessionsInLast7: statistics.completedSessionsInLast7,
    reflectiveNotesInLast7,
    weeklyScore: statistics.weeklyWellnessScore,
    streak: statistics.mindfulStreak,
    averages: {
      energyRating: statistics.averageEnergy7d.averageRating,
      energyScore: statistics.averageEnergy7d.averageScore,
      energyDays: statistics.averageEnergy7d.includedCount,
      sleepMinutes: statistics.averageSleep7d.averageMinutes,
      sleepDays: statistics.averageSleep7d.includedCount,
      steps: statistics.averageSteps7d.averageSteps,
      stepsDays: statistics.averageSteps7d.includedCount,
    },
    highlights,
    scoreInsights,
    nextWeekFocus,
    plainTextReport: plainLines.join('\n'),
  };
}

