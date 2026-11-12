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
  pauseSessionTimer,
  resumeSessionTimer,
  startSessionTimer,
  syncSessionTimer,
} from '../lib/sessionTimer';
import { getLocalDateKey } from '../lib/dateUtils';

interface UseSessionPlayerOptions {
  initialSessionId: string | null;
  onClearInitialSession: () => void;
  onRecordSessionCompletion: (record: CompletedSessionRecord) => void;
}

export function useSessionPlayer({
  initialSessionId,
  onClearInitialSession,
  onRecordSessionCompletion,
}: UseSessionPlayerOptions) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    initialSessionId
  );
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

  // Sync if navigated from Home "Open guided session"
  useEffect(() => {
    if (initialSessionId) {
      const target = getSessionById(initialSessionId);
      if (target) {
        setSelectedSessionId(target.id);
        setSelectedDurationSec(target.defaultDurationSeconds);
        setTimerState(createIdleSessionTimer(target.id, target.defaultDurationSeconds));
        setNowMs(Date.now());
      }
      onClearInitialSession();
    }
  }, [initialSessionId, onClearInitialSession]);

  // Accurate wall-clock tick + visibilitychange / focus catch-up
  useEffect(() => {
    if (timerState.status !== 'running') return;

    const tick = () => {
      const currentNow = Date.now();
      setNowMs(currentNow);
      setTimerState((prev) => syncSessionTimer(prev, currentNow));
    };

    const intervalId = window.setInterval(tick, 250);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [timerState.status]);

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

  return {
    activeSession,
    selectedDurationSec,
    timerState,
    nowMs,
    selectSession,
    exitToCatalog,
    changeDuration,
    start,
    pause,
    resume,
    endEarly,
  };
}
