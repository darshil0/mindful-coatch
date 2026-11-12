import React, { useMemo, useState } from 'react';
import type { DailyEntry } from '../../types/wellness';
import { formatReadableDate } from '../../lib/dateUtils';
import {
  formatSleepMinutes,
  getChronologicalReflectiveNotes,
} from '../../lib/wellnessMetrics';

interface ReflectiveNotesCardProps {
  entriesByDate: Record<string, DailyEntry>;
  todayDateKey: string;
  onFocusCheckIn: () => void;
}

const DEFAULT_VISIBLE_COUNT = 5;

export function ReflectiveNotesCard({
  entriesByDate,
  todayDateKey,
  onFocusCheckIn,
}: ReflectiveNotesCardProps) {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showAllNotes, setShowAllNotes] = useState(false);

  const notes = useMemo(
    () => getChronologicalReflectiveNotes(entriesByDate, sortOrder),
    [entriesByDate, sortOrder]
  );

  const visibleNotes = showAllNotes
    ? notes
    : notes.slice(0, DEFAULT_VISIBLE_COUNT);
  const hasMoreNotes = notes.length > DEFAULT_VISIBLE_COUNT;

  return (
    <section
      aria-labelledby="reflective-notes-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5C6762]">
            Daily journal · Stored locally
          </p>
          <h2
            id="reflective-notes-heading"
            className="mt-1 font-display text-xl font-medium text-[#1E2421]"
          >
            Reflective notes
          </h2>
        </div>

        {notes.length > 1 && (
          <div
            role="group"
            aria-label="Reflective notes chronological order"
            className="flex items-center gap-1 rounded-lg bg-[#F2F0EA] p-1"
          >
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              aria-pressed={sortOrder === 'desc'}
              className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                sortOrder === 'desc'
                  ? 'bg-white text-[#1E2421] shadow-2xs'
                  : 'text-[#4A5550] hover:text-[#1E2421]'
              }`}
            >
              Newest first
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              aria-pressed={sortOrder === 'asc'}
              className={`min-h-[36px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                sortOrder === 'asc'
                  ? 'bg-white text-[#1E2421] shadow-2xs'
                  : 'text-[#4A5550] hover:text-[#1E2421]'
              }`}
            >
              Oldest first
            </button>
          </div>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm leading-relaxed text-[#4A5550]">
          <p>
            No reflective notes recorded yet. Add a short reflective note in today’s
            check-in above to build a chronological journal of your days.
          </p>
          <button
            type="button"
            onClick={onFocusCheckIn}
            className="mt-2 inline-flex min-h-[44px] items-center text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238]"
          >
            Write today’s reflective note
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-xs text-[#5C6762]">
            {notes.length} {notes.length === 1 ? 'reflection' : 'reflections'} ·{' '}
            {sortOrder === 'desc'
              ? 'Ordered newest to oldest'
              : 'Ordered oldest to newest'}
          </p>

          <ol className="mt-3 divide-y divide-[#ECEAE3]">
            {visibleNotes.map((item) => {
              const isToday = item.date === todayDateKey;
              const contextParts: string[] = [];
              if (item.energyScore !== null) {
                contextParts.push(`Energy ${item.energyScore}/100`);
              }
              if (item.sleepMinutes !== null) {
                contextParts.push(`Sleep ${formatSleepMinutes(item.sleepMinutes)}`);
              }
              if (item.steps !== null) {
                contextParts.push(`${item.steps.toLocaleString('en-US')} steps`);
              }

              return (
                <li key={item.date} className="py-4 first:pt-2 last:pb-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex flex-wrap items-baseline gap-2 text-xs">
                      <time
                        dateTime={item.date}
                        className="font-medium text-[#1E2421]"
                      >
                        {formatReadableDate(item.date)}
                      </time>
                      {isToday && (
                        <>
                          <span aria-hidden="true" className="text-[#9BA39E]">
                            ·
                          </span>
                          <span className="font-medium text-[#2F5D50]">Today</span>
                        </>
                      )}
                    </div>

                    {contextParts.length > 0 && (
                      <p className="font-mono text-xs text-[#5C6762] tabular-nums">
                        {contextParts.join(' · ')}
                      </p>
                    )}
                  </div>

                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#1E2421]">
                    {item.note}
                  </p>
                </li>
              );
            })}
          </ol>

          {hasMoreNotes && (
            <div className="mt-3 border-t border-[#ECEAE3] pt-3">
              <button
                type="button"
                onClick={() => setShowAllNotes((prev) => !prev)}
                className="inline-flex min-h-[44px] items-center text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238]"
              >
                {showAllNotes
                  ? `Show recent ${DEFAULT_VISIBLE_COUNT}`
                  : `Show all ${notes.length} reflections`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
