import { Router, type NextFunction, type Request, type Response } from 'express';
import {
  evaluateSafetySignal,
  MAX_COACH_HISTORY_TURN_CHARS,
  MAX_COACH_HISTORY_TURNS,
  MAX_COACH_MESSAGE_LENGTH,
} from '../../src/shared/coachSafety.ts';
import { isValidWellnessGoal } from '../../src/lib/validation.ts';
import { isLiveGeminiConfigured, SERVER_LIMITS } from '../config.ts';
import {
  coachRateLimiter,
  ConcurrencySemaphore,
  GlobalBudgetLimiter,
  SlidingWindowRateLimiter,
} from '../middleware/rateLimiter.ts';
import {
  evaluateConversationHistoryPolicy,
  generateLiveCoachReply,
  type LiveCoachServiceOutcome,
} from '../services/geminiCoachService.ts';

interface IncomingChatBody {
  message?: unknown;
  goal?: unknown;
  history?: unknown;
}

export interface CoachRouterDependencies {
  isLiveConfigured?: () => boolean;
  rateLimiter?: SlidingWindowRateLimiter;
  globalBudgetLimiter?: GlobalBudgetLimiter;
  semaphore?: ConcurrencySemaphore;
  generateReply?: (params: {
    message: string;
    goal: string | null;
    history: unknown;
    signal?: AbortSignal;
  }) => Promise<LiveCoachServiceOutcome>;
}

const defaultGlobalBudgetLimiter = new GlobalBudgetLimiter({
  windowMs: 60_000,
  maxRequests: SERVER_LIMITS.globalMaxRequestsPerMin,
  maxChars: SERVER_LIMITS.globalMaxInputCharsPerMin,
});

const defaultConcurrencySemaphore = new ConcurrencySemaphore(
  SERVER_LIMITS.maxConcurrentGeminiRequests,
  SERVER_LIMITS.maxGeminiQueueSize
);

function estimateIncomingCharCost(message: string, history: unknown): number {
  let total = message.length;
  if (Array.isArray(history)) {
    const slice = history.slice(-MAX_COACH_HISTORY_TURNS);
    for (const item of slice) {
      if (item && typeof item === 'object') {
        const content = (item as Record<string, unknown>).content;
        if (typeof content === 'string') {
          total += Math.min(content.length, MAX_COACH_HISTORY_TURN_CHARS);
        }
      }
    }
  }
  return total;
}

export function createCoachRouter(deps?: CoachRouterDependencies): Router {
  const router = Router();
  const checkLiveConfigured = deps?.isLiveConfigured ?? isLiveGeminiConfigured;
  const ipLimiter = deps?.rateLimiter ?? coachRateLimiter;
  const globalBudget = deps?.globalBudgetLimiter ?? defaultGlobalBudgetLimiter;
  const concurrencyGuard = deps?.semaphore ?? defaultConcurrencySemaphore;
  const runGenerateReply = deps?.generateReply ?? generateLiveCoachReply;

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      liveAiAvailable: checkLiveConfigured(),
    });
  });

  router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (
        typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body)
          ? req.body
          : {}
      ) as IncomingChatBody;
      const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';

      if (!rawMessage) {
        res.status(400).json({
          error: 'Please enter a question or reflection before sending.',
          code: 'EMPTY_MESSAGE',
        });
        return;
      }

      if (rawMessage.length > MAX_COACH_MESSAGE_LENGTH) {
        res.status(400).json({
          error: 'Please keep your message under 1,200 characters.',
          code: 'MESSAGE_TOO_LONG',
        });
        return;
      }

      // Immediate safety evaluation (current turn AND ongoing crisis follow-up history) before rate limiting or upstream calls
      const currentSafety = evaluateSafetySignal(rawMessage);
      if (currentSafety.requiresUpstreamSuppression && currentSafety.response) {
        res.json({
          reply: currentSafety.response,
          mode: 'demo',
          isCrisisNotice: true,
        });
        return;
      }

      const historySafety = evaluateConversationHistoryPolicy(body.history, rawMessage);
      if (historySafety.suppressedLocally && historySafety.crisisResponse) {
        res.json({
          reply: historySafety.crisisResponse,
          mode: 'demo',
          isCrisisNotice: true,
        });
        return;
      }

      const clientIp = req.ip || req.socket.remoteAddress || 'local';
      const ipRate = ipLimiter.check(clientIp);
      if (!ipRate.allowed) {
        res.set('Retry-After', String(ipRate.retryAfterSeconds));
        res.status(429).json({
          error:
            'Too many messages sent in a short period. Please pause a moment and try again.',
          code: 'RATE_LIMITED',
        });
        return;
      }

      const charCost = estimateIncomingCharCost(rawMessage, historySafety.sanitizedHistory);
      const budgetCheck = globalBudget.consume(charCost);
      if (!budgetCheck.allowed) {
        res.set('Retry-After', String(budgetCheck.retryAfterSeconds));
        res.status(429).json({
          error:
            'The AI coach is currently at capacity. Please wait a moment and try again, or use Demo Coach.',
          code: 'GLOBAL_RATE_LIMITED',
        });
        return;
      }

      const abortController = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      };
      req.on('close', onClose);

      let releaseSlot: (() => void) | null = null;
      try {
        releaseSlot = await concurrencyGuard.acquire(abortController.signal);
        const goal = isValidWellnessGoal(body.goal) ? body.goal : null;
        const outcome = await runGenerateReply({
          message: rawMessage,
          goal,
          history: historySafety.sanitizedHistory,
          signal: abortController.signal,
        });

        if (abortController.signal.aborted || res.writableEnded) {
          return;
        }

        if (!outcome.ok) {
          res.status(outcome.status).json({
            error: outcome.error,
            code: outcome.code,
            ...(outcome.unconfigured ? { liveAiAvailable: false } : {}),
          });
          return;
        }

        res.json({
          reply: outcome.reply,
          mode: 'live',
          isCrisisNotice: false,
        });
      } catch (guardErr: unknown) {
        const msg = guardErr instanceof Error ? guardErr.message : '';
        if (msg === 'CONCURRENCY_QUEUE_FULL') {
          res.set('Retry-After', '5');
          res.status(503).json({
            error:
              'Live AI is temporarily busy handling multiple requests. Please retry in a few seconds or switch to Demo Coach.',
            code: 'SERVICE_BUSY',
          });
          return;
        }
        if (msg === 'REQUEST_ABORTED') {
          return;
        }
        throw guardErr;
      } finally {
        req.off('close', onClose);
        if (releaseSlot) {
          releaseSlot();
        }
      }
    } catch (err: unknown) {
      next(err);
    }
  });

  return router;
}
