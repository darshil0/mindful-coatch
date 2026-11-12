import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  ChatMessage,
  CompletedSessionRecord,
  DailyEntry,
  MindfulStreakState,
  UserPreferences,
  UserProfile,
  WellnessGoal,
  WellnessStatistics,
} from '../types/wellness';
import {
  DEFAULT_PREFERENCES,
  WellnessStorageStore,
} from '../services/storageService';
import {
  computeMindfulStreak,
  computeWellnessStatistics,
  hasAnyRecordedMetric,
} from '../lib/wellnessMetrics';
import { getLocalDateKey } from '../lib/dateUtils';
import { appendUniqueCompletion } from '../lib/sessionTimer';

export interface WellnessStoreHookResult {
  profile: UserProfile | null;
  entriesByDate: Record<string, DailyEntry>;
  completedSessions: CompletedSessionRecord[];
  mindfulStreak: MindfulStreakState;
  preferences: UserPreferences;
  chatMessages: ChatMessage[];
  storageAvailable: boolean;
  storageNotice: string | null;
  computeStatistics: (todayDateKey: string) => WellnessStatistics;
  completeOnboarding: (preferredName: string, primaryGoal: WellnessGoal) => void;
  saveDailyEntry: (entry: DailyEntry) => void;
  recordSessionCompletion: (record: CompletedSessionRecord) => void;
  appendChatMessages: (added: ChatMessage[]) => void;
  clearChatHistory: () => void;
  updateProfile: (preferredName: string, primaryGoal: WellnessGoal) => void;
  updatePreferences: (nextPrefs: UserPreferences) => void;
  acknowledgeAiNotice: () => void;
  deleteAllLocalData: () => void;
}

export function useWellnessStore(): WellnessStoreHookResult {
  const storeRef = useRef<WellnessStorageStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new WellnessStorageStore();
  }
  const store = storeRef.current;

  const initialHydrated = useMemo(() => {
    const hydrated = store.hydrate();
    // Support `?autostart=1` query hook for automated direct-to-dashboard inspection when no profile exists yet
    if (
      !hydrated.profile &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1'
    ) {
      const nowIso = new Date().toISOString();
      const autoProfile: UserProfile = {
        preferredName: 'Alex',
        primaryGoal: 'sleep',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      store.saveProfile(autoProfile);
      return {
        ...hydrated,
        profile: autoProfile,
      };
    }
    return hydrated;
  }, [store]);

  const [profile, setProfile] = useState<UserProfile | null>(initialHydrated.profile);
  const [entriesByDate, setEntriesByDate] = useState<Record<string, DailyEntry>>(
    initialHydrated.entriesByDate
  );
  const [completedSessions, setCompletedSessions] = useState<CompletedSessionRecord[]>(
    initialHydrated.completedSessions
  );
  const [mindfulStreak, setMindfulStreak] = useState<MindfulStreakState>(
    initialHydrated.mindfulStreak
  );
  const [preferences, setPreferences] = useState<UserPreferences>(
    initialHydrated.preferences
  );

  const entriesRef = useRef<Record<string, DailyEntry>>(initialHydrated.entriesByDate);
  entriesRef.current = entriesByDate;

  const sessionsRef = useRef<CompletedSessionRecord[]>(
    initialHydrated.completedSessions
  );
  sessionsRef.current = completedSessions;

  const saveChatHistoryRef = useRef<boolean>(initialHydrated.preferences.saveChatHistory);
  saveChatHistoryRef.current = preferences.saveChatHistory;

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialHydrated.chatMessages
  );
  const [storageAvailable, setStorageAvailable] = useState<boolean>(
    initialHydrated.storageAvailable
  );
  const [storageNotice, setStorageNotice] = useState<string | null>(
    initialHydrated.storageNotice
  );

  const syncStorageHealth = useCallback(() => {
    setStorageAvailable(store.isPersistentAvailable());
    setStorageNotice(store.getNotice());
  }, [store]);

  const completeOnboarding = useCallback(
    (preferredName: string, primaryGoal: WellnessGoal) => {
      const nowIso = new Date().toISOString();
      const newProfile: UserProfile = {
        preferredName,
        primaryGoal,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      store.saveProfile(newProfile);
      store.savePreferences(preferences);
      setProfile(newProfile);
      syncStorageHealth();
    },
    [preferences, store, syncStorageHealth]
  );

  const saveDailyEntry = useCallback(
    (entry: DailyEntry) => {
      const next = { ...entriesRef.current };
      if (hasAnyRecordedMetric(entry)) {
        next[entry.date] = entry;
      } else {
        delete next[entry.date];
      }
      entriesRef.current = next;
      store.saveEntries(next);
      setEntriesByDate(next);

      const nextStreak = store.recalculateAndSaveStreak(
        next,
        sessionsRef.current,
        getLocalDateKey()
      );
      setMindfulStreak(nextStreak);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const recordSessionCompletion = useCallback(
    (record: CompletedSessionRecord) => {
      const prev = sessionsRef.current;
      const next = appendUniqueCompletion(prev, record);
      if (next.length !== prev.length) {
        sessionsRef.current = next;
        store.saveCompletedSessions(next);
        setCompletedSessions(next);

        const nextStreak = store.recalculateAndSaveStreak(
          entriesRef.current,
          next,
          getLocalDateKey()
        );
        setMindfulStreak(nextStreak);
      }
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const appendChatMessages = useCallback(
    (added: ChatMessage[]) => {
      setChatMessages((prev) => {
        const next = [...prev, ...added].slice(-50);
        store.saveChatMessages(next, saveChatHistoryRef.current);
        return next;
      });
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const clearChatHistory = useCallback(() => {
    store.clearChatHistory();
    setChatMessages([]);
    syncStorageHealth();
  }, [store, syncStorageHealth]);

  const updateProfile = useCallback(
    (preferredName: string, primaryGoal: WellnessGoal) => {
      setProfile((prev) => {
        const nowIso = new Date().toISOString();
        const updated: UserProfile = {
          preferredName,
          primaryGoal,
          createdAt: prev?.createdAt ?? nowIso,
          updatedAt: nowIso,
        };
        store.saveProfile(updated);
        return updated;
      });
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const updatePreferences = useCallback(
    (nextPrefs: UserPreferences) => {
      setPreferences(nextPrefs);
      store.savePreferences(nextPrefs);
      if (nextPrefs.saveChatHistory) {
        store.saveChatMessages(chatMessages, true);
      }
      syncStorageHealth();
    },
    [chatMessages, store, syncStorageHealth]
  );

  const acknowledgeAiNotice = useCallback(() => {
    setPreferences((prev) => {
      if (prev.acknowledgedAiNotice) return prev;
      const next = { ...prev, acknowledgedAiNotice: true };
      store.savePreferences(next);
      return next;
    });
    syncStorageHealth();
  }, [store, syncStorageHealth]);

  const deleteAllLocalData = useCallback(() => {
    store.deleteAllLocalData();
    entriesRef.current = {};
    sessionsRef.current = [];
    setProfile(null);
    setEntriesByDate({});
    setCompletedSessions([]);
    setMindfulStreak(computeMindfulStreak({}, [], getLocalDateKey()));
    setPreferences({ ...DEFAULT_PREFERENCES });
    setChatMessages([]);
    syncStorageHealth();
  }, [store, syncStorageHealth]);

  const computeStatistics = useCallback(
    (todayDateKey: string) =>
      computeWellnessStatistics(entriesByDate, completedSessions, todayDateKey),
    [entriesByDate, completedSessions]
  );

  return {
    profile,
    entriesByDate,
    completedSessions,
    mindfulStreak,
    preferences,
    chatMessages,
    storageAvailable,
    storageNotice,
    computeStatistics,
    completeOnboarding,
    saveDailyEntry,
    recordSessionCompletion,
    appendChatMessages,
    clearChatHistory,
    updateProfile,
    updatePreferences,
    acknowledgeAiNotice,
    deleteAllLocalData,
  };
}
