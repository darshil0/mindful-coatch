import { useEffect, useRef, useState } from 'react';
import type {
  CompletedSessionRecord,
  GuidedSessionDefinition,
  SessionTimerState,
} from '../types/wellness';
import { getSessionById } from '../data/guidedSessions';
import {
  createIdleSessionTimer,
  endSessionEarly,
  getSessionElapsedMs,
  pauseSessionTimer,
  resumeSessionTimer,
  startSessionTimer,
  syncSessionTimer,
} from '../lib/sessionTimer';
import { getLocalDateKey } from '../lib/dateUtils';

interface UseSessionPlayerOptions {
  onRecordSessionCompletion: (record: CompletedSessionRecord) => void;
}

/**
 * Coordinates active session timer state without triggering 4Hz re-renders in the root App tree.
 * Completion is scheduled cleanly via remaining-duration timeout + focus/visibility catch-up,
 * while smooth 250ms countdown UI ticking lives inside `ActiveSessionPlayer`.
 */
export function useSessionPlayer({
  onRecordSessionCompletion,
}: UseSessionPlayerOptions) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSession: GuidedSessionDefinition | undefined = selectedSessionId
    ? getSessionById(selectedSessionId)
    : undefined;

  const [selectedDurationSec, setSelectedDurationSec] = useState<number>(
    activeSession?.defaultDurationSeconds ?? 180
  );
  const [timerState, setTimerState] = useState<SessionTimerState>(() =>
    createIdleSessionTimer(
      activeSession?.id ?? 'mindfulness',
      activeSession?.defaultDurationSeconds ?? 180
    )
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const recordedRunIdsRef = useRef<Set<string>>(new Set());

  const openSessionById = (sessionId: string) => {
    const target = getSessionById(sessionId);
    if (!target) return;
    setSelectedSessionId(target.id);
    setTimerState((prev) => {
      const alreadyActiveSameSession =
        prev.sessionId === target.id &&
        (prev.status === 'running' || prev.status === 'paused');
      if (alreadyActiveSameSession) {
        return prev;
      }
      setSelectedDurationSec(target.defaultDurationSeconds);
      setNowMs(Date.now());
      return createIdleSessionTimer(target.id, target.defaultDurationSeconds);
    });
  };

  // Background completion timeout + visibilitychange/focus catch-up (no 250ms root polling!)
  useEffect(() => {
    if (timerState.status !== 'running') return;

    const syncNow = () => {
      const currentNow = Date.now();
      setTimerState((prev) => {
        const synced = syncSessionTimer(prev, currentNow);
        if (synced.status !== prev.status) {
          setNowMs(currentNow);
        }
        return synced;
      });
    };

    const elapsedNow = getSessionElapsedMs(timerState, Date.now());
    const remainingMs = Math.max(50, timerState.durationMs - elapsedNow + 25);
    const completionTimer = window.setTimeout(syncNow, remainingMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNow();
      }
    };
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(completionTimer);
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [timerState]);

  // Record session completion exactly once when timer reaches 'completed'
  useEffect(() => {
    if (
      timerState.status === 'completed' &&
      timerState.runId &&
      activeSession &&
      !recordedRunIdsRef.current.has(timerState.runId)
    ) {
      recordedRunIdsRef.current.add(timerState.runId);
      const completedDate = new Date(
        timerState.completedAtIso ?? new Date().toISOString()
      );
      onRecordSessionCompletion({
        completionId: `comp-${timerState.runId}`,
        runId: timerState.runId,
        sessionId: activeSession.id,
        title: activeSession.title,
        durationSeconds: Math.round(timerState.durationMs / 1000),
        completedAt: completedDate.toISOString(),
        date: getLocalDateKey(completedDate),
      });
    }
  }, [timerState, activeSession, onRecordSessionCompletion]);

  const selectSession = (session: GuidedSessionDefinition) => {
    setSelectedSessionId(session.id);
    setSelectedDurationSec(session.defaultDurationSeconds);
    setTimerState(createIdleSessionTimer(session.id, session.defaultDurationSeconds));
    setNowMs(Date.now());
  };

  const exitToCatalog = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    if (timerState.status === 'running' || timerState.status === 'paused') {
      setTimerState((prev) => endSessionEarly(prev, currentNow));
    }
    setSelectedSessionId(null);
  };

  const changeDuration = (seconds: number) => {
    if (!activeSession) return;
    setSelectedDurationSec(seconds);
    setTimerState(createIdleSessionTimer(activeSession.id, seconds));
    setNowMs(Date.now());
  };

  const start = () => {
    if (!activeSession) return;
    const currentNow = Date.now();
    const runId = `${activeSession.id}-${currentNow}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    setNowMs(currentNow);
    setTimerState(
      startSessionTimer(activeSession.id, selectedDurationSec, currentNow, runId)
    );
  };

  const pause = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    setTimerState((prev) => pauseSessionTimer(prev, currentNow));
  };

  const resume = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    setTimerState((prev) => resumeSessionTimer(prev, currentNow));
  };

  const endEarly = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    setTimerState((prev) => endSessionEarly(prev, currentNow));
  };

  const resetPlayer = () => {
    setSelectedSessionId(null);
    setSelectedDurationSec(180);
    setTimerState(createIdleSessionTimer('mindfulness', 180));
    setNowMs(Date.now());
  };

  return {
    activeSession,
    selectedDurationSec,
    timerState,
    nowMs,
    openSessionById,
    selectSession,
    exitToCatalog,
    changeDuration,
    start,
    pause,
    resume,
    endEarly,
    resetPlayer,
  };
}

export type SessionPlayerHookResult = ReturnType<typeof useSessionPlayer>;
