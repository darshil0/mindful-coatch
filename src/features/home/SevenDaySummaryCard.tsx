import React, { useState } from 'react';
import type { WellnessStatistics } from '../../types/wellness';
import {
  formatDayNumber,
  formatReadableDate,
  formatShortDayLabel,
} from '../../lib/dateUtils';
import { formatSleepMinutes } from '../../lib/wellnessMetrics';

interface SevenDaySummaryCardProps {
  statistics: WellnessStatistics;
}

export function SevenDaySummaryCard({ statistics }: SevenDaySummaryCardProps) {
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
            Seven-day summary
          </h2>
        </div>

        {statistics.recordedDaysInLast7 > 0 && (
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

      {statistics.recordedDaysInLast7 === 0 ? (
        <div className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm leading-relaxed text-[#4A5550]">
          No entries recorded in the past 7 local days yet. Save today’s energy, sleep,
          or steps to see your actual recorded history here. Missing days are always left
          blank rather than treated as zero.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-[#5C6762]">
            Showing {statistics.recordedDaysInLast7} recorded{' '}
            {statistics.recordedDaysInLast7 === 1 ? 'day' : 'days'} out of the past 7 days
            · Unrecorded days are marked “—”.
          </p>

          {summaryViewMode === 'visual' && (
            <div aria-hidden="true" className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-[#4A5550] mb-2">
                  <span>Self-reported energy (out of 100)</span>
                  {statistics.averageEnergy7d.averageScore !== null && (
                    <span className="font-mono tabular-nums">
                      Avg {statistics.averageEnergy7d.averageScore} (n=
                      {statistics.averageEnergy7d.includedCount})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1.5 items-end h-28 pt-2">
                  {statistics.sevenDayWindow.map((day) => {
                    const heightPct =
                      day.energyScore !== null ? Math.max(12, day.energyScore) : 0;
                    return (
                      <div
                        key={day.date}
                        className="flex flex-col items-center h-full justify-end gap-1"
                      >
                        <span className="font-mono text-[10px] text-[#5C6762] tabular-nums">
                          {day.energyScore !== null ? day.energyScore : '—'}
                        </span>
                        <div className="w-full flex-1 flex items-end rounded-md bg-[#F2F0EA] p-0.5">
                          {day.energyScore !== null ? (
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full rounded-xs bg-[#2F5D50]"
                            />
                          ) : (
                            <div className="w-full h-full rounded-xs border border-dashed border-[#D5D3CA]" />
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-[#4A5550]">
                          {formatShortDayLabel(day.date).slice(0, 2)}{' '}
                          {formatDayNumber(day.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Accessible Text Table (always present in DOM for screen readers; visible when 'table' selected) */}
          <div className={summaryViewMode === 'table' ? 'overflow-x-auto' : 'sr-only'}>
            <table className="w-full text-left text-xs border-collapse">
              <caption className="sr-only">
                Recorded daily check-ins over the past seven local calendar days
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
