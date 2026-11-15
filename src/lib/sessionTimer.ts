import type {
  CompletedSessionRecord,
  GuidedSessionStep,
  SessionTimerState,
} from '../types/wellness';

/**
 * Maximum overshoot past timer end before an abandoned background session
 * (e.g., tab left asleep overnight for 8h) is closed as `ended_early` rather
 * than credited as completed hours later.
 */
export const DEFAULT_SESSION_COMPLETION_GRACE_MS = 15 * 60 * 1000;

function sanitizeDurationMs(durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return 1000;
  }
  return Math.max(1000, Math.round(durationMs));
}

function sanitizeNonNegativeMs(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function sanitizeNullableTimestampMs(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function createIdleSessionTimer(
  sessionId: string,
  durationSeconds: number
): SessionTimerState {
  const safeSeconds =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.round(durationSeconds)
      : 1;
  return {
    runId: '',
    sessionId,
    durationMs: Math.max(1, safeSeconds) * 1000,
    status: 'idle',
    accumulatedElapsedMs: 0,
    lastResumedAtMs: null,
    completedAtIso: null,
  };
}

export function startSessionTimer(
  sessionId: string,
  durationSeconds: number,
  nowMs: number,
  runId: string
): SessionTimerState {
  const safeNow = sanitizeNonNegativeMs(nowMs);
  const safeSeconds =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.round(durationSeconds)
      : 1;
  return {
    runId,
    sessionId,
    durationMs: Math.max(1, safeSeconds) * 1000,
    status: 'running',
    accumulatedElapsedMs: 0,
    lastResumedAtMs: safeNow,
    completedAtIso: null,
  };
}

/**
 * Computes raw uncapped wall-clock elapsed milliseconds for grace-window checks.
 */
function getRawSessionElapsedMs(state: SessionTimerState, nowMs: number): number {
  const safeNow = sanitizeNonNegativeMs(nowMs);
  let raw = sanitizeNonNegativeMs(state.accumulatedElapsedMs);
  const lastResumed = sanitizeNullableTimestampMs(state.lastResumedAtMs);
  if (state.status === 'running' && lastResumed !== null) {
    raw += Math.max(0, safeNow - lastResumed);
  }
  return Math.max(0, raw);
}

/**
 * Computes accurate wall-clock elapsed milliseconds even if background tabs
 * throttled `setInterval` ticks. Capped at `durationMs`.
 */
export function getSessionElapsedMs(state: SessionTimerState, nowMs: number): number {
  const durationMs = sanitizeDurationMs(state.durationMs);
  return Math.min(durationMs, getRawSessionElapsedMs(state, nowMs));
}

export function getSessionRemainingSeconds(
  state: SessionTimerState,
  nowMs: number
): number {
  const durationMs = sanitizeDurationMs(state.durationMs);
  const elapsed = getSessionElapsedMs(state, nowMs);
  const remainingMs = Math.max(0, durationMs - elapsed);
  return Math.ceil(remainingMs / 1000);
}

export function formatTimerMmSs(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function syncSessionTimer(
  state: SessionTimerState,
  nowMs: number,
  options?: { graceWindowMs?: number }
): SessionTimerState {
  if (state.status !== 'running') {
    return state;
  }

  const durationMs = sanitizeDurationMs(state.durationMs);
  const accumulated = sanitizeNonNegativeMs(state.accumulatedElapsedMs);
  const lastResumed = sanitizeNullableTimestampMs(state.lastResumedAtMs);
  if (lastResumed === null) {
    return {
      ...state,
      durationMs,
      status: 'ended_early',
      accumulatedElapsedMs: Math.min(durationMs, accumulated),
      lastResumedAtMs: null,
      completedAtIso: null,
    };
  }

  const rawElapsed = getRawSessionElapsedMs(state, nowMs);
  if (rawElapsed >= durationMs) {
    const graceWindowMs = Math.max(
      0,
      options?.graceWindowMs ?? DEFAULT_SESSION_COMPLETION_GRACE_MS
    );
    const overshootMs = rawElapsed - durationMs;
    if (overshootMs > graceWindowMs) {
      return {
        ...state,
        durationMs,
        status: 'ended_early',
        accumulatedElapsedMs: durationMs,
        lastResumedAtMs: null,
        completedAtIso: null,
      };
    }

    // Record exact completion instant rather than throttled wake-up time
    const remainingAtResumeMs = Math.max(0, durationMs - accumulated);
    const actualCompletedAtMs = lastResumed + remainingAtResumeMs;
    return {
      ...state,
      durationMs,
      status: 'completed',
      accumulatedElapsedMs: durationMs,
      lastResumedAtMs: null,
      completedAtIso: state.completedAtIso ?? new Date(actualCompletedAtMs).toISOString(),
    };
  }
  return state;
}

export function pauseSessionTimer(
  state: SessionTimerState,
  nowMs: number
): SessionTimerState {
  if (state.status !== 'running') {
    return state;
  }
  const synced = syncSessionTimer(state, nowMs);
  if (synced.status !== 'running') {
    return synced;
  }
  const elapsed = getSessionElapsedMs(synced, nowMs);
  return {
    ...synced,
    status: 'paused',
    accumulatedElapsedMs: elapsed,
    lastResumedAtMs: null,
  };
}

export function resumeSessionTimer(
  state: SessionTimerState,
  nowMs: number
): SessionTimerState {
  if (state.status !== 'paused') {
    return state;
  }
  const durationMs = sanitizeDurationMs(state.durationMs);
  const accumulated = Math.min(
    durationMs,
    sanitizeNonNegativeMs(state.accumulatedElapsedMs)
  );
  if (accumulated >= durationMs) {
    return {
      ...state,
      durationMs,
      status: 'completed',
      accumulatedElapsedMs: durationMs,
      lastResumedAtMs: null,
      completedAtIso: state.completedAtIso ?? new Date(sanitizeNonNegativeMs(nowMs)).toISOString(),
    };
  }
  return {
    ...state,
    durationMs,
    status: 'running',
    accumulatedElapsedMs: accumulated,
    lastResumedAtMs: sanitizeNonNegativeMs(nowMs),
  };
}

/**
 * Ends a session before completion. Synchronizes first so a session whose timer
 * actually finished before the click transitions accurately to `completed` (within grace window).
 */
export function endSessionEarly(
  state: SessionTimerState,
  nowMs: number
): SessionTimerState {
  if (state.status === 'completed' || state.status === 'idle' || state.status === 'ended_early') {
    return state;
  }
  const synced = syncSessionTimer(state, nowMs);
  if (synced.status === 'completed' || synced.status === 'ended_early') {
    return synced;
  }
  const elapsed = getSessionElapsedMs(synced, nowMs);
  return {
    ...synced,
    status: 'ended_early',
    accumulatedElapsedMs: elapsed,
    lastResumedAtMs: null,
    completedAtIso: null,
  };
}

export function getActiveStepForElapsed(
  steps: GuidedSessionStep[],
  elapsedMs: number,
  durationMs: number
): { index: number; step: GuidedSessionStep } {
  if (steps.length === 0) {
    return {
      index: 0,
      step: { title: 'Practice', instruction: 'Rest quietly until the timer completes.' },
    };
  }
  const safeDuration = Math.max(1, durationMs);
  const safeElapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const ratio = Math.min(0.999999, Math.max(0, safeElapsed / safeDuration));
  const index = Math.min(steps.length - 1, Math.floor(ratio * steps.length));
  return { index, step: steps[index] };
}

/**
 * Appends a completed session record at most once per unique `runId`.
 */
export function appendUniqueCompletion(
  existing: CompletedSessionRecord[],
  candidate: CompletedSessionRecord
): CompletedSessionRecord[] {
  if (!candidate.runId) {
    return existing;
  }
  if (existing.some((item) => item.runId === candidate.runId)) {
    return existing;
  }
  return [candidate, ...existing];
}
