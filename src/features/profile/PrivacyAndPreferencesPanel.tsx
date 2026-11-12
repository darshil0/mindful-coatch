import React from 'react';
import { Shield, Trash2 } from 'lucide-react';
import type {
  ReduceMotionSetting,
  ReminderSchedule,
  UserPreferences,
} from '../../types/wellness';
import { ReminderScheduleEditor } from '../../components/reminders/ReminderScheduleEditor';

interface PrivacyAndPreferencesPanelProps {
  preferences: UserPreferences;
  reminderSchedule: ReminderSchedule;
  osPrefersReducedMotion: boolean;
  hasAnyChatMessages: boolean;
  onToggleChatSaving: (checked: boolean) => void;
  onChangeMotionSetting: (setting: ReduceMotionSetting) => void;
  onSaveReminderSchedule: (next: ReminderSchedule) => void;
  onClearChat: () => void;
  onRequestDeleteAll: () => void;
}

export function PrivacyAndPreferencesPanel({
  preferences,
  reminderSchedule,
  osPrefersReducedMotion,
  hasAnyChatMessages,
  onToggleChatSaving,
  onChangeMotionSetting,
  onSaveReminderSchedule,
  onClearChat,
  onRequestDeleteAll,
}: PrivacyAndPreferencesPanelProps) {
  return (
    <div className="space-y-6 lg:col-span-5">
      <section
        aria-labelledby="preferences-heading"
        className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
      >
        <h2
          id="preferences-heading"
          className="font-display text-xl font-medium text-[#1E2421]"
        >
          Preferences
        </h2>

        {/* Chat-history saving preference */}
        <div className="mt-4 pb-5 border-b border-[#ECEAE3]">
          <label
            htmlFor="save-chat-history-checkbox"
            className="flex cursor-pointer items-start gap-3 min-h-[44px]"
          >
            <input
              id="save-chat-history-checkbox"
              type="checkbox"
              checked={preferences.saveChatHistory}
              onChange={(e) => onToggleChatSaving(e.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-[#2F5D50]"
            />
            <span>
              <span className="block text-sm font-medium text-[#1E2421]">
                Save chat history on this device
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[#4A5550]">
                Off by default. Turning this off immediately removes any previously saved
                chat messages from browser storage.
              </span>
            </span>
          </label>
        </div>

        {/* Reduced motion preference */}
        <fieldset className="mt-5">
          <legend className="text-sm font-medium text-[#1E2421]">
            Motion & transitions
          </legend>
          <p className="mt-1 text-xs text-[#5C6762]">
            System setting currently:{' '}
            {osPrefersReducedMotion ? 'Reduce motion on' : 'Standard motion'}
          </p>
          <div className="mt-3 space-y-2">
            {(
              [
                { id: 'system', label: 'Follow system setting (Default)' },
                { id: 'on', label: 'Always reduce motion' },
                { id: 'off', label: 'Allow gentle transitions' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.id}
                htmlFor={`motion-${opt.id}`}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-3.5 py-2.5 min-h-[44px] text-sm text-[#1E2421] hover:bg-[#F2F0EA]"
              >
                <input
                  id={`motion-${opt.id}`}
                  type="radio"
                  name="reduce-motion-pref"
                  value={opt.id}
                  checked={preferences.reduceMotion === opt.id}
                  onChange={() => onChangeMotionSetting(opt.id)}
                  className="h-4 w-4 accent-[#2F5D50]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Daily reminders schedule */}
        <div className="mt-6 border-t border-[#ECEAE3] pt-5">
          <h3 className="text-sm font-medium text-[#1E2421]">
            Daily reminders
          </h3>
          <p className="mt-1 mb-3 text-xs leading-relaxed text-[#5C6762]">
            Set gentle local times for your morning check-in and evening reflection
            reminders.
          </p>
          <ReminderScheduleEditor
            schedule={reminderSchedule}
            onSaveSchedule={onSaveReminderSchedule}
            idPrefix="profile-reminder"
          />
        </div>
      </section>

      {/* Privacy & Local Data Controls */}
      <section
        aria-labelledby="privacy-data-heading"
        className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#2F5D50]" aria-hidden="true" />
          <h2
            id="privacy-data-heading"
            className="font-display text-xl font-medium text-[#1E2421]"
          >
            Privacy and local data
          </h2>
        </div>

        <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#4A5550]">
          <p>
            <strong>Shared browser notice:</strong> Local browser storage is not an
            encrypted vault and does not isolate separate names on a shared device. Anyone
            using this browser profile may view or clear saved entries.
          </p>
          <p>
            <strong>Device-only storage:</strong> Data does not sync automatically across
            devices and can be cleared by browser privacy settings.
          </p>
          <p>
            <strong>AI provider note:</strong> Deleting local data removes records from
            this browser; it cannot recall chat messages already sent to an external AI
            provider.
          </p>
        </div>

        <div className="mt-5 space-y-3 border-t border-[#ECEAE3] pt-5">
          <button
            type="button"
            onClick={onClearChat}
            disabled={!hasAnyChatMessages && !preferences.saveChatHistory}
            className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#D5D3CA] bg-[#FAF9F6] px-4 py-2.5 text-sm font-medium text-[#1E2421] transition-colors hover:bg-[#F2F0EA] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Clear chat history</span>
          </button>

          <button
            type="button"
            onClick={onRequestDeleteAll}
            className="w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#E2B5B5] bg-[#FDF2F2] px-4 py-2.5 text-sm font-medium text-[#9B2C2C] transition-colors hover:bg-[#F9E3E3] whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Delete all local data</span>
          </button>
        </div>
      </section>
    </div>
  );
}
