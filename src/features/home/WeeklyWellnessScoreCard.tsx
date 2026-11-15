import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { WeeklyWellnessScore } from '../../types/wellness';

interface WeeklyWellnessScoreCardProps {
  weeklyScore: WeeklyWellnessScore;
}

export function WeeklyWellnessScoreCard({ weeklyScore }: WeeklyWellnessScoreCardProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <section
      aria-labelledby="weekly-wellness-score-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5C6762]">Past 7 local calendar days</p>
          <h2
            id="weekly-wellness-score-heading"
            className="mt-1 font-display text-xl font-medium text-[#1E2421]"
          >
            Weekly wellness score
          </h2>
        </div>

        <button
          type="button"
          aria-expanded={showExplanation}
          aria-controls="weekly-score-explanation"
          onClick={() => setShowExplanation((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3 py-2 text-xs font-medium text-[#1E2421] hover:bg-[#F2F0EA] whitespace-nowrap shrink-0"
        >
          <Info className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
          <span>How it works</span>
          {showExplanation ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {showExplanation && (
        <div
          id="weekly-score-explanation"
          className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-xs leading-relaxed text-[#4A5550]"
        >
          <strong>Weekly wellness score</strong> combines only the metrics you actually
          recorded over the past 7 local days: Energy (35% weight), Sleep relative to 7–9h
          per night (25%), 7-day Check-in &amp; session consistency (25%), and Movement
          toward 8,000 steps per day (15%). Sleep and movement average each recorded day’s
          score so high day-to-day swings stay visible, unrecorded categories are omitted
          rather than counted as zero, and this is a personal reflection guide rather than
          a clinical metric.
        </div>
      )}

      {weeklyScore.score === null ? (
        <div className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm leading-relaxed text-[#4A5550]">
          <p data-testid="weekly-score-empty" className="font-medium text-[#1E2421]">
            No 7-day score yet
          </p>
          <p className="mt-1">
            Save a daily check-in or complete a guided session to compute your weekly
            wellness score. Unrecorded categories never pull your score down as zero.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span
                data-testid="weekly-score-value"
                className="font-mono text-4xl font-medium text-[#1E2421] tabular-nums"
              >
                {weeklyScore.score}
              </span>
              <span className="font-mono text-sm text-[#5C6762] tabular-nums">/ 100</span>
              <span className="text-sm font-medium text-[#2F5D50]">
                · {weeklyScore.tierLabel}
              </span>
            </div>

            <span className="font-mono text-xs text-[#5C6762] tabular-nums">
              {weeklyScore.recordedCategoriesCount} of 4 inputs active
            </span>
          </div>

          <ul className="divide-y divide-[#ECEAE3] rounded-xl bg-[#FAF9F6] px-4 py-1">
            {weeklyScore.components.map((component) => (
              <li key={component.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-[#1E2421]">
                      {component.label}
                    </span>
                    <span className="ml-2 text-xs text-[#5C6762]">
                      {component.detail}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-medium text-[#1E2421] tabular-nums whitespace-nowrap">
                    {component.score !== null ? `${component.score}/100` : '—'}
                  </span>
                </div>
                {component.score !== null && (
                  <div
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E6E4DD]"
                  >
                    <div
                      className="h-full rounded-full bg-[#2F5D50]"
                      style={{ width: `${component.score}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
