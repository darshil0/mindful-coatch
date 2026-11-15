import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeCompletedSessionsByRunId,
  mergeEntriesByUpdatedAt,
  STORAGE_KEYS,
  type StorageLike,
  WellnessStorageStore,
} from '../src/services/storageService';
import { CURRENT_AI_CONSENT_VERSION } from '../src/types/wellness';

class MockStorage implements StorageLike {
  public data = new Map<string, string>();
  public failWrites = false;

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('QuotaExceededError');
    }
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

test('storage persists profile & daily entries by date, recovers from malformed JSON with bounded backup, and honors consent versioning & chat privacy (M1/L6)', () => {
  const mock = new MockStorage();
  const store = new WellnessStorageStore(mock);

  store.saveProfile({
    preferredName: 'Maya',
    primaryGoal: 'sleep',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  });

  store.upsertDailyEntry({
    date: '2026-11-01',
    energyRating: 7,
    steps: 4200,
    sleepMinutes: 450,
    updatedAt: '2026-11-01T21:00:00.000Z',
  });

  // Saving a new date does not overwrite the previous day
  store.upsertDailyEntry({
    date: '2026-11-02',
    energyRating: 9,
    steps: 0,
    sleepMinutes: null,
    updatedAt: '2026-11-02T08:00:00.000Z',
  });

  // Default saveChatHistory is false -> chat is NOT persisted to storage
  const sampleChat = [
    {
      id: 'm1',
      role: 'user' as const,
      content: 'Help me wind down tonight',
      createdAt: '2026-11-02T08:05:00.000Z',
      mode: 'demo' as const,
    },
  ];
  store.saveChatMessages(sampleChat, false);
  assert.equal(mock.getItem(STORAGE_KEYS.CHAT), null);

  // Legacy unversioned acknowledgedAiNotice resets consent safely (M1)
  mock.setItem(
    STORAGE_KEYS.PREFERENCES,
    JSON.stringify({
      saveChatHistory: true,
      reduceMotion: 'system',
      acknowledgedAiNotice: true,
    })
  );
  const upgradedPrefs = new WellnessStorageStore(mock).loadPreferences();
  assert.equal(upgradedPrefs.saveChatHistory, true);
  assert.equal(upgradedPrefs.acknowledgedAiNotice, false);
  assert.equal(upgradedPrefs.aiConsentVersion, null);

  // Versioned consent persists cleanly; turning off saveChatHistory deletes persisted chat
  store.savePreferences({
    saveChatHistory: true,
    reduceMotion: 'system',
    acknowledgedAiNotice: true,
    aiConsentVersion: CURRENT_AI_CONSENT_VERSION,
  });
  store.saveChatMessages(sampleChat, true);
  assert.notEqual(mock.getItem(STORAGE_KEYS.CHAT), null);
  assert.equal(new WellnessStorageStore(mock).loadPreferences().acknowledgedAiNotice, true);

  store.savePreferences({
    saveChatHistory: false,
    reduceMotion: 'system',
    acknowledgedAiNotice: true,
    aiConsentVersion: CURRENT_AI_CONSENT_VERSION,
  });
  assert.equal(mock.getItem(STORAGE_KEYS.CHAT), null);

  // Simulate reload with fresh store instance
  const reloaded = new WellnessStorageStore(mock).hydrate();
  assert.equal(reloaded.profile?.preferredName, 'Maya');
  assert.equal(reloaded.entriesByDate['2026-11-01']?.steps, 4200);
  assert.equal(reloaded.entriesByDate['2026-11-02']?.steps, 0);
  assert.equal(reloaded.entriesByDate['2026-11-02']?.sleepMinutes, null);
  assert.equal(reloaded.chatMessages.length, 0);

  // Clearing all metrics removes the date key cleanly while preserving other days
  store.upsertDailyEntry({
    date: '2026-11-02',
    energyRating: null,
    steps: null,
    sleepMinutes: null,
    updatedAt: '2026-11-02T11:00:00.000Z',
  });
  assert.equal(store.loadEntries()['2026-11-02'], undefined);
  assert.equal(store.loadEntries()['2026-11-01']?.steps, 4200);

  // Corrupt JSON in entries safely recovers AND stores bounded corrupt backup (L6)
  mock.setItem(STORAGE_KEYS.ENTRIES, '{bad json sample');
  const recovered = new WellnessStorageStore(mock).hydrate();
  assert.deepEqual(recovered.entriesByDate, {});
  assert.equal(recovered.profile?.preferredName, 'Maya');
  const backupRaw = mock.getItem(STORAGE_KEYS.CORRUPT_BACKUP);
  assert.ok(backupRaw);
  assert.match(backupRaw, /\{bad json sample/);

  // Delete all local data clears data AND writes deletion tombstone in META (M6)
  store.deleteAllLocalData();
  const afterDelete = new WellnessStorageStore(mock).hydrate();
  assert.equal(afterDelete.profile, null);
  assert.deepEqual(afterDelete.entriesByDate, {});
  assert.ok(store.getDeletedAtEpochMs() > 0);
});

test('storage stays usable in memory when browser storage is unavailable', () => {
  const unavailableStore = new WellnessStorageStore(null);
  assert.equal(unavailableStore.isPersistentAvailable(), false);
  assert.ok(unavailableStore.getNotice());

  unavailableStore.saveProfile({
    preferredName: 'Jordan',
    primaryGoal: 'energy',
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-02T10:00:00.000Z',
  });
  assert.equal(unavailableStore.loadProfile()?.preferredName, 'Jordan');
});

test('storage persists and reconciles Mindful Streaks from daily entries and completed sessions', () => {
  const mock = new MockStorage();
  const store = new WellnessStorageStore(mock);

  store.upsertDailyEntry(
    {
      date: '2026-11-11',
      energyRating: 7,
      steps: null,
      sleepMinutes: null,
      updatedAt: '2026-11-11T09:00:00.000Z',
    },
    '2026-11-12'
  );
  store.saveCompletedSessions([
    {
      completionId: 'c1',
      runId: 'r1',
      sessionId: 'mindfulness',
      title: 'Mindfulness',
      durationSeconds: 300,
      completedAt: '2026-11-12T10:00:00.000Z',
      date: '2026-11-12',
    },
  ]);

  const hydrated = new WellnessStorageStore(mock).hydrate('2026-11-12');
  assert.equal(hydrated.mindfulStreak.currentStreak, 2);
  assert.equal(hydrated.mindfulStreak.longestStreak, 2);
  assert.equal(hydrated.mindfulStreak.activeToday, true);
  assert.equal(hydrated.mindfulStreak.todayHasEntry, false);
  assert.equal(hydrated.mindfulStreak.todayHasSession, true);

  const persistedStreak = new WellnessStorageStore(mock).loadMindfulStreak('2026-11-12');
  assert.equal(persistedStreak.currentStreak, 2);
  assert.equal(persistedStreak.lastActiveDate, '2026-11-12');

  mock.setItem(STORAGE_KEYS.STREAK, '{broken');
  assert.equal(
    new WellnessStorageStore(mock).loadMindfulStreak('2026-11-12').currentStreak,
    0
  );
  assert.equal(
    new WellnessStorageStore(mock).hydrate('2026-11-12').mindfulStreak.currentStreak,
    2
  );

  store.deleteAllLocalData();
  assert.equal(mock.getItem(STORAGE_KEYS.STREAK), null);
});

test('storage persists reminder schedule, prunes stale dismissals on date change, and clears on reset', () => {
  const mock = new MockStorage();
  const store = new WellnessStorageStore(mock);

  store.saveReminders(
    {
      morning: { enabled: true, time: '07:45' },
      evening: { enabled: true, time: '21:15' },
      browserNotifications: false,
    },
    {
      '2026-11-11': { evening: true },
      '2026-11-12': { morning: true },
    },
    '2026-11-12'
  );

  const hydratedToday = new WellnessStorageStore(mock).hydrate('2026-11-12');
  assert.equal(hydratedToday.reminderSchedule.morning.time, '07:45');
  assert.equal(hydratedToday.reminderSchedule.evening.time, '21:15');
  assert.deepEqual(hydratedToday.reminderDismissals, {
    '2026-11-12': { morning: true },
  });

  const hydratedNextDay = new WellnessStorageStore(mock).hydrate('2026-11-13');
  assert.deepEqual(hydratedNextDay.reminderDismissals, {});
  assert.equal(hydratedNextDay.reminderSchedule.morning.time, '07:45');

  mock.setItem(STORAGE_KEYS.REMINDERS, '{not valid');
  const recovered = new WellnessStorageStore(mock).loadReminders('2026-11-13');
  assert.equal(recovered.schedule.morning.time, '08:30');
  assert.deepEqual(recovered.dismissals, {});

  store.deleteAllLocalData();
  assert.equal(mock.getItem(STORAGE_KEYS.REMINDERS), null);
});

test('storage persists reflectiveNote entries, supports note-only check-ins, and cleans up empty entries', () => {
  const mock = new MockStorage();
  const store = new WellnessStorageStore(mock);

  store.upsertDailyEntry(
    {
      date: '2026-11-11',
      energyRating: null,
      steps: null,
      sleepMinutes: null,
      reflectiveNote: '  Slept early and felt rested.  ',
      updatedAt: '2026-11-11T21:00:00.000Z',
    },
    '2026-11-12'
  );

  const hydrated = new WellnessStorageStore(mock).hydrate('2026-11-12');
  assert.equal(
    hydrated.entriesByDate['2026-11-11']?.reflectiveNote,
    'Slept early and felt rested.'
  );
  assert.equal(hydrated.mindfulStreak.currentStreak, 1);

  store.upsertDailyEntry(
    {
      date: '2026-11-11',
      energyRating: null,
      steps: null,
      sleepMinutes: null,
      reflectiveNote: '   ',
      updatedAt: '2026-11-11T21:10:00.000Z',
    },
    '2026-11-12'
  );
  assert.equal(store.loadEntries()['2026-11-11'], undefined);
});

test('storage retries and recovers after transient write errors (M5) and merges multi-tab data cleanly (M6)', () => {
  const mock = new MockStorage();
  mock.setItem(
    STORAGE_KEYS.PROFILE,
    JSON.stringify({
      preferredName: 'Sam',
      primaryGoal: 'stress',
      createdAt: '2026-11-10T09:00:00.000Z',
      updatedAt: '2026-11-10T09:00:00.000Z',
    })
  );
  mock.setItem(
    STORAGE_KEYS.STREAK,
    JSON.stringify({
      currentStreak: 4,
      longestStreak: 4,
      activeToday: false,
      todayHasEntry: false,
      todayHasSession: false,
      totalActiveDays: 4,
      lastActiveDate: '2026-11-05',
      updatedAt: '2026-11-05T20:00:00.000Z',
    })
  );

  const store = new WellnessStorageStore(mock);
  assert.equal(store.loadMindfulStreak('2026-11-14').currentStreak, 0);

  store.hydrate('2026-11-14');
  // Transient write failure
  mock.failWrites = true;
  store.savePreferences({
    saveChatHistory: false,
    reduceMotion: 'on',
    acknowledgedAiNotice: false,
    aiConsentVersion: null,
  });
  assert.equal(store.isPersistentAvailable(), false);
  assert.ok(store.getNotice());
  // Newly written value & hydrated profile remain readable via memory fallback
  assert.equal(store.loadPreferences().reduceMotion, 'on');
  assert.equal(store.loadProfile()?.preferredName, 'Sam');

  // Once storage recovers, next write heals persistentHealthy & clears notice (M5)
  mock.failWrites = false;
  store.savePreferences({
    saveChatHistory: false,
    reduceMotion: 'off',
    acknowledgedAiNotice: false,
    aiConsentVersion: null,
  });
  assert.equal(store.isPersistentAvailable(), true);
  assert.equal(store.getNotice(), null);
  assert.equal(new WellnessStorageStore(mock).loadPreferences().reduceMotion, 'off');

  // Conflict-safe merge helpers (M6)
  const mergedEntries = mergeEntriesByUpdatedAt(
    {
      '2026-11-14': {
        date: '2026-11-14',
        energyRating: 8,
        steps: null,
        sleepMinutes: null,
        updatedAt: '2026-11-14T12:00:00.000Z',
      },
    },
    {
      '2026-11-14': {
        date: '2026-11-14',
        energyRating: 5,
        steps: 3000,
        sleepMinutes: null,
        updatedAt: '2026-11-14T09:00:00.000Z', // older -> should lose to newer local entry
      },
      '2026-11-13': {
        date: '2026-11-13',
        energyRating: 7,
        steps: null,
        sleepMinutes: null,
        updatedAt: '2026-11-13T10:00:00.000Z',
      },
    }
  );
  assert.equal(mergedEntries['2026-11-14']?.energyRating, 8);
  assert.equal(mergedEntries['2026-11-13']?.energyRating, 7);

  const mergedSessions = mergeCompletedSessionsByRunId(
    [
      {
        completionId: 'c1',
        runId: 'run-1',
        sessionId: 'mindfulness',
        title: 'Mindfulness',
        durationSeconds: 180,
        completedAt: '2026-11-14T10:00:00.000Z',
        date: '2026-11-14',
      },
    ],
    [
      {
        completionId: 'c1',
        runId: 'run-1',
        sessionId: 'mindfulness',
        title: 'Mindfulness',
        durationSeconds: 180,
        completedAt: '2026-11-14T10:00:00.000Z',
        date: '2026-11-14',
      },
      {
        completionId: 'c2',
        runId: 'run-2',
        sessionId: 'gentle-breathing',
        title: 'Gentle breathing',
        durationSeconds: 120,
        completedAt: '2026-11-14T18:00:00.000Z',
        date: '2026-11-14',
      },
    ]
  );
  assert.equal(mergedSessions.length, 2);
});
