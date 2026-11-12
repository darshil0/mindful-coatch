import { Router, type Request, type Response } from 'express';
import {
  detectUrgentSafetyConcern,
  MAX_COACH_MESSAGE_LENGTH,
  URGENT_SAFETY_RESPONSE,
} from '../../src/shared/coachSafety.ts';
import { isValidWellnessGoal } from '../../src/lib/validation.ts';
import { isLiveGeminiConfigured } from '../config.ts';
import { coachRateLimiter } from '../middleware/rateLimiter.ts';
import { generateLiveCoachReply } from '../services/geminiCoachService.ts';

interface IncomingChatBody {
  message?: unknown;
  goal?: unknown;
  history?: unknown;
}

export function createCoachRouter(): Router {
  const router = Router();

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      liveAiAvailable: isLiveGeminiConfigured(),
    });
  });

  router.post('/chat', async (req: Request, res: Response) => {
    const clientIp = req.ip || 'local';
    if (!coachRateLimiter.allow(clientIp)) {
      res.status(429).json({
        error:
          'Too many messages sent in a short period. Please pause a moment and try again.',
        code: 'RATE_LIMITED',
      });
      return;
    }

    const body = (req.body ?? {}) as IncomingChatBody;
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

    // Immediate safety check before calling external AI
    if (detectUrgentSafetyConcern(rawMessage)) {
      res.json({
        reply: URGENT_SAFETY_RESPONSE,
        mode: isLiveGeminiConfigured() ? 'live' : 'demo',
        isCrisisNotice: true,
      });
      return;
    }

    const goal = isValidWellnessGoal(body.goal) ? body.goal : null;
    const outcome = await generateLiveCoachReply({
      message: rawMessage,
      goal,
      history: body.history,
    });

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
  });

  return router;
}
