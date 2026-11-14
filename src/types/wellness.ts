export type WellnessGoal = 'sleep' | 'stress' | 'energy' | 'weight';

export type NavDestination = 'home' | 'sessions' | 'coach' | 'profile';

export type ReduceMotionSetting = 'system' | 'on' | 'off';

export interface GoalMetadata {
  id: WellnessGoal;
  label: string;
  tagline: string;
  dashboardNote: string;
  recommendedSessionId: string;
  starterQuestions: string[];
}

export interface UserProfile {
  preferredName: string;
  primaryGoal: WellnessGoal;
  createdAt: string;
  updatedAt: string;
}

/**
 * Daily wellness tracking entry keyed by local calendar date (YYYY-MM-DD).
 * `null` indicates a metric has not been recorded for that day.
 * `0` (for steps or sleepMinutes) indicates an explicitly recorded zero value.
 */
export interface DailyEntry {
  date: string;
  energyRating: number | null; // 1..10 when recorded, null when missing
  steps: number | null; // nonnegative integer >= 0 when recorded, null when missing
  sleepMinutes: number | null; // 0..1440 when recorded, null when missing
  reflectiveNote?: string | null; // optional brief daily reflection (up to 500 chars)
  updatedAt: string;
}

export interface ReflectiveNoteEntry {
  date: string;
  note: string;
  energyScore: number | null;
  sleepMinutes: number | null;
  steps: number | null;
  updatedAt: string;
}

export interface DaySummaryItem {
  date: string;
  energyRating: number | null;
  energyScore: number | null;
  steps: number | null;
  sleepMinutes: number | null;
  completedSessionsCount: number;
  hasData: boolean;
}

export interface MindfulStreakState {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  todayHasEntry: boolean;
  todayHasSession: boolean;
  totalActiveDays: number;
  lastActiveDate: string | null;
  updatedAt: string;
}

export interface WeeklyWellnessScoreComponent {
  id: 'energy' | 'sleep' | 'steps' | 'consistency';
  label: string;
  score: number | null;
  weightPercent: number;
  recordedDays: number;
  detail: string;
}

export interface WeeklyWellnessScore {
  score: number | null;
  activeDaysInLast7: number;
  recordedCategoriesCount: number;
  tierLabel: string;
  components: WeeklyWellnessScoreComponent[];
}

export interface WellnessStatistics {
  totalCompletedSessions: number;
  daysWithCheckIn: number;
  mindfulStreak: MindfulStreakState;
  weeklyWellnessScore: WeeklyWellnessScore;
  sevenDayWindow: DaySummaryItem[];
  recordedDaysInLast7: number;
  completedSessionsInLast7: number;
  activeDaysInLast7: number;
  averageSleep7d: {
    averageMinutes: number | null;
    includedCount: number;
  };
  averageEnergy7d: {
    averageRating: number | null;
    averageScore: number | null;
    includedCount: number;
  };
  averageSteps7d: {
    averageSteps: number | null;
    includedCount: number;
  };
}

export interface WeeklyScoreInsight {
  id: 'overall-score' | 'energy' | 'sleep' | 'consistency' | 'steps';
  title: string;
  metricLabel: string;
  tip: string;
}

export interface WeeklyProgressHighlight {
  id: 'peak-energy' | 'best-sleep' | 'top-steps' | 'sessions' | 'reflections';
  label: string;
  value: string;
  detail: string;
}

export interface WeeklyProgressReport {
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  preferredName: string;
  primaryGoal: WellnessGoal;
  hasAnyActivity: boolean;
  headline: string;
  narrativeSummary: string;
  activeDaysInLast7: number;
  recordedDaysInLast7: number;
  completedSessionsInLast7: number;
  reflectiveNotesInLast7: number;
  weeklyScore: WeeklyWellnessScore;
  streak: MindfulStreakState;
  averages: {
    energyRating: number | null;
    energyScore: number | null;
    energyDays: number;
    sleepMinutes: number | null;
    sleepDays: number;
    steps: number | null;
    stepsDays: number;
  };
  highlights: WeeklyProgressHighlight[];
  scoreInsights: WeeklyScoreInsight[];
  nextWeekFocus: string[];
  plainTextReport: string;
}

export interface CompletedSessionRecord {
  completionId: string;
  runId: string;
  sessionId: string;
  title: string;
  durationSeconds: number;
  completedAt: string;
  date: string; // local calendar date YYYY-MM-DD
}

export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'ended_early';

export interface SessionTimerState {
  runId: string;
  sessionId: string;
  durationMs: number;
  status: SessionStatus;
  accumulatedElapsedMs: number;
  lastResumedAtMs: number | null;
  completedAtIso: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  mode: 'live' | 'demo';
  isCrisisNotice?: boolean;
  isFallbackFromError?: boolean;
}

export interface UserPreferences {
  saveChatHistory: boolean;
  reduceMotion: ReduceMotionSetting;
  acknowledgedAiNotice: boolean;
}

export type ReminderSlotId = 'morning' | 'evening';

export interface ReminderSlotConfig {
  enabled: boolean;
  time: string;
}

export interface ReminderSchedule {
  morning: ReminderSlotConfig;
  evening: ReminderSlotConfig;
  browserNotifications: boolean;
}

export type ReminderDismissalsByDate = Record<
  string,
  Partial<Record<ReminderSlotId, boolean>>
>;

export interface GuidedSessionStep {
  title: string;
  instruction: string;
  breathCue?: string;
}

export interface GuidedSessionDefinition {
  id: string;
  title: string;
  shortDescription: string;
  defaultDurationSeconds: number;
  durationOptionsSeconds: number[];
  recommendedForGoals: WellnessGoal[];
  safetyNote: string;
  hasOptionalBreathingPacer: boolean;
  steps: GuidedSessionStep[];
}
