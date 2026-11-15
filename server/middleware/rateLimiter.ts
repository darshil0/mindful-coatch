/**
 * Process-local rate limiter, global budget tracker, and bounded concurrency guard.
 *
 * NOTE: In-memory limits are strictly per-Node process and reset on restart.
 * Multi-instance production deployments require a shared external store (e.g. Redis)
 * or edge gateway rate limiting.
 */

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

const OVERFLOW_BUCKET_KEY = '__overflow__';

export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxTrackedKeys: number;
  private readonly requestTimestamps = new Map<string, number[]>();

  constructor(options?: {
    windowMs?: number;
    maxRequests?: number;
    maxTrackedKeys?: number;
  }) {
    this.windowMs = Math.max(1, options?.windowMs ?? 60_000);
    this.maxRequests = Math.max(1, options?.maxRequests ?? 15);
    this.maxTrackedKeys = Math.max(1, options?.maxTrackedKeys ?? 500);
  }

  private pruneExpired(nowMs: number): void {
    for (const [trackedKey, list] of this.requestTimestamps.entries()) {
      const fresh = list.filter((t) => nowMs - t < this.windowMs);
      if (fresh.length === 0) {
        this.requestTimestamps.delete(trackedKey);
      } else if (fresh.length !== list.length) {
        this.requestTimestamps.set(trackedKey, fresh);
      }
    }
  }

  public getTrackedKeyCount(): number {
    return this.requestTimestamps.size;
  }

  public check(key: string, nowMs: number = Date.now()): RateLimitCheckResult {
    let targetKey = key;

    // Never evict an active non-expired user's counter when an attacker churns new keys:
    // prune expired entries first, and if still full, funnel un-tracked keys into a shared overflow bucket.
    if (
      this.requestTimestamps.size >= this.maxTrackedKeys &&
      !this.requestTimestamps.has(key)
    ) {
      this.pruneExpired(nowMs);
      if (this.requestTimestamps.size >= this.maxTrackedKeys) {
        targetKey = OVERFLOW_BUCKET_KEY;
      }
    }

    const timestamps = (this.requestTimestamps.get(targetKey) ?? []).filter(
      (t) => nowMs - t < this.windowMs
    );

    if (timestamps.length >= this.maxRequests) {
      this.requestTimestamps.delete(targetKey);
      this.requestTimestamps.set(targetKey, timestamps);
      const oldestInWindow = timestamps[0] ?? nowMs;
      const retryAfterMs = Math.max(1000, this.windowMs - (nowMs - oldestInWindow));
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    timestamps.push(nowMs);
    this.requestTimestamps.delete(targetKey);
    this.requestTimestamps.set(targetKey, timestamps);
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  public allow(key: string, nowMs: number = Date.now()): boolean {
    return this.check(key, nowMs).allowed;
  }
}

export class GlobalBudgetLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxChars: number;
  private entries: { ts: number; chars: number }[] = [];

  constructor(options: { windowMs: number; maxRequests: number; maxChars: number }) {
    this.windowMs = Math.max(1, options.windowMs);
    this.maxRequests = Math.max(1, options.maxRequests);
    this.maxChars = Math.max(1, options.maxChars);
  }

  public consume(
    charCost: number,
    nowMs: number = Date.now()
  ): RateLimitCheckResult {
    this.entries = this.entries.filter((e) => nowMs - e.ts < this.windowMs);
    const totalChars = this.entries.reduce((acc, item) => acc + item.chars, 0);

    if (
      this.entries.length >= this.maxRequests ||
      totalChars + Math.max(0, charCost) > this.maxChars
    ) {
      const oldestTs = this.entries[0]?.ts ?? nowMs;
      const retryAfterMs = Math.max(1000, this.windowMs - (nowMs - oldestTs));
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    this.entries.push({ ts: nowMs, chars: Math.max(0, charCost) });
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export class ConcurrencySemaphore {
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private activeCount = 0;
  private readonly waitQueue: {
    resolve: () => void;
    reject: (err: Error) => void;
  }[] = [];

  constructor(maxConcurrent: number, maxQueueSize: number) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.maxQueueSize = Math.max(0, maxQueueSize);
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getQueueLength(): number {
    return this.waitQueue.length;
  }

  public async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw new Error('REQUEST_ABORTED');
    }

    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return this.createReleaseFn();
    }

    if (this.waitQueue.length >= this.maxQueueSize) {
      throw new Error('CONCURRENCY_QUEUE_FULL');
    }

    await new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      const onAbort = () => {
        const idx = this.waitQueue.indexOf(waiter);
        if (idx !== -1) {
          this.waitQueue.splice(idx, 1);
        }
        reject(new Error('REQUEST_ABORTED'));
      };

      this.waitQueue.push({
        resolve: () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        },
        reject: (err: Error) => {
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        },
      });

      signal?.addEventListener('abort', onAbort, { once: true });
    });

    this.activeCount += 1;
    return this.createReleaseFn();
  }

  private createReleaseFn(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeCount = Math.max(0, this.activeCount - 1);
      const next = this.waitQueue.shift();
      if (next) {
        next.resolve();
      }
    };
  }
}

export const coachRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 15,
  maxTrackedKeys: 500,
});
