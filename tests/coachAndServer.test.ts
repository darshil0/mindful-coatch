import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import {
  detectUrgentSafetyConcern,
  evaluateSafetySignal,
  isCannedSafetyResponse,
  normalizeSafetyText,
  URGENT_SELF_HARM_RESPONSE,
} from '../src/shared/coachSafety';
import { buildCuratedDemoResponse } from '../src/data/demoCoachResponses';
import {
  classifyUpstreamError,
  evaluateConversationHistoryPolicy,
  generateLiveCoachReply,
  normalizeConversationContents,
} from '../server/services/geminiCoachService';
import {
  ConcurrencySemaphore,
  GlobalBudgetLimiter,
  SlidingWindowRateLimiter,
} from '../server/middleware/rateLimiter';
import { resolveTrustProxyConfig } from '../server/config';
import { createApp } from '../server';

async function withTestServer(
  options: Parameters<typeof createApp>[0],
  run: (baseUrl: string) => Promise<void>
) {
  const app = await createApp(options);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('coach safety handles Unicode normalization, zero-width evasion, crisis variants, benign idioms, and ambiguous distress (H1/H2)', () => {
  // Typographic curly apostrophe + Unicode NFKC
  assert.equal(normalizeSafetyText('Ｉ don’t\u200B want to live anymore'), 'i don\'t want to live anymore');
  assert.equal(detectUrgentSafetyConcern('I don’t want to live anymore'), true);
  assert.equal(detectUrgentSafetyConcern('How do I k\u200Bill myself'), true);
  assert.equal(detectUrgentSafetyConcern('Thinking about ending my life tonight'), true);
  assert.equal(detectUrgentSafetyConcern('Thinking about taking my own life'), true);
  assert.equal(detectUrgentSafetyConcern('I think I am having a heart attack'), true);
  assert.equal(detectUrgentSafetyConcern('Someone here is having a seizure and choking'), true);
  assert.equal(detectUrgentSafetyConcern('I took too many pills'), true);
  assert.equal(detectUrgentSafetyConcern('I want to unalive myself'), true);

  // Benign everyday idioms must not lock out normal coaching
  assert.equal(detectUrgentSafetyConcern('I need to cut myself some slack at work'), false);
  assert.equal(detectUrgentSafetyConcern('My friend is passing out flyers at the park'), false);
  assert.equal(detectUrgentSafetyConcern('How can I wind down after work?'), false);

  // Ambiguous somatic stress phrase should suppress upstream AI cautiously without diagnosing an emergency
  const stressBreath = evaluateSafetySignal("I can't breathe at work with all these deadlines");
  assert.equal(stressBreath.category, 'ambiguous_distress');
  assert.equal(stressBreath.requiresUpstreamSuppression, true);
  assert.ok(stressBreath.response);
  assert.match(stressBreath.response, /findahelpline\.com/i);
  assert.match(stressBreath.response, /112/);
  assert.equal(isCannedSafetyResponse(stressBreath.response), true);

  // Demo weight/energy guidance stays non-restrictive
  const weightDemo = buildCuratedDemoResponse('How do I lose 15 pounds in a week?', 'weight');
  assert.equal(weightDemo.isCrisisNotice, false);
  assert.match(weightDemo.content, /Next steps:/);
  assert.match(weightDemo.content, /Why this may help:/);

  const afternoonDemo = buildCuratedDemoResponse(
    'How do I beat an afternoon slump without coffee?',
    'energy'
  );
  assert.equal(afternoonDemo.isCrisisNotice, false);
  assert.match(afternoonDemo.content, /caffeine|daylight/i);
});

test('multi-turn crisis history strips urgent turns, blocks ambiguous crisis follow-ups locally, and normalizes alternating roles (M2)', async () => {
  const policy = evaluateConversationHistoryPolicy(
    [
      { role: 'user', content: 'How can I sleep better?' },
      { role: 'assistant', content: 'Keep a dark, cool room.' },
      { role: 'user', content: 'I want to end my life right now' },
      { role: 'assistant', content: URGENT_SELF_HARM_RESPONSE },
    ],
    'what should i do'
  );
  assert.equal(policy.suppressedLocally, true);
  assert.ok(policy.crisisResponse);

  // Tampered or longer benign follow-up strips prior crisis turn and canned response before contacting upstream
  const longTopicShift = evaluateConversationHistoryPolicy(
    [
      { role: 'user', content: 'How can I sleep better?' },
      { role: 'assistant', content: 'Keep a dark, cool room.' },
      { role: 'user', content: 'I want to end my life right now' },
      { role: 'assistant', content: 'Tampered assistant reply immediately after crisis' },
    ],
    'Can you share three gentle morning stretching habits for a stiff neck and shoulders?'
  );
  assert.equal(longTopicShift.suppressedLocally, false);
  assert.deepEqual(longTopicShift.sanitizedHistory, [
    { role: 'user', content: 'How can I sleep better?' },
    { role: 'assistant', content: 'Keep a dark, cool room.' },
  ]);

  let upstreamCalled = false;
  const localStopOutcome = await generateLiveCoachReply(
    {
      message: 'help',
      goal: 'stress',
      history: [
        { role: 'user', content: 'I took too many pills' },
        { role: 'assistant', content: URGENT_SELF_HARM_RESPONSE },
      ],
    },
    {
      generateContent: async () => {
        upstreamCalled = true;
        return { text: 'should never run' };
      },
    }
  );
  assert.equal(upstreamCalled, false);
  assert.equal(localStopOutcome.ok, false);

  const contents = normalizeConversationContents(
    [
      { role: 'assistant', content: 'Leading orphan assistant message' },
      { role: 'user', content: 'First question' },
      { role: 'user', content: 'Follow-up user note' },
      { role: 'assistant', content: 'Coach reply' },
      { role: 'user', content: '' },
      null,
      'malformed',
    ],
    'New user prompt'
  );
  assert.equal(contents.length, 3);
  assert.equal(contents[0]?.role, 'user');
  assert.equal(contents[0]?.parts[0]?.text, 'First question\n\nFollow-up user note');
  assert.equal(contents[1]?.role, 'model');
  assert.equal(contents[2]?.role, 'user');
});

test('SlidingWindowRateLimiter resists key churn eviction, enforces GlobalBudgetLimiter, and releases ConcurrencySemaphore on abort (H3)', async () => {
  const limiter = new SlidingWindowRateLimiter({
    windowMs: 10_000,
    maxRequests: 2,
    maxTrackedKeys: 2,
  });

  // Saturate ip-1 and track ip-2
  assert.equal(limiter.allow('ip-1', 1_000), true);
  assert.equal(limiter.allow('ip-2', 1_000), true);
  assert.equal(limiter.allow('ip-1', 1_100), true);
  assert.equal(limiter.check('ip-1', 1_200).allowed, false);

  // Churn 50 new keys at same timestamp: active ip-1 MUST NOT be evicted or reset!
  for (let i = 0; i < 50; i += 1) {
    limiter.allow(`churn-${i}`, 1_300);
  }
  const activeCheck = limiter.check('ip-1', 1_400);
  assert.equal(activeCheck.allowed, false);
  assert.ok(activeCheck.retryAfterSeconds >= 1);
  // Overflow bucket limits excess new churned keys too
  assert.equal(limiter.allow('churn-overflow-blocked', 1_400), false);
  // Once window expires, ip-1 is allowed again
  assert.equal(limiter.allow('ip-1', 12_000), true);

  const budget = new GlobalBudgetLimiter({ windowMs: 10_000, maxRequests: 3, maxChars: 100 });
  assert.equal(budget.consume(60, 1_000).allowed, true);
  assert.equal(budget.consume(50, 1_100).allowed, false);
  assert.equal(budget.consume(30, 1_200).allowed, true);
  assert.equal(budget.consume(1, 1_300).allowed, false);

  const sem = new ConcurrencySemaphore(1, 1);
  const rel1 = await sem.acquire();
  assert.equal(sem.getActiveCount(), 1);
  const ac = new AbortController();
  const queuedPromise = sem.acquire(ac.signal);
  assert.equal(sem.getQueueLength(), 1);
  await assert.rejects(() => sem.acquire(), /CONCURRENCY_QUEUE_FULL/);
  ac.abort();
  await assert.rejects(() => queuedPromise, /REQUEST_ABORTED/);
  assert.equal(sem.getQueueLength(), 0);
  rel1();
  rel1(); // idempotent double release
  assert.equal(sem.getActiveCount(), 0);
});

test('upstream error classification stops immediately on 401/403 and preserves highest-priority status on failover (L1/L3)', async () => {
  const authErr = Object.assign(new Error('Permission denied'), { status: 403 });
  const classifiedAuth = classifyUpstreamError(authErr);
  assert.equal(classifiedAuth.status, 502);
  assert.equal(classifiedAuth.code, 'AUTH_ERROR');
  assert.equal(classifiedAuth.retryableAcrossModels, false);

  let attempts = 0;
  const noRetryAuth = await generateLiveCoachReply(
    { message: 'How can I sleep better?', goal: 'sleep', history: [] },
    {
      candidateModels: [
        { id: 'primary-model', supportsThinkingLow: true },
        { id: 'fallback-model', supportsThinkingLow: false },
      ],
      generateContent: async () => {
        attempts += 1;
        throw authErr;
      },
    }
  );
  assert.equal(attempts, 1);
  assert.equal(noRetryAuth.ok, false);
  if (!noRetryAuth.ok) {
    assert.equal(noRetryAuth.status, 502);
    assert.equal(noRetryAuth.code, 'AUTH_ERROR');
  }

  // Primary fails with 503 overload, secondary fails with generic error -> 503 preserved
  const failoverStatus = await generateLiveCoachReply(
    { message: 'How can I sleep better?', goal: 'sleep', history: [] },
    {
      candidateModels: [
        { id: 'primary-model', supportsThinkingLow: false },
        { id: 'fallback-model', supportsThinkingLow: false },
      ],
      generateContent: async (args) => {
        if (args.model === 'primary-model') {
          throw Object.assign(new Error('Service overloaded'), { status: 503 });
        }
        throw new Error('Unknown downstream failure');
      },
    }
  );
  assert.equal(failoverStatus.ok, false);
  if (!failoverStatus.ok) {
    assert.equal(failoverStatus.status, 503);
    assert.equal(failoverStatus.code, 'SERVICE_BUSY');
  }
});

test('resolveTrustProxyConfig defaults safely to false and rejects unsafe true or invalid specs (H3)', () => {
  assert.equal(resolveTrustProxyConfig(undefined), false);
  assert.equal(resolveTrustProxyConfig('false'), false);
  assert.equal(resolveTrustProxyConfig('1'), 1);
  assert.equal(resolveTrustProxyConfig('loopback'), 'loopback');
  assert.throws(() => resolveTrustProxyConfig('true'), /wildcard "true" is disallowed/i);
  assert.throws(() => resolveTrustProxyConfig('99'), /hop count/i);
  assert.throws(() => resolveTrustProxyConfig('not-an-ip'), /Invalid TRUST_PROXY/i);
});

test('Express app enforces spoofed X-Forwarded-For rate limits, crisis short-circuit, JSON error codes, and production Helmet CSP headers (H3/L1/M7/M8)', async () => {
  let upstreamCalls = 0;
  await withTestServer(
    {
      isProduction: false,
      trustProxy: false,
      coachDeps: {
        isLiveConfigured: () => true,
        rateLimiter: new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 15 }),
        globalBudgetLimiter: new GlobalBudgetLimiter({
          windowMs: 60_000,
          maxRequests: 100,
          maxChars: 100_000,
        }),
        generateReply: async ({ message }) => {
          upstreamCalls += 1;
          return { ok: true, reply: `Mock reply to: ${message.slice(0, 12)}` };
        },
      },
    },
    async (baseUrl) => {
      // Status endpoint
      const statusRes = await fetch(`${baseUrl}/api/coach/status`);
      assert.equal(statusRes.status, 200);
      assert.deepEqual(await statusRes.json(), { liveAiAvailable: true });

      // 40 requests with distinct spoofed X-Forwarded-For headers must still hit 429 on #16..40
      let okCount = 0;
      let rateLimitedCount = 0;
      for (let i = 0; i < 40; i += 1) {
        const res = await fetch(`${baseUrl}/api/coach/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `203.0.113.${(i % 250) + 1}`,
          },
          body: JSON.stringify({
            message: 'Gentle stretching ideas?',
            goal: 'stress',
            history: [],
          }),
        });
        if (res.status === 200) okCount += 1;
        if (res.status === 429) {
          rateLimitedCount += 1;
          assert.ok(Number(res.headers.get('retry-after')) >= 1);
        }
      }
      assert.equal(okCount, 15);
      assert.equal(rateLimitedCount, 25);
      assert.equal(upstreamCalls, 15);

      // Even after being rate-limited, urgent crisis request bypasses rate limit & upstream
      const crisisRes = await fetch(`${baseUrl}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'I am ending my life tonight',
          goal: 'stress',
          history: [],
        }),
      });
      assert.equal(crisisRes.status, 200);
      const crisisBody = (await crisisRes.json()) as {
        isCrisisNotice: boolean;
        mode: string;
      };
      assert.equal(crisisBody.isCrisisNotice, true);
      assert.equal(crisisBody.mode, 'demo');
      assert.equal(upstreamCalls, 15);

      // Malformed JSON -> 400 INVALID_JSON; >64kb -> 413; unknown API route -> 404
      const badJsonRes = await fetch(`${baseUrl}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad json',
      });
      assert.equal(badJsonRes.status, 400);

      const largeRes = await fetch(`${baseUrl}/api/coach/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'a'.repeat(70_000) }),
      });
      assert.equal(largeRes.status, 413);

      const missingRes = await fetch(`${baseUrl}/api/nonexistent`);
      assert.equal(missingRes.status, 404);
    }
  );

  // Verify production Helmet headers & dist serving on ephemeral dir
  const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'mindful-dist-'));
  fs.mkdirSync(path.join(tmpDist, 'assets'));
  fs.writeFileSync(path.join(tmpDist, 'index.html'), '<!doctype html><html><body>ok</body></html>');
  try {
    await withTestServer(
      {
        isProduction: true,
        distPath: tmpDist,
        trustProxy: false,
        coachDeps: { isLiveConfigured: () => false },
      },
      async (baseUrl) => {
        const htmlRes = await fetch(`${baseUrl}/`);
        assert.equal(htmlRes.status, 200);
        const csp = htmlRes.headers.get('content-security-policy') ?? '';
        assert.match(csp, /default-src 'self'/);
        assert.match(csp, /script-src 'self'/);
        assert.match(csp, /font-src 'self'/);
        assert.equal(htmlRes.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(htmlRes.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(htmlRes.headers.get('x-frame-options'), 'DENY');

        // Missing asset in /assets/ must 404 rather than serving index.html
        const missingAssetRes = await fetch(`${baseUrl}/assets/missing.js`);
        assert.equal(missingAssetRes.status, 404);
      }
    );
  } finally {
    fs.rmSync(tmpDist, { recursive: true, force: true });
  }
});
