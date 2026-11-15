import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  ChatMessage,
  CompletedSessionRecord,
  DailyEntry,
  MindfulStreakState,
  ReminderDismissalsByDate,
  ReminderSchedule,
  ReminderSlotId,
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
import {
  DEFAULT_REMINDER_SCHEDULE,
  pruneDismissalsToDate,
  sanitizeReminderSchedule,
} from '../lib/reminders';
import { getLocalDateKey } from '../lib/dateUtils';
import { appendUniqueCompletion } from '../lib/sessionTimer';
import { normalizeDailyEntry } from '../lib/validation';

export interface WellnessStoreHookResult {
  profile: UserProfile | null;
  entriesByDate: Record<string, DailyEntry>;
  completedSessions: CompletedSessionRecord[];
  mindfulStreak: MindfulStreakState;
  reminderSchedule: ReminderSchedule;
  reminderDismissals: ReminderDismissalsByDate;
  preferences: UserPreferences;
  chatMessages: ChatMessage[];
  storageAvailable: boolean;
  storageNotice: string | null;
  computeStatistics: (todayDateKey: string) => WellnessStatistics;
  completeOnboarding: (preferredName: string, primaryGoal: WellnessGoal) => void;
  saveDailyEntry: (entry: DailyEntry, todayDateKey?: string) => void;
  recordSessionCompletion: (
    record: CompletedSessionRecord,
    todayDateKey?: string
  ) => void;
  updateReminderSchedule: (
    nextSchedule: ReminderSchedule,
    todayDateKey?: string
  ) => void;
  dismissReminderForToday: (slot: ReminderSlotId, todayDateKey?: string) => void;
  appendChatMessages: (added: ChatMessage[]) => void;
  replaceLastFallbackMessage: (replacement: ChatMessage) => void;
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
  const profileRef = useRef<UserProfile | null>(initialHydrated.profile);
  profileRef.current = profile;

  const [entriesByDate, setEntriesByDate] = useState<Record<string, DailyEntry>>(
    initialHydrated.entriesByDate
  );
  const [completedSessions, setCompletedSessions] = useState<CompletedSessionRecord[]>(
    initialHydrated.completedSessions
  );
  const [mindfulStreak, setMindfulStreak] = useState<MindfulStreakState>(
    initialHydrated.mindfulStreak
  );
  const [reminderSchedule, setReminderSchedule] = useState<ReminderSchedule>(
    initialHydrated.reminderSchedule
  );
  const [reminderDismissals, setReminderDismissals] = useState<ReminderDismissalsByDate>(
    initialHydrated.reminderDismissals
  );
  const [preferences, setPreferences] = useState<UserPreferences>(
    initialHydrated.preferences
  );
  const preferencesRef = useRef<UserPreferences>(initialHydrated.preferences);
  preferencesRef.current = preferences;

  const reminderScheduleRef = useRef<ReminderSchedule>(initialHydrated.reminderSchedule);
  reminderScheduleRef.current = reminderSchedule;

  const reminderDismissalsRef = useRef<ReminderDismissalsByDate>(
    initialHydrated.reminderDismissals
  );
  reminderDismissalsRef.current = reminderDismissals;

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
  const chatMessagesRef = useRef<ChatMessage[]>(initialHydrated.chatMessages);
  chatMessagesRef.current = chatMessages;
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
      profileRef.current = newProfile;
      store.saveProfile(newProfile);
      store.savePreferences(preferencesRef.current);
      setProfile(newProfile);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const saveDailyEntry = useCallback(
    (entry: DailyEntry, todayDateKey: string = getLocalDateKey()) => {
      const normalized = normalizeDailyEntry(entry);
      const next = { ...entriesRef.current };
      if (hasAnyRecordedMetric(normalized)) {
        next[normalized.date] = normalized;
      } else {
        delete next[normalized.date];
      }
      entriesRef.current = next;
      store.saveEntries(next);
      setEntriesByDate(next);

      const nextStreak = store.recalculateAndSaveStreak(
        next,
        sessionsRef.current,
        todayDateKey
      );
      setMindfulStreak(nextStreak);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const recordSessionCompletion = useCallback(
    (record: CompletedSessionRecord, todayDateKey: string = getLocalDateKey()) => {
      const prev = sessionsRef.current;
      const next = appendUniqueCompletion(prev, record);
      if (next.length !== prev.length) {
        sessionsRef.current = next;
        store.saveCompletedSessions(next);
        setCompletedSessions(next);

        const nextStreak = store.recalculateAndSaveStreak(
          entriesRef.current,
          next,
          todayDateKey
        );
        setMindfulStreak(nextStreak);
      }
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const appendChatMessages = useCallback(
    (added: ChatMessage[]) => {
      const next = [...chatMessagesRef.current, ...added].slice(-50);
      chatMessagesRef.current = next;
      store.saveChatMessages(next, saveChatHistoryRef.current);
      setChatMessages(next);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const replaceLastFallbackMessage = useCallback(
    (replacement: ChatMessage) => {
      const prev = chatMessagesRef.current;
      const nextBase =
        prev.length > 0 && prev[prev.length - 1]?.isFallbackFromError
          ? prev.slice(0, -1)
          : prev;
      const next = [...nextBase, replacement].slice(-50);
      chatMessagesRef.current = next;
      store.saveChatMessages(next, saveChatHistoryRef.current);
      setChatMessages(next);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const clearChatHistory = useCallback(() => {
    store.clearChatHistory();
    chatMessagesRef.current = [];
    setChatMessages([]);
    syncStorageHealth();
  }, [store, syncStorageHealth]);

  const updateProfile = useCallback(
    (preferredName: string, primaryGoal: WellnessGoal) => {
      const nowIso = new Date().toISOString();
      const updated: UserProfile = {
        preferredName,
        primaryGoal,
        createdAt: profileRef.current?.createdAt ?? nowIso,
        updatedAt: nowIso,
      };
      profileRef.current = updated;
      store.saveProfile(updated);
      setProfile(updated);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const updatePreferences = useCallback(
    (nextPrefs: UserPreferences) => {
      preferencesRef.current = nextPrefs;
      saveChatHistoryRef.current = nextPrefs.saveChatHistory;
      setPreferences(nextPrefs);
      store.savePreferences(nextPrefs);
      if (nextPrefs.saveChatHistory) {
        store.saveChatMessages(chatMessagesRef.current, true);
      }
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const acknowledgeAiNotice = useCallback(() => {
    if (preferencesRef.current.acknowledgedAiNotice) return;
    const next = { ...preferencesRef.current, acknowledgedAiNotice: true };
    preferencesRef.current = next;
    store.savePreferences(next);
    setPreferences(next);
    syncStorageHealth();
  }, [store, syncStorageHealth]);

  const updateReminderSchedule = useCallback(
    (nextSchedule: ReminderSchedule, todayDateKey: string = getLocalDateKey()) => {
      const sanitized = sanitizeReminderSchedule(nextSchedule);
      reminderScheduleRef.current = sanitized;
      setReminderSchedule(sanitized);
      store.saveReminders(sanitized, reminderDismissalsRef.current, todayDateKey);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const dismissReminderForToday = useCallback(
    (slot: ReminderSlotId, todayDateKey: string = getLocalDateKey()) => {
      const pruned = pruneDismissalsToDate(reminderDismissalsRef.current, todayDateKey);
      const next: ReminderDismissalsByDate = {
        ...pruned,
        [todayDateKey]: {
          ...(pruned[todayDateKey] ?? {}),
          [slot]: true,
        },
      };
      reminderDismissalsRef.current = next;
      setReminderDismissals(next);
      store.saveReminders(reminderScheduleRef.current, next, todayDateKey);
      syncStorageHealth();
    },
    [store, syncStorageHealth]
  );

  const deleteAllLocalData = useCallback(() => {
    store.deleteAllLocalData();
    profileRef.current = null;
    entriesRef.current = {};
    sessionsRef.current = [];
    chatMessagesRef.current = [];
    const defaultPrefs = { ...DEFAULT_PREFERENCES };
    preferencesRef.current = defaultPrefs;
    saveChatHistoryRef.current = defaultPrefs.saveChatHistory;
    const defaultSchedule = sanitizeReminderSchedule(DEFAULT_REMINDER_SCHEDULE);
    reminderScheduleRef.current = defaultSchedule;
    reminderDismissalsRef.current = {};
    if (typeof window !== 'undefined' && window.location.search) {
      const url = new URL(window.location.href);
      if (url.searchParams.has('autostart')) {
        url.searchParams.delete('autostart');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }
    setProfile(null);
    setEntriesByDate({});
    setCompletedSessions([]);
    setMindfulStreak(computeMindfulStreak({}, [], getLocalDateKey()));
    setReminderSchedule(defaultSchedule);
    setReminderDismissals({});
    setPreferences(defaultPrefs);
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
    reminderSchedule,
    reminderDismissals,
    preferences,
    chatMessages,
    storageAvailable,
    storageNotice,
    computeStatistics,
    completeOnboarding,
    saveDailyEntry,
    recordSessionCompletion,
    updateReminderSchedule,
    dismissReminderForToday,
    appendChatMessages,
    replaceLastFallbackMessage,
    clearChatHistory,
    updateProfile,
    updatePreferences,
    acknowledgeAiNotice,
    deleteAllLocalData,
  };
}
