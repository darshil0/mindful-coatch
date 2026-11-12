import React from 'react';
import { ArrowLeft, CircleCheck, Pause, Play, Square } from 'lucide-react';
import type {
  GuidedSessionDefinition,
  SessionTimerState,
} from '../../types/wellness';
import {
  formatTimerMmSs,
  getActiveStepForElapsed,
  getSessionElapsedMs,
  getSessionRemainingSeconds,
} from '../../lib/sessionTimer';

interface ActiveSessionPlayerProps {
  session: GuidedSessionDefinition;
  selectedDurationSec: number;
  timerState: SessionTimerState;
  nowMs: number;
  effectiveReducedMotion: boolean;
  onBackToCatalog: () => void;
  onChangeDuration: (seconds: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndEarly: () => void;
}

export function ActiveSessionPlayer({
  session,
  selectedDurationSec,
  timerState,
  nowMs,
  effectiveReducedMotion,
  onBackToCatalog,
  onChangeDuration,
  onStart,
  onPause,
  onResume,
  onEndEarly,
}: ActiveSessionPlayerProps) {
  const elapsedMs = getSessionElapsedMs(timerState, nowMs);
  const remainingSeconds =
    timerState.status === 'idle'
      ? selectedDurationSec
      : getSessionRemainingSeconds(timerState, nowMs);
  const progressPct =
    timerState.durationMs > 0
      ? Math.min(100, Math.round((elapsedMs / timerState.durationMs) * 100))
      : 0;
  const activeStepInfo = getActiveStepForElapsed(
    session.steps,
    elapsedMs,
    timerState.durationMs
  );

  // Optional gentle breathing phase text (4s easy inhale / 5s soft exhale = 9s cycle)
  const stepUsesRhythmPacer = Boolean(activeStepInfo.step.breathCue?.includes('~4s'));
  const cycleSecond = Math.floor(elapsedMs / 1000) % 9;
  const gentlePhaseLabel = stepUsesRhythmPacer
    ? cycleSecond < 4
      ? 'Optional cue: Easy, unforced inhale (~4s)'
      : 'Optional cue: Soft, unhurried exhale (~5s)'
    : activeStepInfo.step.breathCue ?? 'Breathe naturally at your own pace.';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          onClick={onBackToCatalog}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-2 -ml-2 text-sm font-medium text-[#4A5550] hover:text-[#1E2421]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>All guided sessions</span>
        </button>
      </div>

      <section
        aria-labelledby="active-session-heading"
        className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-8"
      >
        <p className="text-xs font-medium text-[#5C6762]">
          Text-guided timer · Silent (no audio) · {session.steps.length} steps
        </p>
        <h1
          id="active-session-heading"
          className="mt-1.5 font-display text-2xl sm:text-3xl font-medium text-[#1E2421]"
        >
          {session.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A5550]">
          {session.shortDescription}
        </p>

        {/* Duration Picker (available when idle, ended early, or completed) */}
        {(timerState.status === 'idle' ||
          timerState.status === 'ended_early' ||
          timerState.status === 'completed') && (
          <div className="mt-6 border-t border-[#ECEAE3] pt-5">
            <span className="block text-xs font-medium text-[#5C6762]">
              Choose session duration
            </span>
            <div
              role="group"
              aria-label="Session duration"
              className="mt-2.5 flex flex-wrap gap-2"
            >
              {session.durationOptionsSeconds.map((sec) => {
                const mins = Math.round(sec / 60);
                const isSelected = selectedDurationSec === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onChangeDuration(sec)}
                    className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'border-[#2F5D50] bg-[#EBF2EF] text-[#1F4238]'
                        : 'border-[#D5D3CA] bg-[#FAF9F6] text-[#1E2421] hover:bg-[#F2F0EA]'
                    }`}
                  >
                    {mins} {mins === 1 ? 'minute' : 'minutes'}
                    {sec === session.defaultDurationSeconds ? ' (Standard)' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Timer & Controls Box */}
        <div className="mt-6 rounded-2xl bg-[#FAF9F6] p-6 text-center">
          {/* Screen reader status announcements for state transitions without ticking noise */}
          <div className="sr-only" role="status" aria-live="polite">
            {timerState.status === 'running' &&
              `${session.title} in progress. Step ${
                activeStepInfo.index + 1
              } of ${session.steps.length}: ${activeStepInfo.step.title}.`}
            {timerState.status === 'paused' && `${session.title} paused.`}
            {timerState.status === 'ended_early' &&
              `${session.title} ended early. Not recorded as completed.`}
            {timerState.status === 'completed' &&
              `${session.title} completed. Saved to your session history.`}
          </div>

          {timerState.status === 'completed' ? (
            <div className="py-3 space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF2EF] text-[#2F5D50]">
                <CircleCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="font-display text-2xl font-medium text-[#1E2421]">
                Session complete
              </h2>
              <p className="mx-auto max-w-md text-sm text-[#4A5550]">
                You completed {Math.round(timerState.durationMs / 60000)}{' '}
                {Math.round(timerState.durationMs / 60000) === 1
                  ? 'minute'
                  : 'minutes'}{' '}
                of {session.title.toLowerCase()}. Take an unhurried moment before moving
                into what is next.
              </p>
              <div className="pt-3 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={onStart}
                  className="min-h-[44px] rounded-xl border border-[#D5D3CA] bg-white px-5 py-2.5 text-sm font-medium text-[#1E2421] hover:bg-[#F2F0EA] whitespace-nowrap"
                >
                  Practice again
                </button>
                <button
                  type="button"
                  onClick={onBackToCatalog}
                  className="min-h-[44px] rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#254B40] whitespace-nowrap"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-[#5C6762]">
                {timerState.status === 'idle' && 'Ready when you are'}
                {timerState.status === 'running' &&
                  `Step ${activeStepInfo.index + 1} of ${session.steps.length}`}
                {timerState.status === 'paused' && 'Paused'}
                {timerState.status === 'ended_early' &&
                  'Ended early · Not counted as completed'}
              </p>

              <div
                aria-label="Time remaining"
                className="mt-2 font-mono text-5xl font-medium tracking-tight text-[#1E2421] tabular-nums"
              >
                {formatTimerMmSs(remainingSeconds)}
              </div>

              {/* Progress Bar */}
              <div
                aria-hidden="true"
                className="mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full bg-[#E6E4DD]"
              >
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-[#2F5D50] transition-opacity"
                />
              </div>

              {/* Optional Gentle Breathing Cue (respects reduced motion) */}
              {session.hasOptionalBreathingPacer &&
                (timerState.status === 'running' ||
                  timerState.status === 'paused') && (
                  <div className="mx-auto mt-5 max-w-md border-t border-[#E6E4DD] pt-4">
                    {!effectiveReducedMotion &&
                      timerState.status === 'running' &&
                      stepUsesRhythmPacer && (
                        <div
                          aria-hidden="true"
                          className="mx-auto mb-2 flex h-10 w-10 items-center justify-center"
                        >
                          <div
                            className={`h-7 w-7 rounded-full border-2 border-[#2F5D50] bg-[#EBF2EF] transition-transform duration-1000 ${
                              cycleSecond < 4 ? 'scale-115' : 'scale-90'
                            }`}
                          />
                        </div>
                      )}
                    <p className="text-xs font-medium text-[#1F4238]">
                      {timerState.status === 'running'
                        ? gentlePhaseLabel
                        : 'Breathing cue paused — breathe naturally'}
                    </p>
                    <p className="mt-1 text-xs text-[#5C6762]">
                      {effectiveReducedMotion
                        ? 'Reduced motion is active: written cues are shown without continuous animation.'
                        : 'Follow only if comfortable, or breathe at your own pace.'}
                    </p>
                  </div>
                )}

              {/* Active Step Guidance while running/paused */}
              {(timerState.status === 'running' || timerState.status === 'paused') && (
                <div className="mx-auto mt-5 max-w-lg text-left border-t border-[#E6E4DD] pt-4">
                  <p className="text-xs font-semibold text-[#2F5D50]">
                    Current guidance · {activeStepInfo.step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#1E2421]">
                    {activeStepInfo.step.instruction}
                  </p>
                </div>
              )}

              {/* Session Controls */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {(timerState.status === 'idle' ||
                  timerState.status === 'ended_early') && (
                  <button
                    type="button"
                    onClick={onStart}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#2F5D50] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    <span>Start session</span>
                  </button>
                )}

                {timerState.status === 'running' && (
                  <>
                    <button
                      type="button"
                      onClick={onPause}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[#D5D3CA] bg-white px-5 py-2.5 text-sm font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] whitespace-nowrap"
                    >
                      <Pause className="h-4 w-4" aria-hidden="true" />
                      <span>Pause</span>
                    </button>
                    <button
                      type="button"
                      onClick={onEndEarly}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[#D5D3CA] bg-white px-5 py-2.5 text-sm font-medium text-[#4A5550] transition-colors hover:bg-[#F2F0EA] hover:text-[#1E2421] whitespace-nowrap"
                    >
                      <Square className="h-4 w-4" aria-hidden="true" />
                      <span>End session</span>
                    </button>
                  </>
                )}

                {timerState.status === 'paused' && (
                  <>
                    <button
                      type="button"
                      onClick={onResume}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#2F5D50] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>Resume</span>
                    </button>
                    <button
                      type="button"
                      onClick={onEndEarly}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-[#D5D3CA] bg-white px-5 py-2.5 text-sm font-medium text-[#4A5550] transition-colors hover:bg-[#F2F0EA] hover:text-[#1E2421] whitespace-nowrap"
                    >
                      <Square className="h-4 w-4" aria-hidden="true" />
                      <span>End session</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Safety Note */}
        <p className="mt-4 text-xs leading-relaxed text-[#5C6762]">
          <strong>Comfort note:</strong> {session.safetyNote}
        </p>

        {/* Full Step-by-Step Guidance List */}
        <div className="mt-6 border-t border-[#ECEAE3] pt-6">
          <h2 className="font-display text-lg font-medium text-[#1E2421]">
            Step-by-step guidance
          </h2>
          <ol className="mt-4 divide-y divide-[#ECEAE3]">
            {session.steps.map((step, idx) => {
              const isCurrent =
                (timerState.status === 'running' ||
                  timerState.status === 'paused') &&
                activeStepInfo.index === idx;
              return (
                <li
                  key={step.title}
                  className={`py-4 first:pt-1 last:pb-0 ${
                    isCurrent ? 'rounded-xl bg-[#EBF2EF]/50 px-3 -mx-3' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[#1E2421]">
                      {idx + 1}. {step.title}
                    </span>
                    {isCurrent && (
                      <span className="text-xs font-medium text-[#2F5D50]">
                        Active step
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#4A5550]">
                    {step.instruction}
                  </p>
                  {step.breathCue && (
                    <p className="mt-1.5 text-xs text-[#5C6762]">{step.breathCue}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </div>
  );
}
