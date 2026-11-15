import type {
  CoachApiErrorResponse,
  CoachChatRequest,
  CoachChatSuccessResponse,
  CoachStatusResponse,
} from '../shared/apiTypes';

export type CoachChatApiResult =
  | {
      ok: true;
      data: CoachChatSuccessResponse;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
      unconfigured: boolean;
      retryAfterSeconds?: number;
    };

export async function fetchCoachStatus(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch('/api/coach/status', { signal });
    if (!response.ok) {
      return false;
    }
    const payload = (await response.json()) as Partial<CoachStatusResponse>;
    return Boolean(payload.liveAiAvailable);
  } catch {
    return false;
  }
}

export async function sendCoachChatMessage(
  request: CoachChatRequest,
  signal?: AbortSignal
): Promise<CoachChatApiResult> {
  const response = await fetch('/api/coach/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(request),
  });

  const retryAfterHeader = response.headers.get('Retry-After');
  const parsedRetry =
    retryAfterHeader && /^\d+$/.test(retryAfterHeader.trim())
      ? Number(retryAfterHeader.trim())
      : undefined;

  const payload = (await response.json().catch(() => ({}))) as Partial<
    CoachChatSuccessResponse & CoachApiErrorResponse
  >;

  if (!response.ok || !payload.reply) {
    const unconfigured =
      payload.code === 'AI_UNCONFIGURED' || payload.liveAiAvailable === false;
    return {
      ok: false,
      status: response.status,
      error: payload.error || 'Live AI is temporarily unavailable.',
      code: payload.code || 'UPSTREAM_ERROR',
      unconfigured,
      retryAfterSeconds: parsedRetry,
    };
  }

  return {
    ok: true,
    data: {
      reply: payload.reply,
      mode: payload.mode === 'demo' ? 'demo' : 'live',
      isCrisisNotice: payload.isCrisisNotice === true,
    },
  };
}
