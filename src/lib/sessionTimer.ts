import type {
  CompletedSessionRecord,
  GuidedSessionStep,
  SessionTimerState,
} from '../types/wellness';

export function createIdleSessionTimer(
  sessionId: string,
  durationSeconds: number
): SessionTimerState {
  return {
    runId: '',
    sessionId,
    durationMs: Math.max(1, Math.round(durationSeconds)) * 1000,
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
  return {
    runId,
    sessionId,
    durationMs: Math.max(1, Math.round(durationSeconds)) * 1000,
    status: 'running',
    accumulatedElapsedMs: 0,
    lastResumedAtMs: nowMs,
    completedAtIso: null,
  };
}

/**
 * Computes accurate wall-clock elapsed milliseconds even if background tabs
 * throttled `setInterval` ticks.
 */
export function getSessionElapsedMs(state: SessionTimerState, nowMs: number): number {
  let raw = state.accumulatedElapsedMs;
  if (state.status === 'running' && state.lastResumedAtMs !== null) {
    raw += Math.max(0, nowMs - state.lastResumedAtMs);
  }
  return Math.min(state.durationMs, Math.max(0, raw));
}

export function getSessionRemainingSeconds(
  state: SessionTimerState,
  nowMs: number
): number {
  const elapsed = getSessionElapsedMs(state, nowMs);
  const remainingMs = Math.max(0, state.durationMs - elapsed);
  return Math.ceil(remainingMs / 1000);
}

export function formatTimerMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function syncSessionTimer(
  state: SessionTimerState,
  nowMs: number
): SessionTimerState {
  if (state.status !== 'running') {
    return state;
  }
  const elapsed = getSessionElapsedMs(state, nowMs);
  if (elapsed >= state.durationMs) {
    return {
      ...state,
      status: 'completed',
      accumulatedElapsedMs: state.durationMs,
      lastResumedAtMs: null,
      completedAtIso: state.completedAtIso ?? new Date(nowMs).toISOString(),
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
  if (synced.status === 'completed') {
    return synced;
  }
  const elapsed = getSessionElapsedMs(state, nowMs);
  return {
    ...state,
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
  return {
    ...state,
    status: 'running',
    lastResumedAtMs: nowMs,
  };
}

/**
 * Ends a session before completion. Transitions status to `ended_early`
 * and never marks the run as completed.
 */
export function endSessionEarly(
  state: SessionTimerState,
  nowMs: number
): SessionTimerState {
  if (state.status === 'completed' || state.status === 'idle') {
    return state;
  }
  const elapsed = getSessionElapsedMs(state, nowMs);
  return {
    ...state,
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
  const ratio = Math.min(0.999999, Math.max(0, elapsedMs / safeDuration));
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
