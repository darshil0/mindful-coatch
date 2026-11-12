import React from 'react';
import { CheckCircle2, Circle, Flame } from 'lucide-react';
import type { MindfulStreakState, NavDestination } from '../../types/wellness';

interface MindfulStreakCardProps {
  streak: MindfulStreakState;
  onNavigate: (destination: NavDestination) => void;
}

function formatDaysLabel(count: number): string {
  return count === 1 ? '1 day' : `${count} days`;
}

export function MindfulStreakCard({ streak, onNavigate }: MindfulStreakCardProps) {
  const statusCopy =
    streak.currentStreak > 0 && streak.activeToday
      ? 'Active today—counted from your daily check-ins and completed sessions.'
      : streak.currentStreak > 0 && !streak.activeToday
        ? 'Ongoing from yesterday. Save a check-in or finish a guided session today to extend it.'
        : streak.totalActiveDays > 0
          ? 'Ready for a fresh start today. Save a check-in or finish a guided session to start a new streak.'
          : 'Save a daily check-in or complete a guided session to begin tracking consecutive mindful days.';

  return (
    <section
      aria-labelledby="mindful-streak-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#5C6762]">
            Daily entries &amp; guided sessions
          </p>
          <h2
            id="mindful-streak-heading"
            className="mt-1 font-display text-xl font-medium text-[#1E2421]"
          >
            Mindful Streaks
          </h2>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            streak.currentStreak > 0
              ? 'border-[#C9DED6] bg-[#EBF2EF] text-[#2F5D50]'
              : 'border-[#E6E4DD] bg-[#FAF9F6] text-[#5C6762]'
          }`}
          aria-hidden="true"
        >
          <Flame className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-b border-[#ECEAE3] pb-4">
        <div className="flex items-baseline gap-2">
          <span
            data-testid="mindful-streak-count"
            className="font-mono text-3xl font-medium text-[#1E2421] tabular-nums"
          >
            {streak.currentStreak}
          </span>
          <span className="text-sm text-[#4A5550]">
            {streak.currentStreak === 1 ? 'consecutive day' : 'consecutive days'}
          </span>
        </div>

        <span
          data-testid="mindful-longest-streak"
          className="font-mono text-xs text-[#5C6762] tabular-nums"
        >
          Best: {formatDaysLabel(streak.longestStreak)}
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#4A5550]">{statusCopy}</p>

      {/* Today's contributors */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-xl bg-[#FAF9F6] px-3.5 py-2.5">
          {streak.todayHasEntry ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2F5D50]" aria-hidden="true" />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-[#8D9691]" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <span className="block text-xs font-medium text-[#1E2421]">
              Daily check-in
            </span>
            <span
              data-testid="streak-today-entry-status"
              className="block text-xs text-[#5C6762]"
            >
              {streak.todayHasEntry ? 'Logged today' : 'Not logged today'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl bg-[#FAF9F6] px-3.5 py-2.5">
          {streak.todayHasSession ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#2F5D50]" aria-hidden="true" />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-[#8D9691]" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <span className="block text-xs font-medium text-[#1E2421]">
              Guided session
            </span>
            <span
              data-testid="streak-today-session-status"
              className="block text-xs text-[#5C6762]"
            >
              {streak.todayHasSession ? 'Completed today' : 'Not completed today'}
            </span>
          </div>
        </div>
      </div>

      {!streak.todayHasSession && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onNavigate('sessions')}
            className="inline-flex min-h-[44px] items-center text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238]"
          >
            Browse guided sessions
          </button>
        </div>
      )}
    </section>
  );
}
