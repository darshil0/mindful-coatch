import React, { useEffect, useRef, useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Shield, Compass } from 'lucide-react';
import type { WellnessGoal } from '../../types/wellness';
import { GOAL_METADATA, WELLNESS_GOALS } from '../../data/goals';
import { validatePreferredName } from '../../lib/validation';

interface OnboardingFlowProps {
  storageAvailable: boolean;
  storageNotice: string | null;
  onComplete: (preferredName: string, primaryGoal: WellnessGoal) => void;
}

export function OnboardingFlow({
  storageAvailable,
  storageNotice,
  onComplete,
}: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<WellnessGoal>('sleep');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      step === 1 &&
      (!document.activeElement || document.activeElement === document.body)
    ) {
      nameInputRef.current?.focus();
    }
  }, [step]);

  const handleNextFromName = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePreferredName(nameInput);
    if (!validation.valid) {
      setNameError(validation.error);
      return;
    }
    setNameInput(validation.value);
    setNameError(null);
    setStep(2);
  };

  const handleFinish = () => {
    const validation = validatePreferredName(nameInput);
    if (!validation.valid) {
      setStep(1);
      setNameError(validation.error);
      return;
    }
    onComplete(validation.value, selectedGoal);
  };

  return (
    <div className="min-h-dvh bg-[#FAF9F6] text-[#1E2421] flex flex-col justify-between px-4 py-8 sm:px-6 lg:py-12">
      <a
        href="#onboarding-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-[#2F5D50] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to setup content
      </a>

      <header className="mx-auto w-full max-w-xl flex items-center justify-between">
        <span className="font-display text-xl font-medium tracking-tight text-[#1E2421]">
          Mindful Coach
        </span>
        <span className="text-xs font-medium text-[#5C6762] tabular-nums">
          Step {step} of 3
        </span>
      </header>

      <main id="onboarding-main" className="mx-auto my-8 w-full max-w-xl">
        {!storageAvailable && storageNotice && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-[#D8E2EB] bg-[#EDF3F7] px-4 py-3 text-sm text-[#243B4D]"
          >
            {storageNotice}
          </div>
        )}

        <div className="rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-8">
          {step === 1 && (
            <form onSubmit={handleNextFromName} noValidate>
              <p className="text-xs font-medium text-[#5C6762]">
                Welcome · Local profile setup
              </p>
              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-medium text-[#1E2421]">
                What would you like us to call you?
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#4A5550]">
                Mindful Coach uses a simple profile stored in this browser to personalize
                your greeting and focus area. No email, password, or account sign-in is
                required.
              </p>

              <div className="mt-6">
                <label
                  htmlFor="preferred-name-input"
                  className="block text-sm font-medium text-[#1E2421]"
                >
                  Preferred name
                </label>
                <input
                  ref={nameInputRef}
                  id="preferred-name-input"
                  type="text"
                  autoComplete="given-name"
                  maxLength={50}
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  aria-invalid={nameError ? 'true' : 'false'}
                  aria-describedby={
                    nameError
                      ? 'preferred-name-hint preferred-name-error'
                      : 'preferred-name-hint'
                  }
                  placeholder="For example, Maya"
                  className="mt-2 w-full min-h-[48px] rounded-xl border border-[#CFCBC0] bg-[#FAF9F6] px-4 py-2.5 text-base text-[#1E2421] placeholder:text-[#76827C] focus:border-[#2F5D50] focus:bg-white"
                />
                <p
                  id="preferred-name-hint"
                  className="mt-2 text-xs leading-relaxed text-[#5C6762]"
                >
                  Entering a name personalizes this browser view only; it does not create a
                  password-protected or isolated account on a shared device.
                </p>
                {nameError && (
                  <p
                    id="preferred-name-error"
                    role="alert"
                    className="mt-2 text-sm font-medium text-[#9B2C2C]"
                  >
                    {nameError}
                  </p>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div>
              <p className="text-xs font-medium text-[#5C6762]">
                Focus area · Changeable anytime
              </p>
              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-medium text-[#1E2421]">
                Choose one primary wellness focus
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#4A5550]">
                We use this to highlight relevant guided sessions and starter questions for{' '}
                <span className="font-medium text-[#1E2421]">{nameInput}</span>. You can
                switch your focus anytime in Profile.
              </p>

              <fieldset className="mt-6">
                <legend className="sr-only">Primary wellness goal</legend>
                <div className="space-y-3">
                  {WELLNESS_GOALS.map((goalId) => {
                    const meta = GOAL_METADATA[goalId];
                    const isSelected = selectedGoal === goalId;
                    return (
                      <label
                        key={goalId}
                        htmlFor={`goal-option-${goalId}`}
                        className={`flex cursor-pointer items-start justify-between gap-4 rounded-xl border p-4 transition-colors min-h-[64px] ${
                          isSelected
                            ? 'border-[#2F5D50] bg-[#EBF2EF]'
                            : 'border-[#E6E4DD] bg-[#FAF9F6] hover:bg-[#F2F0EA]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            id={`goal-option-${goalId}`}
                            type="radio"
                            name="primary-goal"
                            value={goalId}
                            checked={isSelected}
                            onChange={() => setSelectedGoal(goalId)}
                            className="mt-1 h-4 w-4 accent-[#2F5D50]"
                          />
                          <div>
                            <span className="block text-base font-semibold text-[#1E2421]">
                              {meta.label}
                            </span>
                            <span className="mt-0.5 block text-sm text-[#4A5550]">
                              {meta.tagline}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2F5D50] text-white"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#D5D3CA] bg-white px-4 py-2.5 text-sm font-medium text-[#1E2421] transition-colors hover:bg-[#F5F4EF] whitespace-nowrap"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <p className="text-xs font-medium text-[#5C6762]">
                Privacy & transparency
              </p>
              <h1 className="mt-2 font-display text-2xl sm:text-3xl font-medium text-[#1E2421]">
                How your information is handled
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#4A5550]">
                Before opening your dashboard, here is a clear look at what stays in your
                browser and what happens when you use Coach chat.
              </p>

              <div className="mt-6 space-y-5 border-t border-[#ECEAE3] pt-5">
                <div className="flex items-start gap-3">
                  <Shield
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#2F5D50]"
                    aria-hidden="true"
                  />
                  <div>
                    <h2 className="text-sm font-semibold text-[#1E2421]">
                      What stays on this device
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#4A5550]">
                      Your preferred name ({nameInput}), focus goal (
                      {GOAL_METADATA[selectedGoal].label}), daily energy/sleep/step
                      check-ins, and completed sessions stay in local browser storage.
                      Persistent chat-history saving is turned <strong>off</strong> by
                      default. Local browser storage is not encrypted, does not sync across
                      devices, and may be visible to others using the same browser profile.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-t border-[#ECEAE3] pt-5">
                  <Compass
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#3B5B75]"
                    aria-hidden="true"
                  />
                  <div>
                    <h2 className="text-sm font-semibold text-[#1E2421]">
                      What may be sent to an AI provider
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-[#4A5550]">
                      If you send a question in Live AI Coach mode, only your chat message,
                      recent turns from that conversation, and your selected focus topic are
                      sent through our server to an external AI provider to generate a
                      reply. Your name and daily tracking logs are not sent automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[#D5D3CA] bg-white px-4 py-2.5 text-sm font-medium text-[#1E2421] transition-colors hover:bg-[#F5F4EF] whitespace-nowrap"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#2F5D50] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
                >
                  <span>Open dashboard</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-xl text-center text-xs text-[#5C6762]">
        General wellness education · Not medical advice, diagnosis, or treatment
      </footer>
    </div>
  );
}
