import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEYS,
  type StorageLike,
  WellnessStorageStore,
} from '../src/services/storageService';

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

test('storage persists profile & daily entries by date, recovers from malformed JSON, and honors chat privacy', () => {
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

  // Enabling saveChatHistory persists chat; turning it back off deletes persisted chat
  store.savePreferences({
    saveChatHistory: true,
    reduceMotion: 'system',
    acknowledgedAiNotice: true,
  });
  store.saveChatMessages(sampleChat, true);
  assert.notEqual(mock.getItem(STORAGE_KEYS.CHAT), null);

  store.savePreferences({
    saveChatHistory: false,
    reduceMotion: 'system',
    acknowledgedAiNotice: true,
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

  // Corrupt JSON in entries safely recovers without throwing
  mock.setItem(STORAGE_KEYS.ENTRIES, '{bad json');
  const recovered = new WellnessStorageStore(mock).hydrate();
  assert.deepEqual(recovered.entriesByDate, {});
  assert.equal(recovered.profile?.preferredName, 'Maya');

  // Delete all local data clears everything
  store.deleteAllLocalData();
  const afterDelete = new WellnessStorageStore(mock).hydrate();
  assert.equal(afterDelete.profile, null);
  assert.deepEqual(afterDelete.entriesByDate, {});
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

  // Day 1 entry + Day 2 session -> 2-day Mindful Streak persisted in STORAGE_KEYS.STREAK
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

  // Corrupt streak JSON safely recalculates from entries + sessions on hydrate
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

  // On a new calendar day, previous day's dismissals are automatically pruned
  const hydratedNextDay = new WellnessStorageStore(mock).hydrate('2026-11-13');
  assert.deepEqual(hydratedNextDay.reminderDismissals, {});
  assert.equal(hydratedNextDay.reminderSchedule.morning.time, '07:45');

  // Corrupt JSON recovers safely to defaults
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

  // Clearing the reflective note when no other metrics exist removes the entry cleanly
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

