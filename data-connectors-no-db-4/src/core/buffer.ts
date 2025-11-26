import { Candle } from '../types/index.js';

export class Buffer {
  private readonly maxSize: number;
  private readonly candles: Candle[] = [];
  private readonly timeframeLabel: string;

  constructor(maxSize: number, timeframeLabel: string) {
    this.maxSize = maxSize;
    this.timeframeLabel = timeframeLabel;
  }

  push(candle: Candle): void {
    this.candles.push(candle);

    if (this.candles.length > this.maxSize) {
      this.candles.shift();
    }
  }

  getAll(): Candle[] {
    return [...this.candles];
  }

  getLast(count: number): Candle[] {
    return this.candles.slice(-count);
  }

  size(): number {
    return this.candles.length;
  }

  isFull(): boolean {
    return this.candles.length >= this.maxSize;
  }

  clear(): void {
    this.candles.length = 0;
  }

  getTimeframeLabel(): string {
    return this.timeframeLabel;
  }

  getOldestTimestamp(): string | null {
    if (this.candles.length === 0) return null;
    return this.candles[0].datetime;
  }

  getNewestTimestamp(): string | null {
    if (this.candles.length === 0) return null;
    return this.candles[this.candles.length - 1].datetime;
  }
}
