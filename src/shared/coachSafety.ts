/**
 * Shared wellness safety constants and crisis/emergency detectors used by both
 * the Express API server and client-side Demo Coach fallback.
 */

export const MAX_COACH_MESSAGE_LENGTH = 1200;
export const MAX_COACH_HISTORY_TURNS = 6;
export const MAX_COACH_HISTORY_TURN_CHARS = 1800;

export const URGENT_HELP_PATTERNS: readonly RegExp[] = [
  /\b(suicid(e|al)|kill myself|end my life|want to die|self[- ]?harm|hurt myself)\b/i,
  /\b(overdose|can'?t breathe|chest pain|crushing pain|stroke symptoms|passing out)\b/i,
];

export function detectUrgentSafetyConcern(message: string): boolean {
  return URGENT_HELP_PATTERNS.some((pattern) => pattern.test(message));
}

export const URGENT_SAFETY_RESPONSE = `If you may be in immediate danger, experiencing a medical emergency, or having thoughts of harming yourself, please pause using this app and reach out for immediate human support right now.

Next steps:
- Call your local emergency services (such as 911 in the US/Canada, 999 in the UK, or 112 in Europe) or go to the nearest emergency department for urgent medical concerns.
- If you are experiencing a mental health or self-harm crisis in the US or Canada, call or text 988 to reach the Suicide & Crisis Lifeline (free, confidential, 24/7), or contact your local crisis helpline.
- Reach out to a trusted family member, friend, or healthcare professional nearby so you do not have to navigate this alone.

Why this may help:
Mindful Coach is an educational wellness tool and cannot provide crisis intervention or emergency care. Connecting directly with trained responders or clinicians gives you immediate, real-time support.`;
