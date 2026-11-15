import {
  CURRENT_AI_CONSENT_VERSION,
  type ChatMessage,
  type CompletedSessionRecord,
  type DailyEntry,
  type MindfulStreakState,
  type ReduceMotionSetting,
  type ReminderDismissalsByDate,
  type ReminderSchedule,
  type UserPreferences,
  type UserProfile,
} from '../types/wellness';
import { getLocalDateKey, isValidDateKey, shiftLocalDateKey } from '../lib/dateUtils';
import {
  computeMindfulStreak,
  hasAnyRecordedMetric,
} from '../lib/wellnessMetrics';
import {
  DEFAULT_REMINDER_SCHEDULE,
  pruneDismissalsToDate,
  sanitizeReminderSchedule,
} from '../lib/reminders';
import {
  isValidWellnessGoal,
  normalizeDailyEntry,
  validatePreferredName,
} from '../lib/validation';

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
  REMINDERS: 'mindful_coach.v1.reminders',
  PREFERENCES: 'mindful_coach.v1.preferences',
  CHAT: 'mindful_coach.v1.chat',
  NOTIFIED_REMINDERS: 'mindful_coach.v1.notified',
  META: 'mindful_coach.v1.meta',
  CORRUPT_BACKUP: 'mindful_coach.v1.corrupt_backup',
} as const;

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_PREFERENCES: UserPreferences = {
  saveChatHistory: false,
  reduceMotion: 'system',
  acknowledgedAiNotice: false,
  aiConsentVersion: null,
};

export interface StorageSyncMeta {
  revision: number;
  deletedAtEpochMs: number;
}

export interface HydratedWellnessState {
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
}

function parseIsoMs(iso: string | undefined | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Merges two DailyEntry maps by `date` using the newer `updatedAt` ISO timestamp.
 */
export function mergeEntriesByUpdatedAt(
  baseEntries: Record<string, DailyEntry>,
  incomingEntries: Record<string, DailyEntry>
): Record<string, DailyEntry> {
  const merged: Record<string, DailyEntry> = { ...baseEntries };
  for (const [dateKey, incoming] of Object.entries(incomingEntries)) {
    if (!isValidDateKey(dateKey) || !hasAnyRecordedMetric(incoming)) continue;
    const existing = merged[dateKey];
    if (!existing || parseIsoMs(incoming.updatedAt) >= parseIsoMs(existing.updatedAt)) {
      merged[dateKey] = incoming;
    }
  }
  return merged;
}

/**
 * Merges two CompletedSessionRecord arrays using set union by `runId`,
 * sorted chronologically descending by `completedAt`.
 */
export function mergeCompletedSessionsByRunId(
  baseSessions: CompletedSessionRecord[],
  incomingSessions: CompletedSessionRecord[]
): CompletedSessionRecord[] {
  const byRunId = new Map<string, CompletedSessionRecord>();
  for (const item of [...incomingSessions, ...baseSessions]) {
    if (!item.runId || !isValidDateKey(item.date)) continue;
    if (!byRunId.has(item.runId)) {
      byRunId.set(item.runId, item);
    }
  }
  return Array.from(byRunId.values()).sort(
    (a, b) => parseIsoMs(b.completedAt) - parseIsoMs(a.completedAt)
  );
}

export class WellnessStorageStore {
  private memoryFallback = new Map<string, string>();
  private browserStorage: StorageLike | null = null;
  private storageSupported = false;
  private persistentHealthy = false;
  private notice: string | null = null;
  private deletedAtEpochMs = 0;

  constructor(injectedStorage?: StorageLike | null) {
    if (injectedStorage !== undefined) {
      this.browserStorage = injectedStorage;
      this.storageSupported = injectedStorage !== null;
      this.persistentHealthy = this.probeStorage(injectedStorage);
    } else if (typeof window !== 'undefined') {
      try {
        this.browserStorage = window.localStorage;
        this.storageSupported = Boolean(this.browserStorage);
        this.persistentHealthy = this.probeStorage(this.browserStorage);
      } catch {
        this.browserStorage = null;
        this.storageSupported = false;
        this.persistentHealthy = false;
      }
    } else {
      this.browserStorage = null;
      this.storageSupported = false;
      this.persistentHealthy = false;
    }

    if (!this.persistentHealthy) {
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
    return this.persistentHealthy;
  }

  public getNotice(): string | null {
    return this.notice;
  }

  private recordCorruptBackup(sourceKey: string, rawSample: string): void {
    if (!this.browserStorage || sourceKey === STORAGE_KEYS.CORRUPT_BACKUP) return;
    try {
      const existingRaw = this.browserStorage.getItem(STORAGE_KEYS.CORRUPT_BACKUP);
      const existing: { key: string; savedAt: string; sample: string }[] = existingRaw
        ? JSON.parse(existingRaw)
        : [];
      const list = Array.isArray(existing) ? existing : [];
      list.unshift({
        key: sourceKey,
        savedAt: new Date().toISOString(),
        sample: rawSample.slice(0, 2048),
      });
      this.browserStorage.setItem(
        STORAGE_KEYS.CORRUPT_BACKUP,
        JSON.stringify(list.slice(0, 3))
      );
    } catch {
      // Best-effort backup only; never throw or wipe other keys
    }
  }

  private readMeta(): StorageSyncMeta {
    const raw = this.readRaw(STORAGE_KEYS.META);
    if (!raw) return { revision: 0, deletedAtEpochMs: 0 };
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        revision:
          typeof parsed.revision === 'number' && Number.isFinite(parsed.revision)
            ? parsed.revision
            : 0,
        deletedAtEpochMs:
          typeof parsed.deletedAtEpochMs === 'number' &&
          Number.isFinite(parsed.deletedAtEpochMs)
            ? parsed.deletedAtEpochMs
            : 0,
      };
    } catch {
      return { revision: 0, deletedAtEpochMs: 0 };
    }
  }

  public getDeletedAtEpochMs(): number {
    return Math.max(this.deletedAtEpochMs, this.readMeta().deletedAtEpochMs);
  }

  private bumpMeta(deletionEpochMs?: number): void {
    const current = this.readMeta();
    const nextDeletedAt = Math.max(
      current.deletedAtEpochMs,
      this.deletedAtEpochMs,
      deletionEpochMs ?? 0
    );
    this.deletedAtEpochMs = nextDeletedAt;
    const next: StorageSyncMeta = {
      revision: current.revision + 1,
      deletedAtEpochMs: nextDeletedAt,
    };
    this.writeRaw(STORAGE_KEYS.META, JSON.stringify(next));
  }

  /**
   * Attempts reading directly from `browserStorage` even after a prior transient failure
   * (M5) instead of permanently latching storage off.
   */
  private readRaw(key: string): string | null {
    if (!this.persistentHealthy && this.memoryFallback.has(key)) {
      return this.memoryFallback.get(key) ?? null;
    }
    if (this.storageSupported && this.browserStorage) {
      try {
        const val = this.browserStorage.getItem(key);
        if (!this.persistentHealthy) {
          this.persistentHealthy = true;
          this.notice = null;
        }
        if (val !== null) {
          this.memoryFallback.set(key, val);
          return val;
        }
        return null;
      } catch {
        this.persistentHealthy = false;
        this.notice =
          'Browser storage could not be accessed temporarily. Mindful Coach will retry on your next save.';
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  /**
   * Always retries persistence on `browserStorage` if supported so transient quota/lock
   * errors recover automatically on subsequent successful saves (M5).
   */
  private writeRaw(key: string, value: string): boolean {
    this.memoryFallback.set(key, value);
    if (this.storageSupported && this.browserStorage) {
      try {
        this.browserStorage.setItem(key, value);
        this.persistentHealthy = true;
        this.notice = null;
        return true;
      } catch {
        this.persistentHealthy = false;
        this.notice =
          'Browser storage is full or restricted right now. Changes stay active in this tab and will retry saving on future updates.';
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
    const meta = this.readMeta();
    this.deletedAtEpochMs = meta.deletedAtEpochMs;
    const preferences = this.loadPreferences();
    const profile = this.loadProfile();
    const entriesByDate = this.loadEntries();
    const completedSessions = this.loadCompletedSessions();
    const mindfulStreak = this.recalculateAndSaveStreak(
      entriesByDate,
      completedSessions,
      todayDateKey
    );
    const { schedule: reminderSchedule, dismissals: reminderDismissals } =
      this.loadReminders(todayDateKey);
    const chatMessages = preferences.saveChatHistory ? this.loadChatMessages() : [];

    if (!preferences.saveChatHistory) {
      this.removeRaw(STORAGE_KEYS.CHAT);
    }

    if (this.storageSupported) {
      this.writeRaw(STORAGE_KEYS.SCHEMA, String(CURRENT_SCHEMA_VERSION));
    }

    return {
      profile,
      entriesByDate,
      completedSessions,
      mindfulStreak,
      reminderSchedule,
      reminderDismissals,
      preferences,
      chatMessages,
      storageAvailable: this.persistentHealthy,
      storageNotice: this.notice,
    };
  }

  public loadProfile(): UserProfile | null {
    const raw = this.readRaw(STORAGE_KEYS.PROFILE);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.recordCorruptBackup(STORAGE_KEYS.PROFILE, raw);
        return null;
      }
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
      this.recordCorruptBackup(STORAGE_KEYS.PROFILE, raw);
      return null;
    }
  }

  public saveProfile(profile: UserProfile): void {
    this.writeRaw(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    this.bumpMeta();
  }

  public loadEntries(): Record<string, DailyEntry> {
    const raw = this.readRaw(STORAGE_KEYS.ENTRIES);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        this.recordCorruptBackup(STORAGE_KEYS.ENTRIES, raw);
        return {};
      }
      const clean: Record<string, DailyEntry> = {};
      for (const [dateKey, item] of Object.entries(parsed)) {
        if (!isValidDateKey(dateKey) || !item || typeof item !== 'object') {
          continue;
        }
        const rec = item as Record<string, unknown>;
        const normalized = normalizeDailyEntry({
          date: dateKey,
          energyRating: rec.energyRating as number | null,
          steps: rec.steps as number | null,
          sleepMinutes: rec.sleepMinutes as number | null,
          reflectiveNote:
            typeof rec.reflectiveNote === 'string' ? rec.reflectiveNote : null,
          updatedAt:
            typeof rec.updatedAt === 'string'
              ? rec.updatedAt
              : new Date().toISOString(),
        });

        if (!hasAnyRecordedMetric(normalized)) {
          continue;
        }

        clean[dateKey] = normalized;
      }
      return clean;
    } catch {
      this.recordCorruptBackup(STORAGE_KEYS.ENTRIES, raw);
      return {};
    }
  }

  public saveEntries(entriesByDate: Record<string, DailyEntry>): void {
    this.writeRaw(STORAGE_KEYS.ENTRIES, JSON.stringify(entriesByDate));
    this.bumpMeta();
  }

  public upsertDailyEntry(
    entry: DailyEntry,
    todayDateKey: string = getLocalDateKey()
  ): Record<string, DailyEntry> {
    const current = this.loadEntries();
    if (!isValidDateKey(entry.date)) {
      return current;
    }
    const updated: Record<string, DailyEntry> = { ...current };
    const normalizedEntry = normalizeDailyEntry(entry);
    if (!hasAnyRecordedMetric(normalizedEntry)) {
      delete updated[entry.date];
    } else {
      updated[entry.date] = normalizedEntry;
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
      if (!Array.isArray(parsed)) {
        this.recordCorruptBackup(STORAGE_KEYS.SESSIONS, raw);
        return [];
      }
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
      this.recordCorruptBackup(STORAGE_KEYS.SESSIONS, raw);
      return [];
    }
  }

  public saveCompletedSessions(sessions: CompletedSessionRecord[]): void {
    this.writeRaw(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    this.bumpMeta();
  }

  public loadMindfulStreak(
    todayDateKey: string = getLocalDateKey()
  ): MindfulStreakState {
    const safeTodayDateKey = isValidDateKey(todayDateKey)
      ? todayDateKey
      : getLocalDateKey();
    const raw = this.readRaw(STORAGE_KEYS.STREAK);
    if (!raw) {
      return computeMindfulStreak({}, [], safeTodayDateKey);
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return computeMindfulStreak({}, [], safeTodayDateKey);
      }
      const rawCurrentStreak =
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
      const yesterdayDateKey = shiftLocalDateKey(safeTodayDateKey, -1);
      const streakStillAlive =
        lastActiveDate !== null &&
        lastActiveDate <= safeTodayDateKey &&
        lastActiveDate >= yesterdayDateKey;
      const currentStreak = streakStillAlive ? rawCurrentStreak : 0;

      return {
        currentStreak,
        longestStreak: Math.max(longestStreak, currentStreak),
        activeToday: parsed.activeToday === true && lastActiveDate === safeTodayDateKey,
        todayHasEntry:
          parsed.todayHasEntry === true && lastActiveDate === safeTodayDateKey,
        todayHasSession:
          parsed.todayHasSession === true && lastActiveDate === safeTodayDateKey,
        totalActiveDays,
        lastActiveDate,
        updatedAt:
          typeof parsed.updatedAt === 'string'
            ? parsed.updatedAt
            : new Date().toISOString(),
      };
    } catch {
      return computeMindfulStreak({}, [], safeTodayDateKey);
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
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ...DEFAULT_PREFERENCES };
      }
      const reduceMotion: ReduceMotionSetting =
        parsed.reduceMotion === 'on' ||
        parsed.reduceMotion === 'off' ||
        parsed.reduceMotion === 'system'
          ? parsed.reduceMotion
          : 'system';

      const acknowledged = parsed.acknowledgedAiNotice === true;
      const aiConsentVersion =
        typeof parsed.aiConsentVersion === 'number' &&
        Number.isInteger(parsed.aiConsentVersion)
          ? parsed.aiConsentVersion
          : null;

      return {
        saveChatHistory: parsed.saveChatHistory === true,
        reduceMotion,
        acknowledgedAiNotice:
          acknowledged && aiConsentVersion === CURRENT_AI_CONSENT_VERSION,
        aiConsentVersion:
          acknowledged && aiConsentVersion === CURRENT_AI_CONSENT_VERSION
            ? CURRENT_AI_CONSENT_VERSION
            : null,
      };
    } catch {
      this.recordCorruptBackup(STORAGE_KEYS.PREFERENCES, raw);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  public savePreferences(preferences: UserPreferences): void {
    this.writeRaw(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    if (!preferences.saveChatHistory) {
      this.removeRaw(STORAGE_KEYS.CHAT);
    }
    this.bumpMeta();
  }

  public loadReminders(todayDateKey: string = getLocalDateKey()): {
    schedule: ReminderSchedule;
    dismissals: ReminderDismissalsByDate;
  } {
    const raw = this.readRaw(STORAGE_KEYS.REMINDERS);
    const fallback = {
      schedule: sanitizeReminderSchedule(DEFAULT_REMINDER_SCHEDULE),
      dismissals: {} as ReminderDismissalsByDate,
    };
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fallback;
      }
      const schedule = sanitizeReminderSchedule(parsed.schedule);
      const rawDismissals =
        parsed.dismissals &&
        typeof parsed.dismissals === 'object' &&
        !Array.isArray(parsed.dismissals)
          ? (parsed.dismissals as ReminderDismissalsByDate)
          : {};
      return {
        schedule,
        dismissals: pruneDismissalsToDate(rawDismissals, todayDateKey),
      };
    } catch {
      this.recordCorruptBackup(STORAGE_KEYS.REMINDERS, raw);
      return fallback;
    }
  }

  public saveReminders(
    schedule: ReminderSchedule,
    dismissals: ReminderDismissalsByDate,
    todayDateKey: string = getLocalDateKey()
  ): void {
    this.writeRaw(
      STORAGE_KEYS.REMINDERS,
      JSON.stringify({
        schedule: sanitizeReminderSchedule(schedule),
        dismissals: pruneDismissalsToDate(dismissals, todayDateKey),
      })
    );
    this.bumpMeta();
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
      this.recordCorruptBackup(STORAGE_KEYS.CHAT, raw);
      return [];
    }
  }

  public saveChatMessages(messages: ChatMessage[], saveEnabled: boolean): void {
    if (!saveEnabled) {
      this.removeRaw(STORAGE_KEYS.CHAT);
      return;
    }
    this.writeRaw(STORAGE_KEYS.CHAT, JSON.stringify(messages.slice(-50)));
    this.bumpMeta();
  }

  public clearChatHistory(): void {
    this.removeRaw(STORAGE_KEYS.CHAT);
    this.bumpMeta();
  }

  public deleteAllLocalData(): void {
    const deletionTs = Date.now();
    this.deletedAtEpochMs = deletionTs;
    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.META) continue;
      this.removeRaw(key);
    }
    this.memoryFallback.clear();
    // Preserve deletion tombstone across tabs so a stale tab cannot resurrect deleted data
    this.writeRaw(
      STORAGE_KEYS.META,
      JSON.stringify({ revision: 1, deletedAtEpochMs: deletionTs })
    );
  }
}
