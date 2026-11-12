import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { DailyEntry } from '../../types/wellness';
import { formatReadableDate } from '../../lib/dateUtils';
import {
  computeSelfReportedEnergyScore,
  formatSleepMinutes,
  formatStepsCount,
  hasAnyRecordedMetric,
  splitSleepMinutesToInputs,
} from '../../lib/wellnessMetrics';
import {
  validateEnergyRating,
  validateSleepInputs,
  validateStepsInput,
} from '../../lib/validation';

interface DailyCheckInCardProps {
  todayDateKey: string;
  todayEntry: DailyEntry | undefined;
  focusCheckInSignal: number;
  onSaveDailyEntry: (entry: DailyEntry) => void;
}

export function DailyCheckInCard({
  todayDateKey,
  todayEntry,
  focusCheckInSignal,
  onSaveDailyEntry,
}: DailyCheckInCardProps) {
  const [selectedEnergy, setSelectedEnergy] = useState<number | null>(
    todayEntry?.energyRating ?? null
  );
  const [stepsInput, setStepsInput] = useState<string>(
    todayEntry?.steps !== null && todayEntry?.steps !== undefined
      ? String(todayEntry.steps)
      : ''
  );
  const initialSleep = splitSleepMinutesToInputs(todayEntry?.sleepMinutes);
  const [sleepHoursInput, setSleepHoursInput] = useState<string>(initialSleep.hours);
  const [sleepMinutesInput, setSleepMinutesInput] = useState<string>(
    initialSleep.minutes
  );

  const [showEnergyExplanation, setShowEnergyExplanation] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    general?: string;
    energy?: string;
    steps?: string;
    sleep?: string;
  }>({});
  const [saveAnnouncement, setSaveAnnouncement] = useState<string | null>(null);

  const checkInSectionRef = useRef<HTMLElement>(null);

  // Sync form inputs whenever todayDateKey or todayEntry updates externally
  useEffect(() => {
    setSelectedEnergy(todayEntry?.energyRating ?? null);
    setStepsInput(
      todayEntry?.steps !== null && todayEntry?.steps !== undefined
        ? String(todayEntry.steps)
        : ''
    );
    const sleepParts = splitSleepMinutesToInputs(todayEntry?.sleepMinutes);
    setSleepHoursInput(sleepParts.hours);
    setSleepMinutesInput(sleepParts.minutes);
    setFormErrors({});
  }, [todayDateKey, todayEntry]);

  useEffect(() => {
    if (focusCheckInSignal > 0 && checkInSectionRef.current) {
      checkInSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstButton =
        checkInSectionRef.current.querySelector<HTMLElement>('button, input');
      firstButton?.focus();
    }
  }, [focusCheckInSignal]);

  const savedEnergyScore = computeSelfReportedEnergyScore(todayEntry?.energyRating);
  const hasSavedToday = hasAnyRecordedMetric(todayEntry);

  const handleSubmitCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveAnnouncement(null);

    const energyRes = validateEnergyRating(selectedEnergy);
    const stepsRes = validateStepsInput(stepsInput);
    const sleepRes = validateSleepInputs(sleepHoursInput, sleepMinutesInput);

    const nextErrors: {
      general?: string;
      energy?: string;
      steps?: string;
      sleep?: string;
    } = {};
    if (!energyRes.valid) nextErrors.energy = energyRes.error;
    if (!stepsRes.valid) nextErrors.steps = stepsRes.error;
    if (!sleepRes.valid) nextErrors.sleep = sleepRes.error;

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const energyVal = energyRes.valid ? energyRes.value : null;
    const stepsVal = stepsRes.valid ? stepsRes.value : null;
    const sleepVal = sleepRes.valid ? sleepRes.value : null;
    const isAllEmpty =
      energyVal === null && stepsVal === null && sleepVal === null;

    if (isAllEmpty && !hasSavedToday) {
      setFormErrors({
        general:
          'Enter at least one value (energy rating, sleep, or steps) to save today’s check-in.',
      });
      return;
    }

    setFormErrors({});
    const updatedEntry: DailyEntry = {
      date: todayDateKey,
      energyRating: energyVal,
      steps: stepsVal,
      sleepMinutes: sleepVal,
      updatedAt: new Date().toISOString(),
    };

    onSaveDailyEntry(updatedEntry);
    setSaveAnnouncement(
      isAllEmpty
        ? `Cleared check-in entries for ${formatReadableDate(todayDateKey)}.`
        : `Saved check-in for ${formatReadableDate(todayDateKey)}.`
    );
  };

  return (
    <section
      ref={checkInSectionRef}
      aria-labelledby="daily-checkin-heading"
      className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7"
    >
      {/* Self-Reported Energy Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pb-6 border-b border-[#ECEAE3]">
        <div>
          <span className="text-xs font-medium text-[#5C6762]">
            Self-reported energy · {formatReadableDate(todayDateKey)}
          </span>
          {savedEnergyScore !== null ? (
            <div className="mt-1 flex items-baseline gap-2.5">
              <span
                data-testid="energy-score-value"
                className="font-mono text-4xl font-medium text-[#1E2421] tabular-nums"
              >
                {savedEnergyScore}
              </span>
              <span className="font-mono text-sm text-[#5C6762] tabular-nums">
                / 100
              </span>
              <span className="text-sm text-[#4A5550]">
                · Rated {todayEntry?.energyRating} of 10
              </span>
            </div>
          ) : (
            <div className="mt-1">
              <p
                data-testid="energy-score-empty"
                className="font-display text-xl font-medium text-[#1E2421]"
              >
                No energy rating recorded yet today
              </p>
              <p className="mt-1 text-sm text-[#4A5550]">
                Check in below whenever you feel ready—we never estimate or fill in
                missing days automatically.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-expanded={showEnergyExplanation}
          aria-controls="energy-score-explanation"
          onClick={() => setShowEnergyExplanation((prev) => !prev)}
          className="inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2 text-xs font-medium text-[#1E2421] hover:bg-[#F2F0EA] whitespace-nowrap shrink-0"
        >
          <Info className="h-3.5 w-3.5 text-[#2F5D50]" aria-hidden="true" />
          <span>How this score works</span>
          {showEnergyExplanation ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {showEnergyExplanation && (
        <div
          id="energy-score-explanation"
          className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm leading-relaxed text-[#4A5550]"
        >
          <strong>Self-reported energy</strong> takes your 1–10 answer to “How is your
          energy today?” and multiplies it by 10 to display a number out of 100 (for
          example, 7 becomes 70 / 100). It is a simple personal reflection rather than a
          medical or scientifically validated score.
        </div>
      )}

      {/* Today's Saved Snapshot Row */}
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-[#FAF9F6] p-4 sm:grid-cols-3">
        <div>
          <span className="block text-xs text-[#5C6762]">Saved energy</span>
          <span className="mt-0.5 block font-mono text-sm font-medium text-[#1E2421] tabular-nums">
            {savedEnergyScore !== null ? `${savedEnergyScore} / 100` : 'Not recorded'}
          </span>
        </div>
        <div>
          <span className="block text-xs text-[#5C6762]">Saved sleep</span>
          <span className="mt-0.5 block font-mono text-sm font-medium text-[#1E2421] tabular-nums">
            {formatSleepMinutes(todayEntry?.sleepMinutes)}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="block text-xs text-[#5C6762]">Saved steps</span>
          <span className="mt-0.5 block font-mono text-sm font-medium text-[#1E2421] tabular-nums">
            {formatStepsCount(todayEntry?.steps)}
          </span>
        </div>
      </div>

      {/* Manual Check-in Form */}
      <form onSubmit={handleSubmitCheckIn} noValidate className="mt-6 space-y-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="daily-checkin-heading"
            className="font-display text-xl font-medium text-[#1E2421]"
          >
            {hasSavedToday ? 'Update today’s check-in' : 'Today’s check-in'}
          </h2>
          <span className="text-xs text-[#5C6762]">Manual entry · Stored locally</span>
        </div>

        {/* 1..10 Energy Scale */}
        <fieldset>
          <div className="flex items-center justify-between gap-2">
            <legend className="text-sm font-medium text-[#1E2421]">
              How is your energy today? (1–10)
            </legend>
            {selectedEnergy !== null && (
              <button
                type="button"
                onClick={() => setSelectedEnergy(null)}
                className="min-h-[44px] px-2 text-xs font-medium text-[#5C6762] underline underline-offset-4 hover:text-[#1E2421] whitespace-nowrap"
              >
                Clear rating
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-[#5C6762]">
            1 feels very depleted · 10 feels steady and energized
          </p>

          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
              const isSelected = selectedEnergy === num;
              return (
                <button
                  key={num}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Rate energy ${num} out of 10`}
                  onClick={() => {
                    setSelectedEnergy(num);
                    if (formErrors.energy || formErrors.general) {
                      setFormErrors((prev) => ({
                        ...prev,
                        energy: undefined,
                        general: undefined,
                      }));
                    }
                  }}
                  className={`min-h-[44px] min-w-[44px] rounded-xl border font-mono text-sm font-medium tabular-nums transition-colors ${
                    isSelected
                      ? 'border-[#2F5D50] bg-[#2F5D50] text-white'
                      : 'border-[#D5D3CA] bg-[#FAF9F6] text-[#1E2421] hover:bg-[#F2F0EA]'
                  }`}
                >
                  {num}
                </button>
              );
            })}
          </div>
          {formErrors.energy && (
            <p role="alert" className="mt-2 text-sm font-medium text-[#9B2C2C]">
              {formErrors.energy}
            </p>
          )}
        </fieldset>

        {/* Sleep Hours & Minutes */}
        <fieldset className="border-t border-[#ECEAE3] pt-5">
          <legend className="text-sm font-medium text-[#1E2421]">
            Sleep last night (0 to 24 hours)
          </legend>
          <p id="sleep-input-hint" className="mt-1 text-xs text-[#5C6762]">
            Leave both blank if not recording yet, or enter 0h 0m to record zero sleep.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 max-w-sm">
            <div>
              <label
                htmlFor="sleep-hours-input"
                className="block text-xs font-medium text-[#4A5550]"
              >
                Hours (0–24)
              </label>
              <input
                id="sleep-hours-input"
                type="text"
                inputMode="numeric"
                value={sleepHoursInput}
                onChange={(e) => {
                  setSleepHoursInput(e.target.value);
                  if (formErrors.sleep || formErrors.general) {
                    setFormErrors((prev) => ({
                      ...prev,
                      sleep: undefined,
                      general: undefined,
                    }));
                  }
                }}
                aria-invalid={formErrors.sleep ? 'true' : 'false'}
                aria-describedby={
                  formErrors.sleep
                    ? 'sleep-input-hint sleep-input-error'
                    : 'sleep-input-hint'
                }
                placeholder="e.g. 7"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[#CFCBC0] bg-[#FAF9F6] px-3.5 py-2 font-mono text-sm text-[#1E2421] tabular-nums placeholder:font-sans placeholder:text-[#76827C] focus:border-[#2F5D50] focus:bg-white"
              />
            </div>
            <div>
              <label
                htmlFor="sleep-minutes-input"
                className="block text-xs font-medium text-[#4A5550]"
              >
                Minutes (0–59)
              </label>
              <input
                id="sleep-minutes-input"
                type="text"
                inputMode="numeric"
                value={sleepMinutesInput}
                onChange={(e) => {
                  setSleepMinutesInput(e.target.value);
                  if (formErrors.sleep || formErrors.general) {
                    setFormErrors((prev) => ({
                      ...prev,
                      sleep: undefined,
                      general: undefined,
                    }));
                  }
                }}
                aria-invalid={formErrors.sleep ? 'true' : 'false'}
                aria-describedby={
                  formErrors.sleep
                    ? 'sleep-input-hint sleep-input-error'
                    : 'sleep-input-hint'
                }
                placeholder="e.g. 30"
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-[#CFCBC0] bg-[#FAF9F6] px-3.5 py-2 font-mono text-sm text-[#1E2421] tabular-nums placeholder:font-sans placeholder:text-[#76827C] focus:border-[#2F5D50] focus:bg-white"
              />
            </div>
          </div>
          {formErrors.sleep && (
            <p
              id="sleep-input-error"
              role="alert"
              className="mt-2 text-sm font-medium text-[#9B2C2C]"
            >
              {formErrors.sleep}
            </p>
          )}
        </fieldset>

        {/* Steps */}
        <div className="border-t border-[#ECEAE3] pt-5">
          <label
            htmlFor="daily-steps-input"
            className="block text-sm font-medium text-[#1E2421]"
          >
            Steps today
          </label>
          <p id="steps-input-hint" className="mt-1 text-xs text-[#5C6762]">
            Whole numbers 0 or higher. Leave blank if unknown. Manual entry only—not
            synced with a phone or wearable.
          </p>
          <div className="mt-3 max-w-xs">
            <input
              id="daily-steps-input"
              type="text"
              inputMode="numeric"
              value={stepsInput}
              onChange={(e) => {
                setStepsInput(e.target.value);
                if (formErrors.steps || formErrors.general) {
                  setFormErrors((prev) => ({
                    ...prev,
                    steps: undefined,
                    general: undefined,
                  }));
                }
              }}
              aria-invalid={formErrors.steps ? 'true' : 'false'}
              aria-describedby={
                formErrors.steps
                  ? 'steps-input-hint steps-input-error'
                  : 'steps-input-hint'
              }
              placeholder="e.g. 6000"
              className="w-full min-h-[44px] rounded-xl border border-[#CFCBC0] bg-[#FAF9F6] px-3.5 py-2 font-mono text-sm text-[#1E2421] tabular-nums placeholder:font-sans placeholder:text-[#76827C] focus:border-[#2F5D50] focus:bg-white"
            />
          </div>
          {formErrors.steps && (
            <p
              id="steps-input-error"
              role="alert"
              className="mt-2 text-sm font-medium text-[#9B2C2C]"
            >
              {formErrors.steps}
            </p>
          )}
        </div>

        {formErrors.general && (
          <p role="alert" className="text-sm font-medium text-[#9B2C2C]">
            {formErrors.general}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ECEAE3] pt-5">
          <button
            type="submit"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>{hasSavedToday ? 'Save changes' : 'Save today’s check-in'}</span>
          </button>

          {saveAnnouncement && (
            <p
              role="status"
              aria-live="polite"
              className="text-sm font-medium text-[#2F5D50]"
            >
              {saveAnnouncement}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
