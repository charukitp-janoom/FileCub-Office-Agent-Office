import { watch, type FSWatcher } from "chokidar";

/**
 * Thin chokidar wrapper: watches a directory and calls `onFileAdded` for
 * every file that shows up, once its write has settled (`awaitWriteFinish`
 * avoids importing a file that's still being copied onto Desktop).
 */
export class DesktopWatcher {
  private watcher?: FSWatcher;
  private readyPromise?: Promise<void>;

  start(path: string, onFileAdded: (filePath: string) => void): void {
    void this.stop();
    const watcher = watch(path, {
      ignoreInitial: true,
      depth: 0,
      // false so the watcher never single-handedly keeps the Node process
      // alive — the app (HTTP server / Electron main process) already does
      // that, and leaving this true was observed to leak an open handle
      // that survives watcher.close() in this environment.
      persistent: false,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });
    watcher.on("add", onFileAdded);
    this.watcher = watcher;
    this.readyPromise = new Promise((resolve) => watcher.once("ready", resolve));
  }

  /** Resolves once the initial directory scan is done and new files will reliably fire `add`. */
  async ready(): Promise<void> {
    await this.readyPromise;
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = undefined;
    this.readyPromise = undefined;
  }

  get isRunning(): boolean {
    return this.watcher !== undefined;
  }
}
