import React from 'react';
import { ArrowRight, MessageSquare, Wind } from 'lucide-react';
import type {
  GoalMetadata,
  GuidedSessionDefinition,
  NavDestination,
} from '../../types/wellness';

interface HomeQuickActionsProps {
  goalMeta: GoalMetadata;
  recommendedSession: GuidedSessionDefinition | undefined;
  onOpenSession: (sessionId: string) => void;
  onAskCoachQuestion: (question: string) => void;
  onNavigate: (destination: NavDestination) => void;
}

export function HomeQuickActions({
  goalMeta,
  recommendedSession,
  onOpenSession,
  onAskCoachQuestion,
  onNavigate,
}: HomeQuickActionsProps) {
  return (
    <>
      {recommendedSession && (
        <section
          aria-labelledby="recommended-session-heading"
          className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
        >
          <p className="text-xs font-medium text-[#5C6762]">
            Suggested session · {goalMeta.label} focus · ~
            {Math.round(recommendedSession.defaultDurationSeconds / 60)} min
          </p>
          <h2
            id="recommended-session-heading"
            className="mt-1.5 font-display text-xl font-medium text-[#1E2421]"
          >
            {recommendedSession.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#4A5550]">
            {recommendedSession.shortDescription}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => onOpenSession(recommendedSession.id)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#2F5D50] bg-[#EBF2EF] px-4 py-2 text-sm font-medium text-[#1F4238] transition-colors hover:bg-[#DCE9E3] whitespace-nowrap"
            >
              <Wind className="h-4 w-4" aria-hidden="true" />
              <span>Open guided session</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      <section
        aria-labelledby="quick-coach-heading"
        className="rounded-2xl border border-[#E6E4DD] bg-white p-6"
      >
        <p className="text-xs font-medium text-[#5C6762]">
          Wellness education · Coach
        </p>
        <h2
          id="quick-coach-heading"
          className="mt-1.5 font-display text-xl font-medium text-[#1E2421]"
        >
          Ask Mindful Coach
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#4A5550]">
          Explore practical, low-pressure ideas related to {goalMeta.label.toLowerCase()}.
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onAskCoachQuestion(goalMeta.starterQuestions[0])}
            className="w-full min-h-[44px] rounded-xl border border-[#E6E4DD] bg-[#FAF9F6] px-4 py-3 text-left text-sm text-[#1E2421] transition-colors hover:bg-[#F2F0EA]"
          >
            “{goalMeta.starterQuestions[0]}”
          </button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => onNavigate('coach')}
            className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] whitespace-nowrap"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>Go to Coach chat</span>
          </button>
        </div>
      </section>
    </>
  );
}
