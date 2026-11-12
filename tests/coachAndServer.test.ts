import test from 'node:test';
import assert from 'node:assert/strict';
import { detectUrgentSafetyConcern } from '../src/shared/coachSafety';
import { buildCuratedDemoResponse } from '../src/data/demoCoachResponses';
import { normalizeConversationContents } from '../server/services/geminiCoachService';
import { SlidingWindowRateLimiter } from '../server/middleware/rateLimiter';

test('coach safety check prioritizes urgent help and demo weight guidance stays non-restrictive', () => {
  assert.equal(detectUrgentSafetyConcern('I am having chest pain and cant breathe'), true);
  assert.equal(detectUrgentSafetyConcern('How can I wind down after work?'), false);

  const weightDemo = buildCuratedDemoResponse('How do I lose 15 pounds in a week?', 'weight');
  assert.equal(weightDemo.isCrisisNotice, false);
  assert.match(weightDemo.content, /Next steps:/);
  assert.match(weightDemo.content, /Why this may help:/);

  const greetingDemo = buildCuratedDemoResponse('Hello', 'stress');
  assert.equal(greetingDemo.isCrisisNotice, false);
  assert.match(greetingDemo.content, /Next steps:/);

  const afternoonDemo = buildCuratedDemoResponse(
    'How do I beat an afternoon slump without coffee?',
    'energy'
  );
  assert.equal(afternoonDemo.isCrisisNotice, false);
  assert.match(afternoonDemo.content, /caffeine|daylight/i);
});

test('normalizeConversationContents strips leading model turns and merges consecutive roles', () => {
  const contents = normalizeConversationContents(
    [
      { role: 'assistant', content: 'Leading orphan assistant message' },
      { role: 'user', content: 'First question' },
      { role: 'user', content: 'Follow-up user note' },
      { role: 'assistant', content: 'Coach reply' },
    ],
    'New user prompt'
  );

  assert.equal(contents.length, 3);
  assert.equal(contents[0]?.role, 'user');
  assert.equal(contents[0]?.parts[0]?.text, 'First question\n\nFollow-up user note');
  assert.equal(contents[1]?.role, 'model');
  assert.equal(contents[1]?.parts[0]?.text, 'Coach reply');
  assert.equal(contents[2]?.role, 'user');
  assert.equal(contents[2]?.parts[0]?.text, 'New user prompt');
});

test('SlidingWindowRateLimiter enforces per-IP limits and expires old requests', () => {
  const limiter = new SlidingWindowRateLimiter({ windowMs: 10_000, maxRequests: 2 });
  assert.equal(limiter.allow('127.0.0.1', 1_000), true);
  assert.equal(limiter.allow('127.0.0.1', 2_000), true);
  assert.equal(limiter.allow('127.0.0.1', 3_000), false);
  // Different IP is unaffected
  assert.equal(limiter.allow('10.0.0.2', 3_000), true);
  // After window elapses, original IP is allowed again
  assert.equal(limiter.allow('127.0.0.1', 12_000), true);
});
