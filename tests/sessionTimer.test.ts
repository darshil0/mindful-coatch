import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendUniqueCompletion,
  endSessionEarly,
  getActiveStepForElapsed,
  getSessionElapsedMs,
  pauseSessionTimer,
  resumeSessionTimer,
  startSessionTimer,
  syncSessionTimer,
} from '../src/lib/sessionTimer';
import { getSessionById } from '../src/data/guidedSessions';

test('session timer handles tab throttling via wall-clock timestamps, early exit, and single completion', () => {
  const t0 = 1_000_000;
  let timer = startSessionTimer('gentle-breathing', 120, t0, 'run-abc');
  assert.equal(timer.status, 'running');

  // Advance 45s -> pause
  timer = pauseSessionTimer(timer, t0 + 45_000);
  assert.equal(timer.status, 'paused');
  assert.equal(getSessionElapsedMs(timer, t0 + 100_000), 45_000);

  // Resume at t0 + 100s, then simulate background tab jump of 80s (total 125s >= 120s)
  timer = resumeSessionTimer(timer, t0 + 100_000);
  timer = syncSessionTimer(timer, t0 + 180_000);
  assert.equal(timer.status, 'completed');
  assert.equal(getSessionElapsedMs(timer, t0 + 180_000), 120_000);

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

  // Early exit never completes
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
