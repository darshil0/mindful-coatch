import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { CoachHistoryItem } from '../../src/shared/apiTypes.ts';
import {
  MAX_COACH_HISTORY_TURN_CHARS,
  MAX_COACH_HISTORY_TURNS,
} from '../../src/shared/coachSafety.ts';
import {
  BASE_CANDIDATE_MODELS,
  type CandidateModelName,
  resolveGeminiApiKey,
} from '../config.ts';

export interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

let lastWorkingModel: CandidateModelName | null = null;
let cachedAiClient: GoogleGenAI | null = null;
let cachedKey = '';

function getOrderedCandidateModels(): CandidateModelName[] {
  if (!lastWorkingModel) {
    return [...BASE_CANDIDATE_MODELS];
  }
  return [
    lastWorkingModel,
    ...BASE_CANDIDATE_MODELS.filter((m) => m !== lastWorkingModel),
  ];
}

export function getGeminiClient(): GoogleGenAI | null {
  const key = resolveGeminiApiKey();
  if (!key) return null;
  if (!cachedAiClient || cachedKey !== key) {
    cachedAiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedKey = key;
  }
  return cachedAiClient;
}

export function buildSystemInstruction(goal: string | null): string {
  const goalContext = goal
    ? `The user selected "${goal}" as their general wellness focus topic.`
    : 'Provide general everyday wellness coaching.';

  return [
    'You are Mindful Coach, a calm, supportive, plain-language wellness educator.',
    goalContext,
    'Follow these strict boundaries in every reply:',
    '1. General wellness education only: never diagnose medical or mental health conditions, never prescribe or recommend medications or supplements, and never advise changing prescribed medications.',
    '2. Honest uncertainty: never promise guaranteed health outcomes, and never invent research studies, statistics, percentages, or academic citations.',
    '3. Professional care: encourage speaking with a qualified healthcare professional when symptoms are persistent, severe, or concerning.',
    '4. Urgent safety: if there is any sign of self-harm, immediate danger, or medical emergency, prioritize contacting local emergency services (such as 911 or 988 in the US/Canada) immediately rather than routine coaching.',
    '5. Weight sensitivity: if asked about weight, eating, or body image, respond without shame, restrictive calorie targets, rapid weight-loss promises, extreme fasting/dieting, or assumptions about body size. Focus on sustainable nourishment, enjoyable movement, and rest.',
    '6. Privacy: do not ask the user for sensitive personal identifiers, medical records, or exact body measurements.',
    '7. Concise plain-text structure (around 110 to 190 words total, no markdown headings `#`, no HTML):',
    '   - Start with a direct, warm 2-3 sentence answer.',
    '   - Add a line "Next steps:" followed by 1 to 3 realistic bullet points starting with "- ".',
    '   - Add a line "Why this may help:" followed by 1 to 2 plain-language sentences explaining the practical rationale.',
    '   - Do not repeat a lengthy legal disclaimer in every reply.',
  ].join('\n');
}

/**
 * Sanitizes untrusted client conversation history and ensures Gemini `contents`
 * start with a `user` turn and alternate strictly (`user` <-> `model`).
 */
export function normalizeConversationContents(
  rawHistory: unknown,
  currentUserMessage: string
): GeminiContentTurn[] {
  const cleanHistory: CoachHistoryItem[] = [];
  if (Array.isArray(rawHistory)) {
    for (const item of rawHistory.slice(-MAX_COACH_HISTORY_TURNS)) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      if (
        (rec.role === 'user' || rec.role === 'assistant') &&
        typeof rec.content === 'string' &&
        rec.content.trim().length > 0
      ) {
        cleanHistory.push({
          role: rec.role,
          content: rec.content.trim().slice(0, MAX_COACH_HISTORY_TURN_CHARS),
        });
      }
    }
  }

  const rawTurns: { role: 'user' | 'model'; text: string }[] = [
    ...cleanHistory.map((turn) => ({
      role: (turn.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      text: turn.content,
    })),
    {
      role: 'user',
      text: currentUserMessage,
    },
  ];

  const contents: GeminiContentTurn[] = [];
  for (const turn of rawTurns) {
    if (!turn.text.trim()) continue;
    if (contents.length === 0 && turn.role === 'model') {
      continue;
    }
    const prev = contents[contents.length - 1];
    if (prev && prev.role === turn.role) {
      prev.parts[0].text = `${prev.parts[0].text}\n\n${turn.text}`;
    } else {
      contents.push({
        role: turn.role,
        parts: [{ text: turn.text }],
      });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: currentUserMessage }] });
  }
  return contents;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('COACH_REQUEST_TIMEOUT'));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type LiveCoachServiceOutcome =
  | { ok: true; reply: string }
  | { ok: false; status: number; code: string; error: string; unconfigured?: boolean };

export async function generateLiveCoachReply(params: {
  message: string;
  goal: string | null;
  history: unknown;
}): Promise<LiveCoachServiceOutcome> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      ok: false,
      status: 503,
      code: 'AI_UNCONFIGURED',
      error: 'Live AI credentials are not configured on the server.',
      unconfigured: true,
    };
  }

  const contents = normalizeConversationContents(params.history, params.message);

  try {
    const candidateModels = getOrderedCandidateModels();
    let replyText = '';
    let lastError: unknown = null;

    for (let attempt = 0; attempt < candidateModels.length; attempt += 1) {
      const modelName = candidateModels[attempt];
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              abortSignal: AbortSignal.timeout(12_000),
              systemInstruction: buildSystemInstruction(params.goal),
              ...(modelName === 'gemini-3.8-flash'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          }),
          12_500
        );
        replyText = (response.text ?? '').trim();
        if (replyText) {
          lastWorkingModel = modelName;
          lastError = null;
          break;
        }
      } catch (attemptErr: unknown) {
        lastError = attemptErr;
        const msg =
          attemptErr instanceof Error ? attemptErr.message : String(attemptErr);
        const isAuthFailure =
          /API_KEY_INVALID|PERMISSION_DENIED|unregistered callers|401|403/i.test(msg);
        if (isAuthFailure) {
          break;
        }
        if (attempt < candidateModels.length - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    if (!replyText) {
      return {
        ok: false,
        status: 502,
        code: 'EMPTY_AI_RESPONSE',
        error: 'The AI coach returned an empty reply. Please try again.',
      };
    }

    return { ok: true, reply: replyText };
  } catch (err: unknown) {
    // Never log user message content; only inspect error status/code safely
    const errName = err instanceof Error ? err.name : '';
    const errMessage = err instanceof Error ? err.message : '';
    if (
      errMessage === 'COACH_REQUEST_TIMEOUT' ||
      errName === 'TimeoutError' ||
      /aborted due to timeout|timed out/i.test(errMessage)
    ) {
      return {
        ok: false,
        status: 504,
        code: 'TIMEOUT',
        error:
          'The AI coach took too long to respond. Please try again or use Demo Coach.',
      };
    }
    if (/503|UNAVAILABLE|high demand/i.test(errMessage)) {
      return {
        ok: false,
        status: 503,
        code: 'SERVICE_BUSY',
        error:
          'The live AI service is temporarily experiencing high demand. Retry in a moment or switch to Demo Coach for curated guidance.',
      };
    }
    if (/API_KEY_INVALID|PERMISSION_DENIED|403/i.test(errMessage)) {
      return {
        ok: false,
        status: 502,
        code: 'AUTH_ERROR',
        error:
          'Live AI authentication is currently unavailable. Please try again later or switch to Demo Coach.',
      };
    }
    if (/RESOURCE_EXHAUSTED|429/i.test(errMessage)) {
      return {
        ok: false,
        status: 429,
        code: 'QUOTA_EXCEEDED',
        error:
          'The AI service quota is temporarily busy. Wait a moment and retry, or switch to Demo Coach.',
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'UPSTREAM_ERROR',
      error:
        'Could not reach the live AI coach right now. You can retry your message or switch to Demo Coach.',
    };
  }
}
