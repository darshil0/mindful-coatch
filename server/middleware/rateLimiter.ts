/**
 * Per-IP sliding-window rate limiter with bounded map pruning.
 */
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
    this.windowMs = options?.windowMs ?? 60_000;
    this.maxRequests = options?.maxRequests ?? 15;
    this.maxTrackedKeys = options?.maxTrackedKeys ?? 500;
  }

  public allow(key: string, nowMs: number = Date.now()): boolean {
    if (this.requestTimestamps.size > this.maxTrackedKeys) {
      for (const [trackedKey, list] of this.requestTimestamps.entries()) {
        const fresh = list.filter((t) => nowMs - t < this.windowMs);
        if (fresh.length === 0) {
          this.requestTimestamps.delete(trackedKey);
        } else {
          this.requestTimestamps.set(trackedKey, fresh);
        }
      }
    }

    const timestamps = (this.requestTimestamps.get(key) ?? []).filter(
      (t) => nowMs - t < this.windowMs
    );
    if (timestamps.length >= this.maxRequests) {
      this.requestTimestamps.set(key, timestamps);
      return false;
    }
    timestamps.push(nowMs);
    this.requestTimestamps.set(key, timestamps);
    return true;
  }
}

export const coachRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 15,
  maxTrackedKeys: 500,
});
