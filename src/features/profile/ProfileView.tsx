import React, { useState } from 'react';
import type {
  ReduceMotionSetting,
  ReminderSchedule,
  UserPreferences,
  UserProfile,
  WellnessGoal,
  WellnessStatistics,
} from '../../types/wellness';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PrivacyAndPreferencesPanel } from './PrivacyAndPreferencesPanel';
import { ProfileEditorCard } from './ProfileEditorCard';
import { RecordedStatsCard } from './RecordedStatsCard';

interface ProfileViewProps {
  profile: UserProfile;
  preferences: UserPreferences;
  reminderSchedule: ReminderSchedule;
  osPrefersReducedMotion: boolean;
  statistics: WellnessStatistics;
  hasAnyChatMessages: boolean;
  onUpdateProfile: (preferredName: string, primaryGoal: WellnessGoal) => void;
  onUpdatePreferences: (next: UserPreferences) => void;
  onUpdateReminderSchedule: (next: ReminderSchedule) => void;
  onClearChatHistory: () => void;
  onDeleteAllLocalData: () => void;
}

export function ProfileView({
  profile,
  preferences,
  reminderSchedule,
  osPrefersReducedMotion,
  statistics,
  hasAnyChatMessages,
  onUpdateProfile,
  onUpdatePreferences,
  onUpdateReminderSchedule,
  onClearChatHistory,
  onDeleteAllLocalData,
}: ProfileViewProps) {
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleToggleChatSaving = (checked: boolean) => {
    onUpdatePreferences({
      ...preferences,
      saveChatHistory: checked,
    });
    setActionNotice(
      checked
        ? 'Chat history saving turned on for this browser.'
        : 'Chat history saving turned off and previously saved messages removed from browser storage.'
    );
  };

  const handleMotionChange = (setting: ReduceMotionSetting) => {
    onUpdatePreferences({
      ...preferences,
      reduceMotion: setting,
    });
    setActionNotice('Motion preference updated.');
  };

  const handleClearChat = () => {
    onClearChatHistory();
    setActionNotice('Cleared current and saved chat history.');
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="profile-page-heading">
        <p className="text-xs font-medium text-[#5C6762]">
          Local profile, preferences, and recorded activity
        </p>
        <h1
          id="profile-page-heading"
          className="mt-1 font-display text-3xl sm:text-4xl font-medium tracking-tight text-[#1E2421]"
        >
          Profile and statistics
        </h1>
      </section>

      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#CFE0D8] bg-[#EBF2EF] px-4 py-3 text-sm text-[#1F4238]"
        >
          {actionNotice}
        </div>
      )}

      <RecordedStatsCard statistics={statistics} />

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <ProfileEditorCard profile={profile} onUpdateProfile={onUpdateProfile} />

        <PrivacyAndPreferencesPanel
          preferences={preferences}
          reminderSchedule={reminderSchedule}
          osPrefersReducedMotion={osPrefersReducedMotion}
          hasAnyChatMessages={hasAnyChatMessages}
          onToggleChatSaving={handleToggleChatSaving}
          onChangeMotionSetting={handleMotionChange}
          onSaveReminderSchedule={(next) => {
            onUpdateReminderSchedule(next);
            setActionNotice('Daily reminder schedule saved.');
          }}
          onClearChat={handleClearChat}
          onRequestDeleteAll={() => setConfirmDeleteOpen(true)}
        />
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete all local data?"
        description="This permanently removes your preferred name, focus goal, daily tracking entries, completed sessions, preferences, and any locally saved chat history from this browser, and returns Mindful Coach to setup."
        secondaryNote="Note: Removing local browser data does not delete messages that were previously transmitted to an external AI provider."
        confirmLabel="Delete local data"
        cancelLabel="Keep my data"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDeleteAllLocalData();
        }}
      />
    </div>
  );
}
