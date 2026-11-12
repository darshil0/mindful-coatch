import React from 'react';
import { Clock, Play } from 'lucide-react';
import type { GuidedSessionDefinition } from '../../types/wellness';

interface SessionCatalogCardProps {
  session: GuidedSessionDefinition;
  isGoalMatch: boolean;
  goalLabel: string;
  completionsCount: number;
  onSelect: (session: GuidedSessionDefinition) => void;
}

export function SessionCatalogCard({
  session,
  isGoalMatch,
  goalLabel,
  completionsCount,
  onSelect,
}: SessionCatalogCardProps) {
  const defaultMins = Math.round(session.defaultDurationSeconds / 60);

  return (
    <article className="flex flex-col justify-between rounded-2xl border border-[#E6E4DD] bg-white p-6">
      <div>
        <p className="text-xs font-medium text-[#5C6762]">
          ~{defaultMins} min · {session.steps.length} steps
          {isGoalMatch ? ` · Suggested for ${goalLabel}` : ''}
          {completionsCount > 0 ? ` · Completed ${completionsCount}x` : ''}
        </p>
        <h2 className="mt-1.5 font-display text-2xl font-medium text-[#1E2421]">
          {session.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#4A5550]">
          {session.shortDescription}
        </p>
      </div>

      <div className="mt-6 pt-4 border-t border-[#ECEAE3] flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-[#5C6762]">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Options:{' '}
            {session.durationOptionsSeconds
              .map((s) => `${Math.round(s / 60)}m`)
              .join(', ')}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onSelect(session)}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#254B40] whitespace-nowrap"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          <span>Open {session.title}</span>
        </button>
      </div>
    </article>
  );
}
