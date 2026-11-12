import React from 'react';
import type {
  DailyEntry,
  MindfulStreakState,
  NavDestination,
  ReminderSchedule,
  ReminderSlotId,
  UserProfile,
  WellnessStatistics,
} from '../../types/wellness';
import type { EvaluatedReminderState } from '../../lib/reminders';
import { formatReadableDate, getTimeOfDayGreeting } from '../../lib/dateUtils';
import { getGoalMetadata } from '../../data/goals';
import { getSessionById } from '../../data/guidedSessions';
import { DailyCheckInCard } from './DailyCheckInCard';
import { HomeQuickActions } from './HomeQuickActions';
import { MindfulStreakCard } from './MindfulStreakCard';
import { ReflectiveNotesCard } from './ReflectiveNotesCard';
import { ReminderBannerCard } from './ReminderBannerCard';
import { SevenDaySummaryCard } from './SevenDaySummaryCard';

interface HomeViewProps {
  profile: UserProfile;
  todayDateKey: string;
  todayEntry: DailyEntry | undefined;
  entriesByDate: Record<string, DailyEntry>;
  mindfulStreak: MindfulStreakState;
  statistics: WellnessStatistics;
  reminderSchedule: ReminderSchedule;
  evaluatedReminder: EvaluatedReminderState;
  effectiveReducedMotion: boolean;
  focusCheckInSignal: number;
  onFocusCheckIn: () => void;
  onSaveDailyEntry: (entry: DailyEntry) => void;
  onDismissReminderForToday: (slot: ReminderSlotId) => void;
  onSaveReminderSchedule: (next: ReminderSchedule) => void;
  onNavigate: (destination: NavDestination) => void;
  onOpenSession: (sessionId: string) => void;
  onAskCoachQuestion: (question: string) => void;
}

export function HomeView({
  profile,
  todayDateKey,
  todayEntry,
  entriesByDate,
  mindfulStreak,
  statistics,
  reminderSchedule,
  evaluatedReminder,
  effectiveReducedMotion,
  focusCheckInSignal,
  onFocusCheckIn,
  onSaveDailyEntry,
  onDismissReminderForToday,
  onSaveReminderSchedule,
  onNavigate,
  onOpenSession,
  onAskCoachQuestion,
}: HomeViewProps) {
  const goalMeta = getGoalMetadata(profile.primaryGoal);
  const recommendedSession = getSessionById(goalMeta.recommendedSessionId);

  return (
    <div className="space-y-8">
      {/* Greeting & Primary Goal Header */}
      <section
        aria-labelledby="home-greeting-heading"
        className="grid gap-6 lg:grid-cols-12 lg:items-stretch"
      >
        <div className="lg:col-span-7 flex flex-col justify-center">
          <p className="text-xs font-medium text-[#5C6762]">
            {formatReadableDate(todayDateKey)} · Local calendar day
          </p>
          <h1
            id="home-greeting-heading"
            className="mt-1 font-display text-3xl sm:text-4xl font-medium tracking-tight text-[#1E2421]"
          >
            {getTimeOfDayGreeting()}, {profile.preferredName}
          </h1>
          <p className="mt-2 max-w-xl text-base text-[#4A5550]">
            {goalMeta.dashboardNote}
          </p>
        </div>

        {/* Small Primary Goal Card */}
        <div className="lg:col-span-5 rounded-2xl border border-[#E6E4DD] bg-white p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-[#5C6762]">
                Primary focus
              </span>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="min-h-[44px] px-2 -mr-2 text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] whitespace-nowrap"
              >
                Change focus
              </button>
            </div>
            <h2 className="font-display text-xl font-medium text-[#1E2421]">
              {goalMeta.label}
            </h2>
            <p className="mt-1 text-sm text-[#4A5550]">{goalMeta.tagline}</p>
          </div>
        </div>
      </section>

      {/* Gentle Morning Check-In & Evening Reflection Reminder Banner */}
      <ReminderBannerCard
        evaluatedReminder={evaluatedReminder}
        schedule={reminderSchedule}
        onMorningCheckInAction={onFocusCheckIn}
        onEveningSessionAction={() => onOpenSession('sleep-wind-down')}
        onEveningCoachAction={() =>
          onAskCoachQuestion('Help me reflect briefly on my day and wind down tonight.')
        }
        onDismissForToday={onDismissReminderForToday}
        onSaveSchedule={onSaveReminderSchedule}
      />

      {/* Main Workspace Grid */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="space-y-8 lg:col-span-7">
          <DailyCheckInCard
            todayDateKey={todayDateKey}
            todayEntry={todayEntry}
            focusCheckInSignal={focusCheckInSignal}
            onSaveDailyEntry={onSaveDailyEntry}
          />
          <ReflectiveNotesCard
            entriesByDate={entriesByDate}
            todayDateKey={todayDateKey}
            onFocusCheckIn={onFocusCheckIn}
          />
        </div>

        <div className="space-y-6 lg:col-span-5">
          <MindfulStreakCard streak={mindfulStreak} onNavigate={onNavigate} />
          <HomeQuickActions
            goalMeta={goalMeta}
            recommendedSession={recommendedSession}
            onOpenSession={onOpenSession}
            onAskCoachQuestion={onAskCoachQuestion}
            onNavigate={onNavigate}
          />
          <SevenDaySummaryCard
            statistics={statistics}
            effectiveReducedMotion={effectiveReducedMotion}
          />
        </div>
      </div>
    </div>
  );
}
