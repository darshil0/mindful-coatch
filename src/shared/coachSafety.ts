/**
 * Shared wellness safety constants, deterministic Unicode normalization, and
 * conservative crisis/emergency signal evaluation used across client and server.
 *
 * NOTE: Heuristic matching is a supportive safeguard, not a clinical assessment
 * or guarantee of full recall/precision.
 */

export const MAX_COACH_MESSAGE_LENGTH = 1200;
export const MAX_COACH_HISTORY_TURNS = 6;
export const MAX_COACH_HISTORY_TURN_CHARS = 1800;
export const MAX_COACH_TOTAL_HISTORY_CHARS = 7200;

export type SafetyCategory =
  'none' | 'self_harm' | 'medical_emergency' | 'ambiguous_distress';

export interface SafetyEvaluation {
  category: SafetyCategory;
  isUrgent: boolean;
  requiresUpstreamSuppression: boolean;
  response: string | null;
}

/**
 * Deterministic text normalization strictly for safety matching.
 * Preserves original text elsewhere for user display.
 */
export function normalizeSafetyText(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201A\u201B\u02BC\u2032\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const BENIGN_SELF_HARM_IDIOMS: readonly RegExp[] = [
  /\bcut(?:ting)?\s+myself\s+(?:some\s+)?slack\b/,
];

const SELF_HARM_PATTERNS: readonly RegExp[] = [
  /\bsuicid(?:e|al)\b/,
  /\bkill(?:ing)?\s+myself\b/,
  /\bend(?:ing)?\s+my\s+life\b/,
  /\bend(?:ing)?\s+it\s+all\b/,
  /\btak(?:e|ing)\s+my\s+(?:own\s+)?life\b/,
  /\bwant\s+to\s+die\b/,
  /\b(?:don't|do\s+not)\s+want\s+to\s+live\b/,
  /\bno\s+reason\s+to\s+live\b/,
  /\bbetter\s+off\s+dead\b/,
  /\bself[-\s]?harm(?:ing)?\b/,
  /\b(?:harm|hurt)(?:ing)?\s+myself\b/,
  /\bcut(?:ting)?\s+myself\b/,
  /\bunaliv(?:e|ed|ing)\b/,
  /\boverdos(?:e|ed|ing)\b/,
  /\b(?:took\s+too\s+many\s+pills|swallowed\s+(?:too\s+many\s+)?pills)\b/,
];

const BENIGN_MEDICAL_IDIOMS: readonly RegExp[] = [
  /\bpassing\s+out\s+(?:flyers?|leaflets?|brochures?|handouts?|papers?|cards?|samples?|stickers?)\b/,
];

const CLEAR_MEDICAL_EMERGENCY_PATTERNS: readonly RegExp[] = [
  /\bheart\s+attack\b/,
  /\bseizur(?:e|ing|es)\b/,
  /\bchoking\b/,
  /\bstroke\s+symptoms?\b/,
  /\b(?:severe|crushing)\s+chest\s+pain\b/,
  /\bchest\s+pain\b/,
  /\bsevere\s+bleeding\b/,
  /\bpassing\s+out\b/,
];

const BREATHING_DISTRESS_PATTERN =
  /\b(?:can't\s+breathe|cannot\s+breathe|trouble\s+breathing|hard\s+to\s+breathe|shortness\s+of\s+breath|struggling\s+to\s+breathe)\b/;

const AMBIGUOUS_WORKPLACE_METAPHOR_CONTEXT =
  /\b(?:at\s+work|workload|deadlines?|inbox|so\s+busy|emails?)\b/;

export const URGENT_SELF_HARM_RESPONSE = `If you are having thoughts of self-harm or suicide, or feel unsafe right now, please pause using this app and connect with direct human support immediately.

Next steps:
- Contact a confidential crisis helpline in your area right away (such as calling or texting 988 in the US/Canada, 111 in the UK, or finding free support worldwide at https://findahelpline.com).
- If you are in immediate physical danger or have harmed yourself or taken too many pills, contact your local emergency services (e.g., 911, 999, 112, or 000) or go to the nearest emergency department.
- Reach out to a trusted friend, family member, or healthcare professional nearby so you are not alone right now.

Why this may help:
Mindful Coach is an educational wellness app, not a crisis or medical service. Speaking directly with a trained responder gives you real-time, compassionate support.`;

export const URGENT_MEDICAL_RESPONSE = `If you are experiencing urgent physical symptoms—such as chest pain, choking, trouble breathing, a seizure, or fainting—please pause using this app and seek immediate medical care right away.

Next steps:
- Contact your local emergency services immediately (for example, 911 in the US/Canada, 999 in the UK, 112 in the EU, or 000 in Australia) or go to the nearest emergency department.
- If someone is with you, let them know how you feel right now so they can help you get medical attention.
- If your wording only meant feeling metaphorically overwhelmed rather than a physical emergency, step away from your screen to rest first, and still seek care promptly if any physical symptom is present.

Why this may help:
Mindful Coach cannot evaluate medical symptoms or rule out an emergency. In-person emergency or clinical evaluation is the safest response whenever urgent physical symptoms may be occurring.`;

// Backwards-compatible alias kept for shared consumers & tests
export const URGENT_SAFETY_RESPONSE = URGENT_SELF_HARM_RESPONSE;

export function evaluateSafetySignal(message: string): SafetyEvaluation {
  const normalized = normalizeSafetyText(message);
  if (!normalized) {
    return {
      category: 'none',
      isUrgent: false,
      requiresUpstreamSuppression: false,
      response: null,
    };
  }

  // Strip explicitly benign idioms only from a temporary match string so legitimate crises in the same message still match
  let selfHarmCandidate = normalized;
  for (const idiom of BENIGN_SELF_HARM_IDIOMS) {
    selfHarmCandidate = selfHarmCandidate.replace(new RegExp(idiom.source, 'g'), ' ');
  }

  if (SELF_HARM_PATTERNS.some((pattern) => pattern.test(selfHarmCandidate))) {
    return {
      category: 'self_harm',
      isUrgent: true,
      requiresUpstreamSuppression: true,
      response: URGENT_SELF_HARM_RESPONSE,
    };
  }

  let medicalCandidate = normalized;
  for (const idiom of BENIGN_MEDICAL_IDIOMS) {
    medicalCandidate = medicalCandidate.replace(new RegExp(idiom.source, 'g'), ' ');
  }

  if (
    CLEAR_MEDICAL_EMERGENCY_PATTERNS.some((pattern) => pattern.test(medicalCandidate))
  ) {
    return {
      category: 'medical_emergency',
      isUrgent: true,
      requiresUpstreamSuppression: true,
      response: URGENT_MEDICAL_RESPONSE,
    };
  }

  if (BREATHING_DISTRESS_PATTERN.test(medicalCandidate)) {
    const isAmbiguous = AMBIGUOUS_WORKPLACE_METAPHOR_CONTEXT.test(medicalCandidate);
    return {
      category: isAmbiguous ? 'ambiguous_distress' : 'medical_emergency',
      isUrgent: true,
      requiresUpstreamSuppression: true,
      response: URGENT_MEDICAL_RESPONSE,
    };
  }

  return {
    category: 'none',
    isUrgent: false,
    requiresUpstreamSuppression: false,
    response: null,
  };
}

export function detectUrgentSafetyConcern(message: string): boolean {
  return evaluateSafetySignal(message).isUrgent;
}

/**
 * Checks whether an assistant turn in conversation history matches one of the canned crisis notices.
 */
export function isCannedSafetyResponse(content: string): boolean {
  const normalized = normalizeSafetyText(content);
  return (
    normalized === normalizeSafetyText(URGENT_SELF_HARM_RESPONSE) ||
    normalized === normalizeSafetyText(URGENT_MEDICAL_RESPONSE)
  );
}
