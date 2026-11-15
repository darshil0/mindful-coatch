import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CURRENT_AI_CONSENT_VERSION,
  type ChatMessage,
  type CompletedSessionRecord,
  type DailyEntry,
  type MindfulStreakState,
  type ReminderDismissalsByDate,
  type ReminderSchedule,
  type ReminderSlotId,
  type UserPreferences,
  type UserProfile,
  type WellnessGoal,
  type WellnessStatistics,
} from '../types/wellness';
import {
  DEFAULT_PREFERENCES,
  mergeCompletedSessionsByRunId,
  mergeEntriesByUpdatedAt,
  STORAGE_KEYS,
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
  updateReminderSchedule: (nextSchedule: ReminderSchedule, todayDateKey?: string) => void;
  dismissReminderForToday: (slot: ReminderSlotId, todayDateKey?: string) => void;
  appendChatMessages: (added: ChatMessage[]) => void;
  replaceLastFallbackMessage: (replacement: ChatMessage) => void;
  clearChatHistory: () => void;
  updateProfile: (preferredName: string, primaryGoal: WellnessGoal) => void;
  updatePreferences: (nextPrefs: UserPreferences) => void;
  acknowledgeAiNotice: () => void;
  deleteAllLocalData: () => void;
}

const KNOWN_STORAGE_KEYS = new Set<string>(Object.values(STORAGE_KEYS));

function isAutostartAllowed(): boolean {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
  if (!metaEnv) {
    return (
      typeof process !== 'undefined' && process.env.VITE_ENABLE_TEST_AUTOSTART === 'true'
    );
  }
  return metaEnv.DEV === true || metaEnv.VITE_ENABLE_TEST_AUTOSTART === 'true';
}

export function useWellnessStore(): WellnessStoreHookResult {
  const [store] = useState(() => new WellnessStorageStore());
  const [initialMeta] = useState(() => ({
    hydrated: store.hydrate(),
    deletedAt: store.getDeletedAtEpochMs(),
  }));
  const initialHydrated = initialMeta.hydrated;
  const seenDeletionEpochRef = useRef<number>(initialMeta.deletedAt);

  const [profile, setProfile] = useState<UserProfile | null>(initialHydrated.profile);
  const profileRef = useRef<UserProfile | null>(initialHydrated.profile);

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
  const reminderScheduleRef = useRef<ReminderSchedule>(initialHydrated.reminderSchedule);
  const reminderDismissalsRef = useRef<ReminderDismissalsByDate>(
    initialHydrated.reminderDismissals
  );
  const entriesRef = useRef<Record<string, DailyEntry>>(initialHydrated.entriesByDate);
  const sessionsRef = useRef<CompletedSessionRecord[]>(initialHydrated.completedSessions);
  const saveChatHistoryRef = useRef<boolean>(initialHydrated.preferences.saveChatHistory);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    initialHydrated.chatMessages
  );
  const chatMessagesRef = useRef<ChatMessage[]>(initialHydrated.chatMessages);

  useEffect(() => {
    profileRef.current = profile;
    entriesRef.current = entriesByDate;
    sessionsRef.current = completedSessions;
    preferencesRef.current = preferences;
    saveChatHistoryRef.current = preferences.saveChatHistory;
    reminderScheduleRef.current = reminderSchedule;
    reminderDismissalsRef.current = reminderDismissals;
    chatMessagesRef.current = chatMessages;
  }, [
    profile,
    entriesByDate,
    completedSessions,
    preferences,
    reminderSchedule,
    reminderDismissals,
    chatMessages,
  ]);

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

  // Idempotent `?autostart=1` setup inside effect (never in render/useMemo) gated strictly by dev/test flag (L5)
  useEffect(() => {
    if (typeof window === 'undefined' || !isAutostartAllowed()) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') !== '1') {
      return;
    }
    const timer = window.setTimeout(() => {
      if (profileRef.current !== null) return;
      const existing = store.loadProfile();
      if (existing) {
        profileRef.current = existing;
        setProfile(existing);
        return;
      }
      const nowIso = new Date().toISOString();
      const autoProfile: UserProfile = {
        preferredName: 'Alex',
        primaryGoal: 'sleep',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      profileRef.current = autoProfile;
      store.saveProfile(autoProfile);
      setProfile(autoProfile);
      syncStorageHealth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [store, syncStorageHealth]);

  // M6: Cross-tab storage synchronization with conflict-safe merge & deletion tombstones
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== null && !KNOWN_STORAGE_KEYS.has(event.key)) {
        return;
      }

      const todayKey = getLocalDateKey();
      const latestDeletedEpoch = store.getDeletedAtEpochMs();
      if (latestDeletedEpoch > seenDeletionEpochRef.current) {
        seenDeletionEpochRef.current = latestDeletedEpoch;
        const fresh = store.hydrate(todayKey);
        profileRef.current = fresh.profile;
        entriesRef.current = fresh.entriesByDate;
        sessionsRef.current = fresh.completedSessions;
        preferencesRef.current = fresh.preferences;
        saveChatHistoryRef.current = fresh.preferences.saveChatHistory;
        reminderScheduleRef.current = fresh.reminderSchedule;
        reminderDismissalsRef.current = fresh.reminderDismissals;
        chatMessagesRef.current = fresh.chatMessages;

        setProfile(fresh.profile);
        setEntriesByDate(fresh.entriesByDate);
        setCompletedSessions(fresh.completedSessions);
        setMindfulStreak(fresh.mindfulStreak);
        setReminderSchedule(fresh.reminderSchedule);
        setReminderDismissals(fresh.reminderDismissals);
        setPreferences(fresh.preferences);
        setChatMessages(fresh.chatMessages);
        syncStorageHealth();
        return;
      }

      const incomingProfile = store.loadProfile();
      const incomingPrefs = store.loadPreferences();
      const incomingEntries = store.loadEntries();
      const incomingSessions = store.loadCompletedSessions();
      const { schedule: incomingSchedule, dismissals: incomingDismissals } =
        store.loadReminders(todayKey);

      const mergedEntries =
        event.key === STORAGE_KEYS.ENTRIES || event.key === null
          ? mergeEntriesByUpdatedAt(entriesRef.current, incomingEntries)
          : incomingEntries;
      const mergedSessions = mergeCompletedSessionsByRunId(
        sessionsRef.current,
        incomingSessions
      );

      profileRef.current = incomingProfile;
      entriesRef.current = mergedEntries;
      sessionsRef.current = mergedSessions;
      preferencesRef.current = incomingPrefs;
      saveChatHistoryRef.current = incomingPrefs.saveChatHistory;
      reminderScheduleRef.current = incomingSchedule;
      reminderDismissalsRef.current = incomingDismissals;

      setProfile(incomingProfile);
      setEntriesByDate(mergedEntries);
      setCompletedSessions(mergedSessions);
      setMindfulStreak(computeMindfulStreak(mergedEntries, mergedSessions, todayKey));
      setPreferences(incomingPrefs);
      setReminderSchedule(incomingSchedule);
      setReminderDismissals(incomingDismissals);

      if (incomingPrefs.saveChatHistory) {
        const nextChat = store.loadChatMessages();
        chatMessagesRef.current = nextChat;
        setChatMessages(nextChat);
      } else {
        chatMessagesRef.current = [];
        setChatMessages([]);
      }
      syncStorageHealth();
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [store, syncStorageHealth]);

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
      const persistedEntries = store.loadEntries();
      const base = mergeEntriesByUpdatedAt(entriesRef.current, persistedEntries);
      const next = { ...base };
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
      const latestPersisted = store.loadCompletedSessions();
      const mergedBase = mergeCompletedSessionsByRunId(
        sessionsRef.current,
        latestPersisted
      );
      const next = appendUniqueCompletion(mergedBase, record);
      sessionsRef.current = next;
      store.saveCompletedSessions(next);
      setCompletedSessions(next);

      const nextStreak = store.recalculateAndSaveStreak(
        entriesRef.current,
        next,
        todayDateKey
      );
      setMindfulStreak(nextStreak);
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
    if (
      preferencesRef.current.acknowledgedAiNotice &&
      preferencesRef.current.aiConsentVersion === CURRENT_AI_CONSENT_VERSION
    ) {
      return;
    }
    const next: UserPreferences = {
      ...preferencesRef.current,
      acknowledgedAiNotice: true,
      aiConsentVersion: CURRENT_AI_CONSENT_VERSION,
    };
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
    seenDeletionEpochRef.current = store.getDeletedAtEpochMs();
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
