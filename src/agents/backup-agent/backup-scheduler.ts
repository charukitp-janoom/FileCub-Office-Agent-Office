/**
 * Periodic auto-backup timer. `unref()`s its interval so — like
 * DesktopWatcher — it never single-handedly keeps the Node process (or a
 * test) alive.
 */
export class BackupScheduler {
  private timer?: NodeJS.Timeout;

  start(intervalMs: number, onTick: () => void): void {
    this.stop();
    this.timer = setInterval(onTick, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  get isRunning(): boolean {
    return this.timer !== undefined;
  }
}
