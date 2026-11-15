import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUniqueCompletion,
  DEFAULT_SESSION_COMPLETION_GRACE_MS,
  endSessionEarly,
  getActiveStepForElapsed,
  getSessionElapsedMs,
  pauseSessionTimer,
  resumeSessionTimer,
  startSessionTimer,
  syncSessionTimer,
} from '../src/lib/sessionTimer';
import { getLocalDateKey } from '../src/lib/dateUtils';
import { getSessionById } from '../src/data/guidedSessions';

test('session timer handles tab throttling via wall-clock timestamps, early exit, and single completion', () => {
  const t0 = 1_000_000;
  let timer = startSessionTimer('gentle-breathing', 120, t0, 'run-abc');
  assert.equal(timer.status, 'running');

  // Advance 45s -> pause
  timer = pauseSessionTimer(timer, t0 + 45_000);
  assert.equal(timer.status, 'paused');
  assert.equal(getSessionElapsedMs(timer, t0 + 100_000), 45_000);

  // Resume at t0 + 100s, then simulate background tab jump of 80s (total 125s >= 120s, within grace window)
  timer = resumeSessionTimer(timer, t0 + 100_000);
  timer = syncSessionTimer(timer, t0 + 180_000);
  assert.equal(timer.status, 'completed');
  assert.equal(getSessionElapsedMs(timer, t0 + 180_000), 120_000);

  // Completion timestamp records exact scheduled completion instant (t0 + 175s, not 180s wake-up)
  assert.equal(timer.completedAtIso, new Date(t0 + 175_000).toISOString());

  // Completion deduplication by runId
  const record = {
    completionId: 'comp-1',
    runId: 'run-abc',
    sessionId: 'gentle-breathing',
    title: 'Gentle breathing',
    durationSeconds: 120,
    completedAt: '2026-11-02T12:00:00.000Z',
    date: '2026-11-02',
  };
  const once = appendUniqueCompletion([], record);
  const twice = appendUniqueCompletion(once, record);
  assert.equal(twice.length, 1);

  // Early exit before completion never completes
  let earlyRun = startSessionTimer('mindfulness', 180, t0, 'run-early');
  earlyRun = endSessionEarly(earlyRun, t0 + 30_000);
  assert.equal(earlyRun.status, 'ended_early');
  assert.equal(earlyRun.completedAtIso, null);

  // Step mapping advances proportionally across session duration
  const session = getSessionById('gentle-breathing');
  assert.ok(session);
  assert.equal(getActiveStepForElapsed(session.steps, 0, 120_000).index, 0);
  assert.equal(getActiveStepForElapsed(session.steps, 95_000, 120_000).index, 3);
});

test('session timer enforces grace window, midnight-crossing accuracy, pause-after-done, and NaN/negative guards (M3)', () => {
  // 1. Clicking End or Pause 1s AFTER timer elapsed inside grace window completes accurately at t0 + 60s
  const startAt = new Date(2026, 10, 14, 23, 58, 30, 0).getTime(); // 23:58:30 local
  const running = startSessionTimer('mindfulness', 60, startAt, 'run-elapsed-early');
  const endedAt61 = endSessionEarly(running, startAt + 61_000);
  assert.equal(endedAt61.status, 'completed');
  assert.equal(endedAt61.completedAtIso, new Date(startAt + 60_000).toISOString());

  // Same for Pause after elapsed
  const pausedAt62 = pauseSessionTimer(running, startAt + 62_000);
  assert.equal(pausedAt62.status, 'completed');

  // 2. Midnight crossing: started 23:59:30 local for 60s -> wakes at 00:02:00 -> completedAtIso is 00:00:30 local next day
  const beforeMidnight = new Date(2026, 10, 14, 23, 59, 30, 0).getTime();
  const midnightRun = startSessionTimer(
    'gentle-breathing',
    60,
    beforeMidnight,
    'run-midnight'
  );
  const wokeNextDay = syncSessionTimer(midnightRun, beforeMidnight + 150_000);
  assert.equal(wokeNextDay.status, 'completed');
  assert.ok(wokeNextDay.completedAtIso);
  assert.equal(getLocalDateKey(new Date(wokeNextDay.completedAtIso)), '2026-11-15');

  // 3. Abandoned overnight (8h overshoot > 15m grace window) ends cleanly as ended_early
  const abandoned = syncSessionTimer(
    running,
    startAt + 60_000 + DEFAULT_SESSION_COMPLETION_GRACE_MS + 1000
  );
  assert.equal(abandoned.status, 'ended_early');
  assert.equal(abandoned.completedAtIso, null);

  // 4. NaN/negative persisted timestamps do not produce NaN elapsed or negative durations
  const corruptedElapsed = getSessionElapsedMs(
    {
      runId: 'corrupt',
      sessionId: 'mindfulness',
      durationMs: Number.NaN,
      status: 'running',
      accumulatedElapsedMs: -500,
      lastResumedAtMs: Number.NaN,
      completedAtIso: null,
    },
    10_000
  );
  assert.equal(Number.isFinite(corruptedElapsed), true);
  assert.equal(corruptedElapsed >= 0, true);
});
