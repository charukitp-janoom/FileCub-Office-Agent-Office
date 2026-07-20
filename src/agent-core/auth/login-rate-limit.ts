const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface Bucket {
  failures: number;
  windowStartedAt: number;
}

const buckets = new Map<string, Bucket>();

/** True if `key` (e.g. remote IP) has failed login too many times recently. */
export function isRateLimited(key: string): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStartedAt > WINDOW_MS) {
    buckets.delete(key);
    return false;
  }
  return bucket.failures >= MAX_ATTEMPTS;
}

export function recordFailure(key: string): void {
  const bucket = buckets.get(key);
  if (!bucket || Date.now() - bucket.windowStartedAt > WINDOW_MS) {
    buckets.set(key, { failures: 1, windowStartedAt: Date.now() });
    return;
  }
  bucket.failures += 1;
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
