/**
 * Sliding-window counter: flags a user once they rack up `threshold`
 * tracked events within `windowMs`. Deliberately storage-agnostic (no DB,
 * no event bus) so it's trivial to unit test; SecurityAgent wires it to
 * `security.permission_denied` events and publishes `security.anomaly`
 * when `record()` trips.
 */
export class AnomalyDetector {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly threshold = 3,
    private readonly windowMs = 60_000,
  ) {}

  /** Records one occurrence for `userId` and returns true the moment the threshold is crossed. */
  record(userId: string, now = Date.now()): boolean {
    const timestamps = (this.hits.get(userId) ?? []).filter((t) => now - t < this.windowMs);
    timestamps.push(now);
    this.hits.set(userId, timestamps);
    return timestamps.length >= this.threshold;
  }

  reset(userId: string): void {
    this.hits.delete(userId);
  }
}
