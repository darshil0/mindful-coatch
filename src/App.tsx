/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import type { NavDestination, WellnessGoal } from './types/wellness';
import { useWellnessStore } from './hooks/useWellnessStore';
import { useEnvironmentState } from './hooks/useEnvironmentState';
import { useReminderNotifications } from './hooks/useReminderNotifications';
import { useSessionPlayer } from './hooks/useSessionPlayer';
import { evaluateReminderState } from './lib/reminders';
import { AppShell } from './components/layout/AppShell';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { HomeView } from './features/home/HomeView';

const SessionsView = lazy(() => import('./features/sessions/SessionsView'));
const CoachView = lazy(() => import('./features/coach/CoachView'));
const ProfileView = lazy(() => import('./features/profile/ProfileView'));

const DESTINATION_TO_PATH: Record<NavDestination, string> = {
  home: '/',
  sessions: '/sessions',
  coach: '/coach',
  profile: '/profile',
};

export function resolveDestinationFromPathname(pathname: string): NavDestination {
  const normalized = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (normalized === '/sessions') return 'sessions';
  if (normalized === '/coach') return 'coach';
  if (normalized === '/profile') return 'profile';
  return 'home';
}

function ViewLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto max-w-4xl rounded-2xl border border-[#E6E4DD] bg-white p-8 text-center text-sm text-[#5C6762]"
    >
      Loading view…
    </div>
  );
}

export default function App() {
  const store = useWellnessStore();
  const { recordSessionCompletion, computeStatistics } = store;
  const env = useEnvironmentState(store.preferences.reduceMotion);

  const [activeDestination, setActiveDestination] = useState<NavDestination>(() =>
    typeof window !== 'undefined'
      ? resolveDestinationFromPathname(window.location.pathname)
      : 'home'
  );
  const [focusCheckInSignal, setFocusCheckInSignal] = useState<number>(0);
  const [draftCoachPrompt, setDraftCoachPrompt] = useState<string | null>(null);

  // Sync client-side destination with browser History API (`/` `/sessions` `/coach` `/profile`, L9)
  const navigateTo = useCallback((destination: NavDestination) => {
    setActiveDestination(destination);
    if (typeof window !== 'undefined') {
      const targetPath = DESTINATION_TO_PATH[destination];
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ destination }, '', targetPath);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      setActiveDestination(resolveDestinationFromPathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleRecordSessionCompletion = useCallback(
    (record: Parameters<typeof recordSessionCompletion>[0]) => {
      recordSessionCompletion(record, env.todayDateKey);
    },
    [recordSessionCompletion, env.todayDateKey]
  );

  const sessionPlayer = useSessionPlayer({
    onRecordSessionCompletion: handleRecordSessionCompletion,
  });

  const statistics = useMemo(
    () => computeStatistics(env.todayDateKey),
    [computeStatistics, env.todayDateKey]
  );

  const evaluatedReminder = useMemo(
    () =>
      evaluateReminderState({
        schedule: store.reminderSchedule,
        todayDateKey: env.todayDateKey,
        nowMinutes: env.nowMinutes,
        todayHasEntry: statistics.mindfulStreak.todayHasEntry,
        todayHasSession: statistics.mindfulStreak.todayHasSession,
        completedSessions: store.completedSessions,
        dismissals: store.reminderDismissals,
      }),
    [
      store.reminderSchedule,
      store.reminderDismissals,
      store.completedSessions,
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
    navigateTo('home');
  };

  const handleDeleteAllLocalData = () => {
    sessionPlayer.resetPlayer();
    store.deleteAllLocalData();
    setDraftCoachPrompt(null);
    navigateTo('home');
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
      onNavigate={navigateTo}
      onQuickCheckInAction={() => {
        navigateTo('home');
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
          nowMinutes={env.nowMinutes}
          todayEntry={store.entriesByDate[env.todayDateKey]}
          entriesByDate={store.entriesByDate}
          mindfulStreak={statistics.mindfulStreak}
          statistics={statistics}
          reminderSchedule={store.reminderSchedule}
          evaluatedReminder={evaluatedReminder}
          effectiveReducedMotion={env.effectiveReducedMotion}
          focusCheckInSignal={focusCheckInSignal}
          onFocusCheckIn={() => setFocusCheckInSignal((n) => n + 1)}
          onSaveDailyEntry={(entry) => store.saveDailyEntry(entry, env.todayDateKey)}
          onDismissReminderForToday={(slot) =>
            store.dismissReminderForToday(slot, env.todayDateKey)
          }
          onSaveReminderSchedule={(next) =>
            store.updateReminderSchedule(next, env.todayDateKey)
          }
          onNavigate={navigateTo}
          onOpenSession={(sessionId) => {
            sessionPlayer.openSessionById(sessionId);
            navigateTo('sessions');
          }}
          onAskCoachQuestion={(question) => {
            setDraftCoachPrompt(question);
            navigateTo('coach');
          }}
        />
      )}

      {activeDestination === 'sessions' && (
        <Suspense fallback={<ViewLoadingFallback />}>
          <SessionsView
            primaryGoal={store.profile.primaryGoal}
            effectiveReducedMotion={env.effectiveReducedMotion}
            completedSessions={store.completedSessions}
            player={sessionPlayer}
          />
        </Suspense>
      )}

      {activeDestination === 'coach' && (
        <Suspense fallback={<ViewLoadingFallback />}>
          <CoachView
            primaryGoal={store.profile.primaryGoal}
            messages={store.chatMessages}
            preferences={store.preferences}
            isOnline={env.isOnline}
            draftPrompt={draftCoachPrompt}
            onClearDraftPrompt={() => setDraftCoachPrompt(null)}
            onAppendMessages={store.appendChatMessages}
            onReplaceLastFallbackMessage={store.replaceLastFallbackMessage}
            onClearChatHistory={store.clearChatHistory}
            onAcknowledgeAiNotice={store.acknowledgeAiNotice}
            onNavigate={navigateTo}
          />
        </Suspense>
      )}

      {activeDestination === 'profile' && (
        <Suspense fallback={<ViewLoadingFallback />}>
          <ProfileView
            profile={store.profile}
            preferences={store.preferences}
            reminderSchedule={store.reminderSchedule}
            osPrefersReducedMotion={env.osPrefersReducedMotion}
            statistics={statistics}
            hasAnyChatMessages={store.chatMessages.length > 0}
            onUpdateProfile={store.updateProfile}
            onUpdatePreferences={store.updatePreferences}
            onUpdateReminderSchedule={(next) =>
              store.updateReminderSchedule(next, env.todayDateKey)
            }
            onClearChatHistory={store.clearChatHistory}
            onDeleteAllLocalData={handleDeleteAllLocalData}
          />
        </Suspense>
      )}
    </AppShell>
  );
}
