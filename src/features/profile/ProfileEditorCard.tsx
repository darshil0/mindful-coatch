import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { UserProfile, WellnessGoal } from '../../types/wellness';
import { GOAL_METADATA, WELLNESS_GOALS } from '../../data/goals';
import { validatePreferredName } from '../../lib/validation';

interface ProfileEditorCardProps {
  profile: UserProfile;
  onUpdateProfile: (preferredName: string, primaryGoal: WellnessGoal) => void;
}

export function ProfileEditorCard({
  profile,
  onUpdateProfile,
}: ProfileEditorCardProps) {
  const [nameInput, setNameInput] = useState(profile.preferredName);
  const [selectedGoal, setSelectedGoal] = useState<WellnessGoal>(profile.primaryGoal);
  const [nameError, setNameError] = useState<string | null>(null);
  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(profile.preferredName);
    setSelectedGoal(profile.primaryGoal);
  }, [profile.preferredName, profile.primaryGoal]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSavedNotice(null);
    const res = validatePreferredName(nameInput);
    if (!res.valid) {
      setNameError(res.error);
      return;
    }
    setNameError(null);
    setNameInput(res.value);
    onUpdateProfile(res.value, selectedGoal);
    setProfileSavedNotice('Profile changes saved locally.');
  };

  return (
    <section
      aria-labelledby="edit-profile-heading"
      className="lg:col-span-7 rounded-2xl border border-[#E6E4DD] bg-white p-6 sm:p-7"
    >
      <h2
        id="edit-profile-heading"
        className="font-display text-xl font-medium text-[#1E2421]"
      >
        Local profile
      </h2>
      <p className="mt-1 text-sm text-[#4A5550]">
        Update how Mindful Coach greets you and which wellness focus is prioritized.
      </p>

      <form onSubmit={handleSaveProfile} noValidate className="mt-6 space-y-6">
        <div>
          <label
            htmlFor="profile-preferred-name"
            className="block text-sm font-medium text-[#1E2421]"
          >
            Preferred name
          </label>
          <input
            id="profile-preferred-name"
            type="text"
            maxLength={50}
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              if (nameError) setNameError(null);
            }}
            aria-invalid={nameError ? 'true' : 'false'}
            aria-describedby={nameError ? 'profile-name-error' : undefined}
            className="mt-2 w-full min-h-[44px] rounded-xl border border-[#CFCBC0] bg-[#FAF9F6] px-4 py-2 text-sm text-[#1E2421] focus:border-[#2F5D50] focus:bg-white"
          />
          {nameError && (
            <p
              id="profile-name-error"
              role="alert"
              className="mt-2 text-sm font-medium text-[#9B2C2C]"
            >
              {nameError}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-[#1E2421]">
            Primary wellness goal
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {WELLNESS_GOALS.map((goalId) => {
              const meta = GOAL_METADATA[goalId];
              const isSelected = selectedGoal === goalId;
              return (
                <label
                  key={goalId}
                  htmlFor={`profile-goal-${goalId}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 min-h-[56px] transition-colors ${
                    isSelected
                      ? 'border-[#2F5D50] bg-[#EBF2EF]'
                      : 'border-[#E6E4DD] bg-[#FAF9F6] hover:bg-[#F2F0EA]'
                  }`}
                >
                  <input
                    id={`profile-goal-${goalId}`}
                    type="radio"
                    name="profile-goal"
                    value={goalId}
                    checked={isSelected}
                    onChange={() => setSelectedGoal(goalId)}
                    className="mt-1 h-4 w-4 accent-[#2F5D50]"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-[#1E2421]">
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#4A5550]">
                      {meta.tagline}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#ECEAE3] pt-5">
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>Save profile</span>
          </button>
          {profileSavedNotice && (
            <p role="status" aria-live="polite" className="text-sm text-[#2F5D50]">
              {profileSavedNotice}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
