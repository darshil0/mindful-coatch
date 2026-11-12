import type {
  ChatMessage,
  CompletedSessionRecord,
  DailyEntry,
  MindfulStreakState,
  ReduceMotionSetting,
  UserPreferences,
  UserProfile,
} from '../types/wellness';
import { getLocalDateKey, isValidDateKey } from '../lib/dateUtils';
import { computeMindfulStreak } from '../lib/wellnessMetrics';
import { isValidWellnessGoal, validatePreferredName } from '../lib/validation';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  SCHEMA: 'mindful_coach.v1.schema',
  PROFILE: 'mindful_coach.v1.profile',
  ENTRIES: 'mindful_coach.v1.entries',
  SESSIONS: 'mindful_coach.v1.sessions',
  STREAK: 'mindful_coach.v1.streak',
  PREFERENCES: 'mindful_coach.v1.preferences',
  CHAT: 'mindful_coach.v1.chat',
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_PREFERENCES: UserPreferences = {
  saveChatHistory: false,
  reduceMotion: 'system',
  acknowledgedAiNotice: false,
};

export interface HydratedWellnessState {
  profile: UserProfile | null;
  entriesByDate: Record<string, DailyEntry>;
  completedSessions: CompletedSessionRecord[];
  mindfulStreak: MindfulStreakState;
  preferences: UserPreferences;
  chatMessages: ChatMessage[];
  storageAvailable: boolean;
  storageNotice: string | null;
}

export class WellnessStorageStore {
  private memoryFallback = new Map<string, string>();
  private browserStorage: StorageLike | null = null;
  private persistentAvailable = true;
  private notice: string | null = null;

  constructor(injectedStorage?: StorageLike | null) {
    if (injectedStorage !== undefined) {
      this.browserStorage = injectedStorage;
      this.persistentAvailable = this.probeStorage(injectedStorage);
    } else if (typeof window !== 'undefined') {
      try {
        this.browserStorage = window.localStorage;
        this.persistentAvailable = this.probeStorage(this.browserStorage);
      } catch {
        this.browserStorage = null;
        this.persistentAvailable = false;
      }
    } else {
      this.browserStorage = null;
      this.persistentAvailable = false;
    }

    if (!this.persistentAvailable) {
      this.notice =
        'Local browser storage is unavailable right now. Mindful Coach will work normally during this visit, though changes may not remain after closing this tab.';
    }
  }

  private probeStorage(storage: StorageLike | null): boolean {
    if (!storage) return false;
    const probeKey = 'mindful_coach.v1.__probe__';
    try {
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }

  public isPersistentAvailable(): boolean {
    return this.persistentAvailable;
  }

  public getNotice(): string | null {
    return this.notice;
  }

  private readRaw(key: string): string | null {
    if (this.persistentAvailable && this.browserStorage) {
      try {
        const val = this.browserStorage.getItem(key);
        if (val !== null) return val;
      } catch {
        this.persistentAvailable = false;
        this.notice =
          'Browser storage could not be accessed. Your changes are kept in memory for this session.';
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  private writeRaw(key: string, value: string): boolean {
    this.memoryFallback.set(key, value);
    if (this.persistentAvailable && this.browserStorage) {
      try {
        this.browserStorage.setItem(key, value);
        return true;
      } catch {
        this.persistentAvailable = false;
        this.notice =
          'Browser storage is full or restricted. Your changes remain active in memory for this visit, though new updates may not persist after closing this tab.';
        return false;
      }
    }
    return false;
  }

  private removeRaw(key: string): void {
    this.memoryFallback.delete(key);
    if (this.browserStorage) {
      try {
        this.browserStorage.removeItem(key);
      } catch {
        // Ignore removal errors on restricted storage
      }
    }
  }

  public hydrate(todayDateKey: string = getLocalDateKey()): HydratedWellnessState {
    const preferences = this.loadPreferences();
    const profile = this.loadProfile();
    const entriesByDate = this.loadEntries();
    const completedSessions = this.loadCompletedSessions();
    const mindfulStreak = this.recalculateAndSaveStreak(
      entriesByDate,
      completedSessions,
      todayDateKey
    );
    const chatMessages = preferences.saveChatHistory ? this.loadChatMessages() : [];

    // Ensure persisted chat is removed if saveChatHistory is disabled
    if (!preferences.saveChatHistory) {
      this.removeRaw(STORAGE_KEYS.CHAT);
    }

    if (this.persistentAvailable) {
      this.writeRaw(STORAGE_KEYS.SCHEMA, String(CURRENT_SCHEMA_VERSION));
    }

    return {
      profile,
      entriesByDate,
      completedSessions,
      mindfulStreak,
      preferences,
      chatMessages,
      storageAvailable: this.persistentAvailable,
      storageNotice: this.notice,
    };
  }

  public loadProfile(): UserProfile | null {
    const raw = this.readRaw(STORAGE_KEYS.PROFILE);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') return null;
      const nameRaw = typeof parsed.preferredName === 'string' ? parsed.preferredName : '';
      const nameCheck = validatePreferredName(nameRaw);
      if (!nameCheck.valid || !isValidWellnessGoal(parsed.primaryGoal)) {
        return null;
      }
      const nowIso = new Date().toISOString();
      return {
        preferredName: nameCheck.value,
        primaryGoal: parsed.primaryGoal,
        createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : nowIso,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso,
      };
    } catch {
      return null;
    }
  }

  public saveProfile(profile: UserProfile): void {
    this.writeRaw(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }

  public loadEntries(): Record<string, DailyEntry> {
    const raw = this.readRaw(STORAGE_KEYS.ENTRIES);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const clean: Record<string, DailyEntry> = {};
      for (const [dateKey, item] of Object.entries(parsed)) {
        if (!isValidDateKey(dateKey) || !item || typeof item !== 'object') {
          continue;
        }
        const rec = item as Record<string, unknown>;
        const energyRating =
          typeof rec.energyRating === 'number' &&
          Number.isInteger(rec.energyRating) &&
          rec.energyRating >= 1 &&
          rec.energyRating <= 10
            ? rec.energyRating
            : null;
        const steps =
          typeof rec.steps === 'number' &&
          Number.isSafeInteger(rec.steps) &&
          rec.steps >= 0 &&
          rec.steps <= 250000
            ? rec.steps
            : null;
        const sleepMinutes =
          typeof rec.sleepMinutes === 'number' &&
          Number.isInteger(rec.sleepMinutes) &&
          rec.sleepMinutes >= 0 &&
          rec.sleepMinutes <= 1440
            ? rec.sleepMinutes
            : null;

        if (energyRating === null && steps === null && sleepMinutes === null) {
          continue;
        }

        clean[dateKey] = {
          date: dateKey,
          energyRating,
          steps,
          sleepMinutes,
          updatedAt:
            typeof rec.updatedAt === 'string' ? rec.updatedAt : new Date().toISOString(),
        };
      }
      return clean;
    } catch {
      return {};
    }
  }

  public saveEntries(entriesByDate: Record<string, DailyEntry>): void {
    this.writeRaw(STORAGE_KEYS.ENTRIES, JSON.stringify(entriesByDate));
  }

  public upsertDailyEntry(
    entry: DailyEntry,
    todayDateKey: string = getLocalDateKey()
  ): Record<string, DailyEntry> {
    const current = this.loadEntries();
    const updated: Record<string, DailyEntry> = { ...current };
    if (
      entry.energyRating === null &&
      entry.steps === null &&
      entry.sleepMinutes === null
    ) {
      delete updated[entry.date];
    } else {
      updated[entry.date] = entry;
    }
    this.saveEntries(updated);
    this.recalculateAndSaveStreak(updated, this.loadCompletedSessions(), todayDateKey);
    return updated;
  }

  public loadCompletedSessions(): CompletedSessionRecord[] {
    const raw = this.readRaw(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const seenRunIds = new Set<string>();
      const valid: CompletedSessionRecord[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        if (
          typeof rec.runId !== 'string' ||
          !rec.runId ||
          seenRunIds.has(rec.runId) ||
          typeof rec.sessionId !== 'string' ||
          typeof rec.title !== 'string' ||
          typeof rec.durationSeconds !== 'number' ||
          rec.durationSeconds <= 0 ||
          typeof rec.completedAt !== 'string' ||
          !isValidDateKey(rec.date)
        ) {
          continue;
        }
        seenRunIds.add(rec.runId);
        valid.push({
          completionId:
            typeof rec.completionId === 'string' ? rec.completionId : rec.runId,
          runId: rec.runId,
          sessionId: rec.sessionId,
          title: rec.title,
          durationSeconds: Math.round(rec.durationSeconds),
          completedAt: rec.completedAt,
          date: rec.date,
        });
      }
      return valid;
    } catch {
      return [];
    }
  }

  public saveCompletedSessions(sessions: CompletedSessionRecord[]): void {
    this.writeRaw(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  }

  public loadMindfulStreak(
    todayDateKey: string = getLocalDateKey()
  ): MindfulStreakState {
    const raw = this.readRaw(STORAGE_KEYS.STREAK);
    if (!raw) {
      return computeMindfulStreak({}, [], todayDateKey);
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return computeMindfulStreak({}, [], todayDateKey);
      }
      const currentStreak =
        typeof parsed.currentStreak === 'number' &&
        Number.isInteger(parsed.currentStreak) &&
        parsed.currentStreak >= 0
          ? parsed.currentStreak
          : 0;
      const longestStreak =
        typeof parsed.longestStreak === 'number' &&
        Number.isInteger(parsed.longestStreak) &&
        parsed.longestStreak >= 0
          ? parsed.longestStreak
          : 0;
      const totalActiveDays =
        typeof parsed.totalActiveDays === 'number' &&
        Number.isInteger(parsed.totalActiveDays) &&
        parsed.totalActiveDays >= 0
          ? parsed.totalActiveDays
          : 0;
      const lastActiveDate = isValidDateKey(parsed.lastActiveDate)
        ? parsed.lastActiveDate
        : null;
      return {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        activeToday: parsed.activeToday === true && lastActiveDate === todayDateKey,
        todayHasEntry: parsed.todayHasEntry === true && lastActiveDate === todayDateKey,
        todayHasSession:
          parsed.todayHasSession === true && lastActiveDate === todayDateKey,
        totalActiveDays,
        lastActiveDate,
        updatedAt:
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
    } catch {
      return computeMindfulStreak({}, [], todayDateKey);
    }
  }

  public saveMindfulStreak(streak: MindfulStreakState): void {
    this.writeRaw(STORAGE_KEYS.STREAK, JSON.stringify(streak));
  }

  public recalculateAndSaveStreak(
    entriesByDate: Record<string, DailyEntry>,
    completedSessions: CompletedSessionRecord[],
    todayDateKey: string = getLocalDateKey()
  ): MindfulStreakState {
    const streak = computeMindfulStreak(entriesByDate, completedSessions, todayDateKey);
    if (streak.totalActiveDays > 0 || this.readRaw(STORAGE_KEYS.STREAK) !== null) {
      this.saveMindfulStreak(streak);
    }
    return streak;
  }

  public loadPreferences(): UserPreferences {
    const raw = this.readRaw(STORAGE_KEYS.PREFERENCES);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_PREFERENCES };
      }
      const reduceMotion: ReduceMotionSetting =
        parsed.reduceMotion === 'on' ||
        parsed.reduceMotion === 'off' ||
        parsed.reduceMotion === 'system'
          ? parsed.reduceMotion
          : 'system';

      return {
        saveChatHistory: parsed.saveChatHistory === true,
        reduceMotion,
        acknowledgedAiNotice: parsed.acknowledgedAiNotice === true,
      };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  public savePreferences(preferences: UserPreferences): void {
    this.writeRaw(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    if (!preferences.saveChatHistory) {
      this.removeRaw(STORAGE_KEYS.CHAT);
    }
  }

  public loadChatMessages(): ChatMessage[] {
    const raw = this.readRaw(STORAGE_KEYS.CHAT);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const clean: ChatMessage[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        if (
          typeof rec.id !== 'string' ||
          (rec.role !== 'user' && rec.role !== 'assistant') ||
          typeof rec.content !== 'string' ||
          rec.content.trim().length === 0
        ) {
          continue;
        }
        clean.push({
          id: rec.id,
          role: rec.role,
          content: rec.content.slice(0, 4000),
          createdAt:
            typeof rec.createdAt === 'string'
              ? rec.createdAt
              : new Date().toISOString(),
          mode: rec.mode === 'live' ? 'live' : 'demo',
          isCrisisNotice: rec.isCrisisNotice === true,
          isFallbackFromError: rec.isFallbackFromError === true,
        });
      }
      return clean.slice(-50);
    } catch {
      return [];
    }
  }

  public saveChatMessages(messages: ChatMessage[], saveEnabled: boolean): void {
    if (!saveEnabled) {
      this.removeRaw(STORAGE_KEYS.CHAT);
      return;
    }
    this.writeRaw(STORAGE_KEYS.CHAT, JSON.stringify(messages.slice(-50)));
  }

  public clearChatHistory(): void {
    this.removeRaw(STORAGE_KEYS.CHAT);
  }

  public deleteAllLocalData(): void {
    for (const key of Object.values(STORAGE_KEYS)) {
      this.removeRaw(key);
    }
    this.memoryFallback.clear();
  }
}
