import type { GuidedSessionDefinition } from '../types/wellness';

export const GUIDED_SESSIONS: GuidedSessionDefinition[] = [
  {
    id: 'mindfulness',
    title: 'Mindfulness',
    shortDescription:
      'Anchor your attention in the present room, physical support, and passing thoughts without judgment.',
    defaultDurationSeconds: 180,
    durationOptionsSeconds: [60, 180, 300],
    recommendedForGoals: ['weight', 'stress'],
    safetyNote:
      'Keep your eyes softly open or closed—whichever feels steadier. You can pause or end the session at any moment.',
    hasOptionalBreathingPacer: false,
    steps: [
      {
        title: 'Settle your posture',
        instruction:
          'Find a comfortable seated or resting position. Notice the points of contact where the chair, floor, or cushion supports your weight.',
      },
      {
        title: 'Orient to your surroundings',
        instruction:
          'Notice three quiet details in your environment—perhaps the temperature of the air, ambient sound, or soft light in the room.',
      },
      {
        title: 'Observe thoughts passing',
        instruction:
          'When plans or reminders appear, acknowledge them gently as "thinking" and return attention to the sensation of sitting and breathing naturally.',
      },
      {
        title: 'Carry calm forward',
        instruction:
          'Widen your awareness back to the room. Before moving on, choose one gentle intention for how you want to approach the next hour.',
      },
    ],
  },
  {
    id: 'gentle-breathing',
    title: 'Gentle breathing',
    shortDescription:
      'Unforced, comfortable breathing guidance with no breath-holding or rapid pacing.',
    defaultDurationSeconds: 120,
    durationOptionsSeconds: [60, 120, 240],
    recommendedForGoals: ['stress', 'sleep'],
    safetyNote:
      'All breathing cues are optional. Never force a deep breath or hold your breath—return to your natural breathing rhythm or stop immediately if you feel uncomfortable or lightheaded.',
    hasOptionalBreathingPacer: true,
    steps: [
      {
        title: 'Notice your natural breath',
        instruction:
          'Start without changing anything. Simply notice the natural rise and fall of your chest or belly for a few easy breaths.',
        breathCue: 'Breathe at your natural, unforced pace.',
      },
      {
        title: 'Soften shoulders and jaw',
        instruction:
          'Let your shoulders drop slightly away from your ears and unclench your jaw. Allow air to move smoothly through your nose or mouth.',
        breathCue: 'Optional gentle rhythm: ~4s easy inhale, ~5s unhurried exhale.',
      },
      {
        title: 'Unhurried exhale',
        instruction:
          'If comfortable, let each exhale finish naturally without rushing into the next breath. Keep the effort light and easy.',
        breathCue: 'Optional gentle rhythm: ~4s easy inhale, ~5s unhurried exhale.',
      },
      {
        title: 'Return to effortless breathing',
        instruction:
          'Let go of any counting or pacing. Rest for a few moments with completely ordinary, comfortable breathing before continuing your day.',
        breathCue: 'Return to normal, effortless breathing.',
      },
    ],
  },
  {
    id: 'energy-reset',
    title: 'Energy reset',
    shortDescription:
      'A calm midday check-in to release screen fatigue, refresh posture, and pick one clear next step.',
    defaultDurationSeconds: 180,
    durationOptionsSeconds: [60, 180, 300],
    recommendedForGoals: ['energy'],
    safetyNote:
      'Keep any stretches small and pain-free within a comfortable range of motion.',
    hasOptionalBreathingPacer: false,
    steps: [
      {
        title: 'Step back from screens',
        instruction:
          'Look away from close-up text toward a distant wall or window for several seconds to let your eye muscles relax.',
      },
      {
        title: 'Release upper-body tension',
        instruction:
          'Gently roll your shoulders once or twice if comfortable, and rest your hands loosely on your lap or desk.',
      },
      {
        title: 'Check physical basics',
        instruction:
          'Notice quietly whether your body is asking for water, a short stand-up break, daylight, or a slower pace.',
      },
      {
        title: 'Choose one realistic focus',
        instruction:
          'Instead of holding your whole to-do list at once, name one manageable task or rest break to take when this session ends.',
      },
    ],
  },
  {
    id: 'sleep-wind-down',
    title: 'Sleep wind-down',
    shortDescription:
      'A quiet evening sequence to set aside unfinished tasks and ease into bedtime rest.',
    defaultDurationSeconds: 240,
    durationOptionsSeconds: [60, 240, 360],
    recommendedForGoals: ['sleep'],
    safetyNote:
      'Follow these text cues at an easy pace. Return to normal breathing or stop anytime if anything feels uncomfortable.',
    hasOptionalBreathingPacer: true,
    steps: [
      {
        title: 'Lower stimulation',
        instruction:
          'Dim nearby brightness if you can and let yourself know that problem-solving for today is finished.',
        breathCue: 'Breathe naturally and unhurriedly.',
      },
      {
        title: 'Set tomorrow aside',
        instruction:
          'Acknowledge that anything unfinished can wait until tomorrow. You do not need to solve or rehearse tasks right now.',
        breathCue: 'Optional gentle cue: let each exhale soften tension.',
      },
      {
        title: 'Scan and soften',
        instruction:
          'Bring quiet attention from your forehead and jaw down through your shoulders, hands, legs, and feet, letting each area rest heavily.',
        breathCue: 'Optional gentle rhythm: ~4s easy inhale, ~5s soft exhale.',
      },
      {
        title: 'Transition to rest',
        instruction:
          'When this timer finishes, put your device aside and allow yourself to rest—even quiet wakefulness in the dark is restorative.',
        breathCue: 'Rest in your natural breathing rhythm.',
      },
    ],
  },
];

export function getSessionById(sessionId: string): GuidedSessionDefinition | undefined {
  return GUIDED_SESSIONS.find((s) => s.id === sessionId);
}
