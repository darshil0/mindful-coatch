import React from 'react';
import type { WellnessStatistics } from '../../types/wellness';
import { formatSleepMinutes } from '../../lib/wellnessMetrics';

interface RecordedStatsCardProps {
  statistics: WellnessStatistics;
}

export function RecordedStatsCard({ statistics }: RecordedStatsCardProps) {
  return (
    <section
      aria-labelledby="recorded-stats-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2
          id="recorded-stats-heading"
          className="font-display text-xl font-medium text-[#1E2421]"
        >
          Your recorded summary
        </h2>
        <span className="text-xs text-[#5C6762]">
          Calculated only from entries you have saved
        </span>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-t border-[#ECEAE3] pt-4 sm:border-t-0 sm:pt-0">
          <span className="block text-xs font-medium text-[#5C6762]">
            Total completed sessions
          </span>
          <span
            data-testid="stat-completed-sessions"
            className="mt-1 block font-mono text-2xl font-medium text-[#1E2421] tabular-nums"
          >
            {statistics.totalCompletedSessions}
          </span>
          <span className="mt-1 block text-xs text-[#4A5550]">
            {statistics.totalCompletedSessions === 0
              ? 'No sessions completed yet'
              : 'Completed guided practices'}
          </span>
        </div>

        <div className="border-t border-[#ECEAE3] pt-4 sm:border-t-0 sm:pt-0">
          <span className="block text-xs font-medium text-[#5C6762]">
            Days with a check-in
          </span>
          <span
            data-testid="stat-checkin-days"
            className="mt-1 block font-mono text-2xl font-medium text-[#1E2421] tabular-nums"
          >
            {statistics.daysWithCheckIn}
          </span>
          <span className="mt-1 block text-xs text-[#4A5550]">
            {statistics.daysWithCheckIn === 0
              ? 'No daily check-ins saved yet'
              : 'Total local calendar days logged'}
          </span>
        </div>

        <div className="border-t border-[#ECEAE3] pt-4 lg:border-t-0 lg:pt-0">
          <span className="block text-xs font-medium text-[#5C6762]">
            Average sleep (past 7 days)
          </span>
          {statistics.averageSleep7d.averageMinutes !== null ? (
            <>
              <span
                data-testid="stat-avg-sleep"
                className="mt-1 block font-mono text-2xl font-medium text-[#1E2421] tabular-nums"
              >
                {formatSleepMinutes(statistics.averageSleep7d.averageMinutes)}
              </span>
              <span className="mt-1 block text-xs text-[#4A5550]">
                Based on {statistics.averageSleep7d.includedCount} recorded{' '}
                {statistics.averageSleep7d.includedCount === 1 ? 'entry' : 'entries'}
              </span>
            </>
          ) : (
            <>
              <span
                data-testid="stat-avg-sleep"
                className="mt-1 block font-display text-lg font-medium text-[#4A5550]"
              >
                No entries yet
              </span>
              <span className="mt-1 block text-xs text-[#5C6762]">
                0 sleep entries in the past 7 days
              </span>
            </>
          )}
        </div>

        <div className="border-t border-[#ECEAE3] pt-4 lg:border-t-0 lg:pt-0">
          <span className="block text-xs font-medium text-[#5C6762]">
            Average energy (past 7 days)
          </span>
          {statistics.averageEnergy7d.averageScore !== null ? (
            <>
              <span
                data-testid="stat-avg-energy"
                className="mt-1 block font-mono text-2xl font-medium text-[#1E2421] tabular-nums"
              >
                {statistics.averageEnergy7d.averageScore} / 100
              </span>
              <span className="mt-1 block text-xs text-[#4A5550]">
                Self-reported · Based on {statistics.averageEnergy7d.includedCount}{' '}
                recorded{' '}
                {statistics.averageEnergy7d.includedCount === 1 ? 'entry' : 'entries'}
              </span>
            </>
          ) : (
            <>
              <span
                data-testid="stat-avg-energy"
                className="mt-1 block font-display text-lg font-medium text-[#4A5550]"
              >
                No entries yet
              </span>
              <span className="mt-1 block text-xs text-[#5C6762]">
                0 energy ratings in the past 7 days
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
