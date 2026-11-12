/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import type { NavDestination, WellnessGoal } from './types/wellness';
import { useWellnessStore } from './hooks/useWellnessStore';
import { useEnvironmentState } from './hooks/useEnvironmentState';
import { useReminderNotifications } from './hooks/useReminderNotifications';
import { evaluateReminderState } from './lib/reminders';
import { AppShell } from './components/layout/AppShell';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { HomeView } from './features/home/HomeView';
import { SessionsView } from './features/sessions/SessionsView';
import { CoachView } from './features/coach/CoachView';
import { ProfileView } from './features/profile/ProfileView';

export default function App() {
  const store = useWellnessStore();
  const env = useEnvironmentState(store.preferences.reduceMotion);

  const [activeDestination, setActiveDestination] = useState<NavDestination>('home');
  const [focusCheckInSignal, setFocusCheckInSignal] = useState<number>(0);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [draftCoachPrompt, setDraftCoachPrompt] = useState<string | null>(null);

  const statistics = useMemo(
    () => store.computeStatistics(env.todayDateKey),
    [store, env.todayDateKey]
  );

  const evaluatedReminder = useMemo(
    () =>
      evaluateReminderState({
        schedule: store.reminderSchedule,
        todayDateKey: env.todayDateKey,
        nowMinutes: env.nowMinutes,
        todayHasEntry: statistics.mindfulStreak.todayHasEntry,
        todayHasSession: statistics.mindfulStreak.todayHasSession,
        dismissals: store.reminderDismissals,
      }),
    [
      store.reminderSchedule,
      store.reminderDismissals,
      env.todayDateKey,
      env.nowMinutes,
      statistics.mindfulStreak.todayHasEntry,
      statistics.mindfulStreak.todayHasSession,
    ]
  );

  useReminderNotifications(
    store.profile ? evaluatedReminder.dueReminder : null,
    env.todayDateKey,
    store.reminderSchedule.browserNotifications
  );

  const handleCompleteOnboarding = (preferredName: string, primaryGoal: WellnessGoal) => {
    store.completeOnboarding(preferredName, primaryGoal);
    setActiveDestination('home');
  };

  const handleDeleteAllLocalData = () => {
    store.deleteAllLocalData();
    setPendingSessionId(null);
    setDraftCoachPrompt(null);
    setActiveDestination('home');
  };

  if (!store.profile) {
    return (
      <OnboardingFlow
        storageAvailable={store.storageAvailable}
        storageNotice={store.storageNotice}
        onComplete={handleCompleteOnboarding}
      />
    );
  }

  return (
    <AppShell
      activeDestination={activeDestination}
      onNavigate={setActiveDestination}
      onQuickCheckInAction={() => {
        setActiveDestination('home');
        setFocusCheckInSignal((n) => n + 1);
      }}
      storageAvailable={store.storageAvailable}
      storageNotice={store.storageNotice}
      isOnline={env.isOnline}
    >
      {activeDestination === 'home' && (
        <HomeView
          profile={store.profile}
          todayDateKey={env.todayDateKey}
          todayEntry={store.entriesByDate[env.todayDateKey]}
          entriesByDate={store.entriesByDate}
          mindfulStreak={statistics.mindfulStreak}
          statistics={statistics}
          reminderSchedule={store.reminderSchedule}
          evaluatedReminder={evaluatedReminder}
          effectiveReducedMotion={env.effectiveReducedMotion}
          focusCheckInSignal={focusCheckInSignal}
          onFocusCheckIn={() => setFocusCheckInSignal((n) => n + 1)}
          onSaveDailyEntry={store.saveDailyEntry}
          onDismissReminderForToday={(slot) =>
            store.dismissReminderForToday(slot, env.todayDateKey)
          }
          onSaveReminderSchedule={store.updateReminderSchedule}
          onNavigate={setActiveDestination}
          onOpenSession={(sessionId) => {
            setPendingSessionId(sessionId);
            setActiveDestination('sessions');
          }}
          onAskCoachQuestion={(question) => {
            setDraftCoachPrompt(question);
            setActiveDestination('coach');
          }}
        />
      )}

      {activeDestination === 'sessions' && (
        <SessionsView
          primaryGoal={store.profile.primaryGoal}
          initialSessionId={pendingSessionId}
          effectiveReducedMotion={env.effectiveReducedMotion}
          completedSessions={store.completedSessions}
          onRecordSessionCompletion={store.recordSessionCompletion}
          onClearInitialSession={() => setPendingSessionId(null)}
        />
      )}

      {activeDestination === 'coach' && (
        <CoachView
          primaryGoal={store.profile.primaryGoal}
          messages={store.chatMessages}
          preferences={store.preferences}
          isOnline={env.isOnline}
          draftPrompt={draftCoachPrompt}
          onClearDraftPrompt={() => setDraftCoachPrompt(null)}
          onAppendMessages={store.appendChatMessages}
          onClearChatHistory={store.clearChatHistory}
          onAcknowledgeAiNotice={store.acknowledgeAiNotice}
          onNavigate={setActiveDestination}
        />
      )}

      {activeDestination === 'profile' && (
        <ProfileView
          profile={store.profile}
          preferences={store.preferences}
          reminderSchedule={store.reminderSchedule}
          osPrefersReducedMotion={env.osPrefersReducedMotion}
          statistics={statistics}
          hasAnyChatMessages={store.chatMessages.length > 0}
          onUpdateProfile={store.updateProfile}
          onUpdatePreferences={store.updatePreferences}
          onUpdateReminderSchedule={store.updateReminderSchedule}
          onClearChatHistory={store.clearChatHistory}
          onDeleteAllLocalData={handleDeleteAllLocalData}
        />
      )}
    </AppShell>
  );
}
