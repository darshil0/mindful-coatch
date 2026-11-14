import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, FileText, RefreshCw } from 'lucide-react';
import type {
  DailyEntry,
  NavDestination,
  UserProfile,
  WeeklyProgressReport,
  WellnessStatistics,
} from '../../types/wellness';
import { getGoalMetadata } from '../../data/goals';
import { formatReadableDate } from '../../lib/dateUtils';
import {
  buildWeeklyProgressReport,
  formatSleepMinutes,
} from '../../lib/wellnessMetrics';

interface WeeklyProgressReportCardProps {
  profile: UserProfile;
  statistics: WellnessStatistics;
  entriesByDate: Record<string, DailyEntry>;
  onFocusCheckIn: () => void;
  onNavigate: (destination: NavDestination) => void;
}

function formatGeneratedTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(dt);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy textarea copy
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function WeeklyProgressReportCard({
  profile,
  statistics,
  entriesByDate,
  onFocusCheckIn,
  onNavigate,
}: WeeklyProgressReportCardProps) {
  const [generatedReport, setGeneratedReport] = useState<WeeklyProgressReport | null>(
    null
  );
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const livePreviewReport = useMemo(
    () =>
      buildWeeklyProgressReport({
        statistics,
        preferredName: profile.preferredName,
        primaryGoal: profile.primaryGoal,
        entriesByDate,
        generatedAt: '',
      }),
    [statistics, profile.preferredName, profile.primaryGoal, entriesByDate]
  );

  const isReportOutdated =
    generatedReport !== null &&
    generatedReport.plainTextReport !== livePreviewReport.plainTextReport;

  const handleGenerateReport = () => {
    const fresh = buildWeeklyProgressReport({
      statistics,
      preferredName: profile.preferredName,
      primaryGoal: profile.primaryGoal,
      entriesByDate,
      generatedAt: new Date().toISOString(),
    });
    setGeneratedReport(fresh);
    setCopyStatus('idle');
  };

  const handleCopyReport = async () => {
    if (!generatedReport) return;
    const ok = await copyTextToClipboard(generatedReport.plainTextReport);
    setCopyStatus(ok ? 'copied' : 'failed');
  };

  const handleDownloadReport = () => {
    if (!generatedReport || typeof document === 'undefined') return;
    const blob = new Blob([generatedReport.plainTextReport], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mindful-coach-weekly-report-${generatedReport.periodEnd}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const periodRangeLabel = `${formatReadableDate(livePreviewReport.periodStart)} – ${formatReadableDate(livePreviewReport.periodEnd)}`;

  return (
    <section
      aria-labelledby="weekly-progress-report-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#5C6762]">
            7-day digest · Computed locally
          </p>
          <h2
            id="weekly-progress-report-heading"
            className="mt-1 font-display text-xl font-medium text-[#1E2421]"
          >
            Weekly progress report
          </h2>
        </div>

        <button
          type="button"
          onClick={handleGenerateReport}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap shrink-0"
        >
          {generatedReport ? (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Refresh report</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" aria-hidden="true" />
              <span>Generate report</span>
            </>
          )}
        </button>
      </div>

      {generatedReport === null ? (
        <div className="mt-4 rounded-xl bg-[#FAF9F6] p-4 sm:p-5">
          <p className="text-xs font-medium text-[#5C6762]">
            Window: {periodRangeLabel} · {livePreviewReport.activeDaysInLast7} of 7 active{' '}
            {livePreviewReport.activeDaysInLast7 === 1 ? 'day' : 'days'} recorded
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#4A5550]">
            {livePreviewReport.hasAnyActivity
              ? 'Compile your past 7 days of check-ins, energy ratings, sleep, steps, guided sessions, and Mindful Streak into a readable summary you can review, copy, or save.'
              : 'No check-ins or guided sessions have been logged in the past 7 days yet. Save a check-in or complete a guided session first—or generate a baseline report anytime.'}
          </p>
          {!livePreviewReport.hasAnyActivity && (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onFocusCheckIn}
                className="inline-flex min-h-[44px] items-center text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] whitespace-nowrap"
              >
                Log today’s check-in
              </button>
              <button
                type="button"
                onClick={() => onNavigate('sessions')}
                className="inline-flex min-h-[44px] items-center text-xs font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] whitespace-nowrap"
              >
                Browse guided sessions
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="weekly-progress-report-output"
          className="mt-5 space-y-5 border-t border-[#ECEAE3] pt-5"
        >
          {isReportOutdated && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAF9F6] px-4 py-3 text-xs text-[#4A5550]"
            >
              <span>New activity or profile changes were recorded after this report was generated.</span>
              <button
                type="button"
                onClick={handleGenerateReport}
                className="min-h-[44px] font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] whitespace-nowrap shrink-0"
              >
                Update now
              </button>
            </div>
          )}

          {/* Report Header */}
          <div>
            <p className="text-xs text-[#5C6762]">
              {formatReadableDate(generatedReport.periodStart)} –{' '}
              {formatReadableDate(generatedReport.periodEnd)} · Prepared for{' '}
              {generatedReport.preferredName} · Focus:{' '}
              {getGoalMetadata(generatedReport.primaryGoal).label} · Generated{' '}
              {formatGeneratedTime(generatedReport.generatedAt)}
            </p>
            <h3
              data-testid="weekly-report-headline"
              className="mt-1 font-display text-lg font-medium text-[#1E2421]"
            >
              {generatedReport.headline}
            </h3>
            <p
              data-testid="weekly-report-narrative"
              className="mt-2 text-sm leading-relaxed text-[#4A5550]"
            >
              {generatedReport.narrativeSummary}
            </p>
          </div>

          {/* 7-Day Metrics Summary Grid */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#FAF9F6] p-3.5">
              <dt className="text-xs text-[#5C6762]">Weekly score</dt>
              <dd className="mt-1 font-mono text-base font-medium text-[#1E2421] tabular-nums">
                {generatedReport.weeklyScore.score !== null
                  ? `${generatedReport.weeklyScore.score} / 100`
                  : 'Not enough data'}
              </dd>
            </div>
            <div className="rounded-xl bg-[#FAF9F6] p-3.5">
              <dt className="text-xs text-[#5C6762]">Active days</dt>
              <dd className="mt-1 font-mono text-base font-medium text-[#1E2421] tabular-nums">
                {generatedReport.activeDaysInLast7} / 7 days
              </dd>
            </div>
            <div className="rounded-xl bg-[#FAF9F6] p-3.5">
              <dt className="text-xs text-[#5C6762]">Mindful streak</dt>
              <dd className="mt-1 font-mono text-base font-medium text-[#1E2421] tabular-nums">
                {generatedReport.streak.currentStreak}{' '}
                {generatedReport.streak.currentStreak === 1 ? 'day' : 'days'}
              </dd>
            </div>
            <div className="rounded-xl bg-[#FAF9F6] p-3.5">
              <dt className="text-xs text-[#5C6762]">Avg energy</dt>
              <dd className="mt-1 font-mono text-base font-medium text-[#1E2421] tabular-nums">
                {generatedReport.averages.energyScore !== null
                  ? `${generatedReport.averages.energyScore} / 100`
                  : 'Not recorded'}
              </dd>
            </div>
            <div className="rounded-xl bg-[#FAF9F6] p-3.5">
              <dt className="text-xs text-[#5C6762]">Avg sleep</dt>
              <dd className="mt-1 font-mono text-base font-medium text-[#1E2421] tabular-nums">
                {formatSleepMinutes(generatedReport.averages.sleepMinutes)}
              </dd>
            </div>
            <div className="rounded-xl bg-[#FAF9F6] p-3.5">
              <dt className="text-xs text-[#5C6762]">Avg movement</dt>
              <dd className="mt-1 font-mono text-base font-medium text-[#1E2421] tabular-nums">
                {generatedReport.averages.steps !== null
                  ? `${generatedReport.averages.steps.toLocaleString('en-US')} steps`
                  : 'Not recorded'}
              </dd>
            </div>
          </dl>

          {/* Recorded Highlights */}
          {generatedReport.highlights.length > 0 && (
            <div className="border-t border-[#ECEAE3] pt-4">
              <h4 className="text-xs font-medium text-[#5C6762]">
                Recorded highlights
              </h4>
              <ul className="mt-2 divide-y divide-[#ECEAE3]">
                {generatedReport.highlights.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-1 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[#1E2421]">
                        {item.label}
                      </span>
                      <span className="ml-2 text-xs text-[#5C6762]">
                        {item.detail}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-medium text-[#1E2421] tabular-nums whitespace-nowrap">
                      {item.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Week Focus */}
          <div className="border-t border-[#ECEAE3] pt-4">
            <h4 className="text-xs font-medium text-[#5C6762]">
              Next week focus
            </h4>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[#4A5550]">
              {generatedReport.nextWeekFocus.map((tip, idx) => (
                <li key={`${idx}-${tip.slice(0, 24)}`} className="flex gap-2.5">
                  <span aria-hidden="true" className="text-[#2F5D50]">
                    ·
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Report Export & Visibility Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEAE3] pt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyReport}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2 text-xs font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] whitespace-nowrap"
              >
                {copyStatus === 'copied' ? (
                  <Check className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
                )}
                <span>{copyStatus === 'copied' ? 'Copied summary' : 'Copy text'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadReport}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2 text-xs font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
                <span>Download .txt</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              {copyStatus === 'copied' && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs font-medium text-[#2F5D50]"
                >
                  Copied report to clipboard.
                </p>
              )}
              {copyStatus === 'failed' && (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs font-medium text-[#9B2C2C]"
                >
                  Clipboard unavailable here—use Download .txt instead.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setGeneratedReport(null);
                  setCopyStatus('idle');
                }}
                className="min-h-[44px] px-2 text-xs font-medium text-[#5C6762] underline underline-offset-4 hover:text-[#1E2421] whitespace-nowrap"
              >
                Hide report
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
