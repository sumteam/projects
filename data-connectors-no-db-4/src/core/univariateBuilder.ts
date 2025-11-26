import { NormalizedTick, UnivariateDataPoint, TimeframeConfig } from '../types/index.js';
import { UnivariateBuffer } from './univariateBuffer.js';

interface DataPointInProgress {
  value: number;
  startTime: number;
  lastUpdate: number;
  count: number;
  sum: number;
}

export class UnivariateBuilder {
  private readonly buffers: Map<string, UnivariateBuffer> = new Map();
  private readonly dataPointsInProgress: Map<string, DataPointInProgress> = new Map();
  private readonly timeframes: TimeframeConfig[];
  private readonly symbol: string;
  private readonly listeners: Array<(dataPoint: UnivariateDataPoint, timeframe: string) => void> = [];

  constructor(symbol: string, timeframes: TimeframeConfig[]) {
    this.symbol = symbol;
    this.timeframes = timeframes;

    for (const tf of timeframes) {
      this.buffers.set(tf.label, new UnivariateBuffer(tf.bufferSize, tf.label));
    }
  }

  addTick(tick: NormalizedTick): void {
    if (tick.symbol !== this.symbol) return;

    const timestamp = new Date(tick.ts).getTime();

    for (const tf of this.timeframes) {
      this.updateDataPoint(tick, timestamp, tf);
    }
  }

  private updateDataPoint(tick: NormalizedTick, timestamp: number, tf: TimeframeConfig): void {
    const windowStart = this.getWindowStart(timestamp, tf.seconds);
    const key = `${tf.label}_${windowStart}`;

    let dataPoint = this.dataPointsInProgress.get(key);

    if (!dataPoint) {
      const existingKeys = Array.from(this.dataPointsInProgress.keys())
        .filter(k => k.startsWith(tf.label));

      for (const oldKey of existingKeys) {
        const oldDataPoint = this.dataPointsInProgress.get(oldKey)!;
        this.finalizeDataPoint(oldDataPoint, tf);
        this.dataPointsInProgress.delete(oldKey);
      }

      dataPoint = {
        value: tick.price,
        startTime: windowStart,
        lastUpdate: timestamp,
        count: 1,
        sum: tick.price,
      };
      this.dataPointsInProgress.set(key, dataPoint);
    } else {
      dataPoint.value = tick.price;
      dataPoint.lastUpdate = timestamp;
      dataPoint.count++;
      dataPoint.sum += tick.price;
    }
  }

  private getWindowStart(timestamp: number, seconds: number): number {
    const ms = seconds * 1000;
    return Math.floor(timestamp / ms) * ms;
  }

  private finalizeDataPoint(dataPoint: DataPointInProgress, tf: TimeframeConfig): void {
    const finalDataPoint: UnivariateDataPoint = {
      datetime: new Date(dataPoint.startTime).toISOString(),
      value: dataPoint.value,
    };

    const buffer = this.buffers.get(tf.label)!;
    buffer.push(finalDataPoint);

    this.listeners.forEach(listener => listener(finalDataPoint, tf.label));
  }

  forceFinalizeAll(): void {
    for (const tf of this.timeframes) {
      const keys = Array.from(this.dataPointsInProgress.keys())
        .filter(k => k.startsWith(tf.label));

      for (const key of keys) {
        const dataPoint = this.dataPointsInProgress.get(key)!;
        this.finalizeDataPoint(dataPoint, tf);
        this.dataPointsInProgress.delete(key);
      }
    }
  }

  getBuffer(timeframeLabel: string): UnivariateBuffer | undefined {
    return this.buffers.get(timeframeLabel);
  }

  getAllBuffers(): Map<string, UnivariateBuffer> {
    return this.buffers;
  }

  onDataPointComplete(listener: (dataPoint: UnivariateDataPoint, timeframe: string) => void): void {
    this.listeners.push(listener);
  }

  getSymbol(): string {
    return this.symbol;
  }
}
