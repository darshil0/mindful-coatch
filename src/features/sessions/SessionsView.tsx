import React from 'react';
import type {
  CompletedSessionRecord,
  WellnessGoal,
} from '../../types/wellness';
import { getGoalMetadata } from '../../data/goals';
import { GUIDED_SESSIONS } from '../../data/guidedSessions';
import { useSessionPlayer } from '../../hooks/useSessionPlayer';
import { ActiveSessionPlayer } from './ActiveSessionPlayer';
import { SessionCatalogCard } from './SessionCatalogCard';

interface SessionsViewProps {
  primaryGoal: WellnessGoal;
  initialSessionId: string | null;
  effectiveReducedMotion: boolean;
  completedSessions: CompletedSessionRecord[];
  onRecordSessionCompletion: (record: CompletedSessionRecord) => void;
  onClearInitialSession: () => void;
}

export function SessionsView({
  primaryGoal,
  initialSessionId,
  effectiveReducedMotion,
  completedSessions,
  onRecordSessionCompletion,
  onClearInitialSession,
}: SessionsViewProps) {
  const goalMeta = getGoalMetadata(primaryGoal);

  const player = useSessionPlayer({
    initialSessionId,
    onClearInitialSession,
    onRecordSessionCompletion,
  });

  // Sort sessions so primary-goal matches appear first while keeping a predictable order
  const orderedSessions = [...GUIDED_SESSIONS].sort((a, b) => {
    const aRec = a.recommendedForGoals.includes(primaryGoal) ? 0 : 1;
    const bRec = b.recommendedForGoals.includes(primaryGoal) ? 0 : 1;
    return aRec - bRec;
  });

  if (player.activeSession) {
    return (
      <ActiveSessionPlayer
        session={player.activeSession}
        selectedDurationSec={player.selectedDurationSec}
        timerState={player.timerState}
        nowMs={player.nowMs}
        effectiveReducedMotion={effectiveReducedMotion}
        onBackToCatalog={player.exitToCatalog}
        onChangeDuration={player.changeDuration}
        onStart={player.start}
        onPause={player.pause}
        onResume={player.resume}
        onEndEarly={player.endEarly}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="sessions-page-heading">
        <p className="text-xs font-medium text-[#5C6762]">
          Text-guided timers · Silent (no audio) · Completed sessions:{' '}
          {completedSessions.length}
        </p>
        <h1
          id="sessions-page-heading"
          className="mt-1 font-display text-3xl sm:text-4xl font-medium tracking-tight text-[#1E2421]"
        >
          Guided sessions
        </h1>
        <p className="mt-2 max-w-2xl text-base text-[#4A5550]">
          Short, self-paced text practices with accurate timers. Return to normal
          breathing or stop anytime if anything feels uncomfortable.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {orderedSessions.map((session) => {
          const isGoalMatch = session.recommendedForGoals.includes(primaryGoal);
          const completionsCount = completedSessions.filter(
            (c) => c.sessionId === session.id
          ).length;

          return (
            <SessionCatalogCard
              key={session.id}
              session={session}
              isGoalMatch={isGoalMatch}
              goalLabel={goalMeta.label}
              completionsCount={completionsCount}
              onSelect={player.selectSession}
            />
          );
        })}
      </div>
    </div>
  );
}
