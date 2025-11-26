import { NormalizedTick, Candle, TimeframeConfig } from '../types/index.js';
import { Buffer } from './buffer.js';

interface CandleInProgress {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  startTime: number;
  lastUpdate: number;
}

export class CandleBuilder {
  private readonly buffers: Map<string, Buffer> = new Map();
  private readonly candlesInProgress: Map<string, CandleInProgress> = new Map();
  private readonly timeframes: TimeframeConfig[];
  private readonly symbol: string;
  private readonly listeners: Array<(candle: Candle, timeframe: string) => void> = [];

  constructor(symbol: string, timeframes: TimeframeConfig[]) {
    this.symbol = symbol;
    this.timeframes = timeframes;

    for (const tf of timeframes) {
      this.buffers.set(tf.label, new Buffer(tf.bufferSize, tf.label));
    }
  }

  addTick(tick: NormalizedTick): void {
    if (tick.symbol !== this.symbol) return;

    const timestamp = new Date(tick.ts).getTime();

    for (const tf of this.timeframes) {
      this.updateCandle(tick, timestamp, tf);
    }
  }

  private updateCandle(tick: NormalizedTick, timestamp: number, tf: TimeframeConfig): void {
    const windowStart = this.getWindowStart(timestamp, tf.seconds);
    const key = `${tf.label}_${windowStart}`;

    let candle = this.candlesInProgress.get(key);

    if (!candle) {
      const existingKeys = Array.from(this.candlesInProgress.keys())
        .filter(k => k.startsWith(tf.label));

      for (const oldKey of existingKeys) {
        const oldCandle = this.candlesInProgress.get(oldKey)!;
        this.finalizeCandle(oldCandle, tf);
        this.candlesInProgress.delete(oldKey);
      }

      candle = {
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.size || 0,
        startTime: windowStart,
        lastUpdate: timestamp,
      };
      this.candlesInProgress.set(key, candle);
    } else {
      candle.high = Math.max(candle.high, tick.price);
      candle.low = Math.min(candle.low, tick.price);
      candle.close = tick.price;
      candle.volume += tick.size || 0;
      candle.lastUpdate = timestamp;
    }
  }

  private getWindowStart(timestamp: number, seconds: number): number {
    const ms = seconds * 1000;
    return Math.floor(timestamp / ms) * ms;
  }

  private finalizeCandle(candle: CandleInProgress, tf: TimeframeConfig): void {
    const finalCandle: Candle = {
      datetime: new Date(candle.startTime).toISOString(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    };

    const buffer = this.buffers.get(tf.label)!;
    buffer.push(finalCandle);

    this.listeners.forEach(listener => listener(finalCandle, tf.label));
  }

  forceFinalizeAll(): void {
    for (const tf of this.timeframes) {
      const keys = Array.from(this.candlesInProgress.keys())
        .filter(k => k.startsWith(tf.label));

      for (const key of keys) {
        const candle = this.candlesInProgress.get(key)!;
        this.finalizeCandle(candle, tf);
        this.candlesInProgress.delete(key);
      }
    }
  }

  getBuffer(timeframeLabel: string): Buffer | undefined {
    return this.buffers.get(timeframeLabel);
  }

  getAllBuffers(): Map<string, Buffer> {
    return this.buffers;
  }

  onCandleComplete(listener: (candle: Candle, timeframe: string) => void): void {
    this.listeners.push(listener);
  }

  getSymbol(): string {
    return this.symbol;
  }
}
