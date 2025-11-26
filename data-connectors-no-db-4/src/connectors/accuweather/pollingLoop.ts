export interface PollingConfig {
  intervalMs: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class PollingLoop {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private readonly config: PollingConfig;
  private readonly pollFunction: () => Promise<void>;

  constructor(pollFunction: () => Promise<void>, config: PollingConfig) {
    this.pollFunction = pollFunction;
    this.config = {
      maxRetries: 3,
      retryDelayMs: 5000,
      ...config,
    };
  }

  start(): void {
    if (this.isRunning) {
      console.warn('[PollingLoop] Already running');
      return;
    }

    this.isRunning = true;
    console.log(`[PollingLoop] Started with interval ${this.config.intervalMs}ms`);

    this.poll();
  }

  private poll(): void {
    if (!this.isRunning) return;

    this.pollWithRetry()
      .then(() => {
        if (this.isRunning) {
          this.timer = setTimeout(() => this.poll(), this.config.intervalMs);
        }
      })
      .catch(error => {
        console.error('[PollingLoop] Fatal error:', error);

        if (this.isRunning) {
          this.timer = setTimeout(() => this.poll(), this.config.intervalMs);
        }
      });
  }

  private async pollWithRetry(): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries!; attempt++) {
      try {
        await this.pollFunction();
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `[PollingLoop] Poll attempt ${attempt + 1} failed:`,
          error
        );

        if (attempt < this.config.maxRetries! - 1) {
          await this.sleep(this.config.retryDelayMs!);
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    console.log('[PollingLoop] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
