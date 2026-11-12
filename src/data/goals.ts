import type { GoalMetadata, WellnessGoal } from '../types/wellness.ts';

export const WELLNESS_GOALS: readonly WellnessGoal[] = [
  'sleep',
  'stress',
  'energy',
  'weight',
] as const;

export const GOAL_METADATA: Record<WellnessGoal, GoalMetadata> = {
  sleep: {
    id: 'sleep',
    label: 'Sleep',
    tagline: 'Support steadier evening wind-down routines and restful habits.',
    dashboardNote: 'Small, repeatable evening cues often matter more than a perfect bedtime.',
    recommendedSessionId: 'sleep-wind-down',
    starterQuestions: [
      'What is a simple 20-minute wind-down routine when my mind feels busy at night?',
      'How can I handle waking up in the middle of the night without checking the clock?',
      'What daytime habits gently support easier sleep in the evening?',
    ],
  },
  stress: {
    id: 'stress',
    label: 'Stress',
    tagline: 'Build calm pauses and practical ways to ease everyday tension.',
    dashboardNote: 'Even two quiet minutes between tasks can help lower accumulated tension.',
    recommendedSessionId: 'gentle-breathing',
    starterQuestions: [
      'I have a packed afternoon—what is a realistic 3-minute reset between meetings?',
      'How can I unclench physical tension when I notice my shoulders and jaw tightening?',
      'What is a grounded way to wind down after a stressful workday?',
    ],
  },
  energy: {
    id: 'energy',
    label: 'Energy',
    tagline: 'Notice daily patterns and pace your day for steadier focus.',
    dashboardNote: 'Pacing rest, light movement, and hydration helps smooth out afternoon dips.',
    recommendedSessionId: 'energy-reset',
    starterQuestions: [
      'What are gentle ways to handle a mid-afternoon energy dip without extra caffeine?',
      'How can I pace my morning tasks when my energy starts out low?',
      'What short movement or daylight habits help refresh focus indoors?',
    ],
  },
  weight: {
    id: 'weight',
    label: 'Weight',
    tagline: 'Focus on sustainable nourishment, enjoyable movement, and self-kindness.',
    dashboardNote: 'Steady, non-restrictive habits around meals, rest, and movement build lasting support.',
    recommendedSessionId: 'mindfulness',
    starterQuestions: [
      'How can I build consistent meal routines on busy days without strict rules?',
      'What are approachable ways to add enjoyable movement when motivation is low?',
      'How can mindfulness help me tune in to hunger and fullness cues calmly?',
    ],
  },
};

export function getGoalMetadata(goal: WellnessGoal): GoalMetadata {
  return GOAL_METADATA[goal];
}
