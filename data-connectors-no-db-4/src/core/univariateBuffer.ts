import { UnivariateDataPoint } from '../types/index.js';

export class UnivariateBuffer {
  private readonly maxSize: number;
  private readonly dataPoints: UnivariateDataPoint[] = [];
  private readonly timeframeLabel: string;

  constructor(maxSize: number, timeframeLabel: string) {
    this.maxSize = maxSize;
    this.timeframeLabel = timeframeLabel;
  }

  push(dataPoint: UnivariateDataPoint): void {
    this.dataPoints.push(dataPoint);

    if (this.dataPoints.length > this.maxSize) {
      this.dataPoints.shift();
    }
  }

  getAll(): UnivariateDataPoint[] {
    return [...this.dataPoints];
  }

  getLast(count: number): UnivariateDataPoint[] {
    return this.dataPoints.slice(-count);
  }

  size(): number {
    return this.dataPoints.length;
  }

  isFull(): boolean {
    return this.dataPoints.length >= this.maxSize;
  }

  clear(): void {
    this.dataPoints.length = 0;
  }

  getTimeframeLabel(): string {
    return this.timeframeLabel;
  }

  getOldestTimestamp(): string | null {
    if (this.dataPoints.length === 0) return null;
    return this.dataPoints[0].datetime;
  }

  getNewestTimestamp(): string | null {
    if (this.dataPoints.length === 0) return null;
    return this.dataPoints[this.dataPoints.length - 1].datetime;
  }
}
