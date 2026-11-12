import React, { useState } from 'react';
import type { WellnessStatistics } from '../../types/wellness';
import { formatReadableDate } from '../../lib/dateUtils';
import { formatSleepMinutes } from '../../lib/wellnessMetrics';
import { WeeklyTrendChart } from './WeeklyTrendChart';

interface SevenDaySummaryCardProps {
  statistics: WellnessStatistics;
  effectiveReducedMotion: boolean;
}

export function SevenDaySummaryCard({
  statistics,
  effectiveReducedMotion,
}: SevenDaySummaryCardProps) {
  const [summaryViewMode, setSummaryViewMode] = useState<'visual' | 'table'>('visual');

  return (
    <section
      aria-labelledby="seven-day-summary-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5C6762]">
            Past 7 local calendar days
          </p>
          <h2
            id="seven-day-summary-heading"
            className="mt-1 font-display text-xl font-medium text-[#1E2421]"
          >
            Weekly trend &amp; summary
          </h2>
        </div>

        {statistics.activeDaysInLast7 > 0 && (
          <div
            role="group"
            aria-label="Summary display format"
            className="flex items-center gap-1 rounded-lg bg-[#F2F0EA] p-1"
          >
            <button
              type="button"
              onClick={() => setSummaryViewMode('visual')}
              aria-pressed={summaryViewMode === 'visual'}
              className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                summaryViewMode === 'visual'
                  ? 'bg-white text-[#1E2421] shadow-2xs'
                  : 'text-[#4A5550] hover:text-[#1E2421]'
              }`}
            >
              Chart
            </button>
            <button
              type="button"
              onClick={() => setSummaryViewMode('table')}
              aria-pressed={summaryViewMode === 'table'}
              className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                summaryViewMode === 'table'
                  ? 'bg-white text-[#1E2421] shadow-2xs'
                  : 'text-[#4A5550] hover:text-[#1E2421]'
              }`}
            >
              Text table
            </button>
          </div>
        )}
      </div>

      {statistics.activeDaysInLast7 === 0 ? (
        <div className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm leading-relaxed text-[#4A5550]">
          No check-ins or completed sessions recorded in the past 7 local days yet. Save
          today’s energy or complete a guided mindfulness session to view your weekly
          trend here. Unrecorded energy days are always left blank rather than treated as
          zero.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-[#5C6762]">
            Showing {statistics.activeDaysInLast7} active{' '}
            {statistics.activeDaysInLast7 === 1 ? 'day' : 'days'} across the past 7 days
            · Gaps in energy indicate unrecorded days.
          </p>

          {summaryViewMode === 'visual' && (
            <WeeklyTrendChart
              sevenDayWindow={statistics.sevenDayWindow}
              averageEnergyScore={statistics.averageEnergy7d.averageScore}
              energyCount={statistics.averageEnergy7d.includedCount}
              completedSessionsInLast7={statistics.completedSessionsInLast7}
              effectiveReducedMotion={effectiveReducedMotion}
            />
          )}

          {/* Accessible Text Table (always present in DOM for screen readers; visible when 'table' selected) */}
          <div className={summaryViewMode === 'table' ? 'overflow-x-auto' : 'sr-only'}>
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Recorded daily energy, completed mindfulness sessions, sleep, and steps
                over the past seven local calendar days
              </caption>
              <thead>
                <tr className="border-b border-[#E6E4DD] text-[#5C6762]">
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-2 px-2 font-medium">
                    Energy
                  </th>
                  <th scope="col" className="py-2 px-2 font-medium">
                    Sessions
                  </th>
                  <th scope="col" className="py-2 px-2 font-medium">
                    Sleep
                  </th>
                  <th scope="col" className="py-2 pl-2 font-medium text-right">
                    Steps
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECEAE3]">
                {statistics.sevenDayWindow.map((day) => (
                  <tr key={day.date}>
                    <th
                      scope="row"
                      className="py-2 pr-2 font-normal text-[#1E2421] whitespace-nowrap"
                    >
                      {formatReadableDate(day.date)}
                    </th>
                    <td className="py-2 px-2 font-mono text-[#1E2421] tabular-nums whitespace-nowrap">
                      {day.energyScore !== null
                        ? `${day.energyScore}/100`
                        : 'Not recorded'}
                    </td>
                    <td className="py-2 px-2 font-mono text-[#1E2421] tabular-nums whitespace-nowrap">
                      {day.completedSessionsCount}
                    </td>
                    <td className="py-2 px-2 font-mono text-[#1E2421] tabular-nums whitespace-nowrap">
                      {formatSleepMinutes(day.sleepMinutes)}
                    </td>
                    <td className="py-2 pl-2 font-mono text-[#1E2421] tabular-nums text-right whitespace-nowrap">
                      {day.steps !== null
                        ? day.steps.toLocaleString('en-US')
                        : 'Not recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
