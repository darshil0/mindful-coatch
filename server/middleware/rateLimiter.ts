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
    this.windowMs = Math.max(1, options?.windowMs ?? 60_000);
    this.maxRequests = Math.max(1, options?.maxRequests ?? 15);
    this.maxTrackedKeys = Math.max(1, options?.maxTrackedKeys ?? 500);
  }

  public allow(key: string, nowMs: number = Date.now()): boolean {
    if (this.requestTimestamps.size >= this.maxTrackedKeys && !this.requestTimestamps.has(key)) {
      for (const [trackedKey, list] of this.requestTimestamps.entries()) {
        const fresh = list.filter((t) => nowMs - t < this.windowMs);
        if (fresh.length === 0) {
          this.requestTimestamps.delete(trackedKey);
        } else {
          this.requestTimestamps.set(trackedKey, fresh);
        }
      }
      if (this.requestTimestamps.size >= this.maxTrackedKeys) {
        const oldestKey = this.requestTimestamps.keys().next().value;
        if (oldestKey !== undefined) {
          this.requestTimestamps.delete(oldestKey);
        }
      }
    }

    const timestamps = (this.requestTimestamps.get(key) ?? []).filter(
      (t) => nowMs - t < this.windowMs
    );
    const touchKey = (list: number[]) => {
      this.requestTimestamps.delete(key);
      this.requestTimestamps.set(key, list);
    };
    if (timestamps.length >= this.maxRequests) {
      touchKey(timestamps);
      return false;
    }
    timestamps.push(nowMs);
    touchKey(timestamps);
    return true;
  }
}

export const coachRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 15,
  maxTrackedKeys: 500,
});
