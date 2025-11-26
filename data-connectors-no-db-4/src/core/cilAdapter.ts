import { Candle, CILResponse } from '../types/index.js';
import { Buffer } from './buffer.js';

export interface CILAdapterConfig {
  apiUrl: string;
  apiKey?: string;
  rowCount: number;
}

export class CILAdapter {
  private readonly config: CILAdapterConfig;

  constructor(config: CILAdapterConfig) {
    this.config = {
      ...config,
      rowCount: config.rowCount || 5001,
    };
  }

  async sendToCIL(buffer: Buffer, timeframeLabel: string): Promise<CILResponse | null> {
    const candles = buffer.getLast(this.config.rowCount - 1);

    if (candles.length < this.config.rowCount - 1) {
      console.warn(
        `[CILAdapter] Insufficient candles for ${timeframeLabel}. ` +
        `Need ${this.config.rowCount - 1}, have ${candles.length}`
      );
      return null;
    }

    const csvRows = this.buildCSVPayload(candles, timeframeLabel);

    try {
      const response = await this.postToCIL(csvRows);
      return this.parseResponse(response, timeframeLabel);
    } catch (error) {
      console.error(`[CILAdapter] Error sending to CIL API:`, error);
      return null;
    }
  }

  private buildCSVPayload(candles: Candle[], timeframeLabel: string): string {
    const rows: string[] = ['datetime,open,high,low,close'];

    for (const candle of candles) {
      rows.push(
        `${candle.datetime},${candle.open},${candle.high},${candle.low},${candle.close}`
      );
    }

    const lastCandle = candles[candles.length - 1];
    const nextDatetime = this.getNextDatetime(lastCandle.datetime, timeframeLabel);

    rows.push(`${nextDatetime},0,0,0,0`);

    return rows.join('\n');
  }

  private async postToCIL(csvData: string): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'text/csv',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers,
      body: csvData,
    });

    if (!response.ok) {
      throw new Error(
        `CIL API returned ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  }

  private parseResponse(response: any, timeframeLabel: string): CILResponse {
    const result: CILResponse = {
      datetime: response.datetime,
      chain_detected: response.chain_detected,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[CILAdapter] ${timeframeLabel}: chain_detected = ${response.chain_detected}, ` +
      `forecast_datetime = ${response.datetime}`
    );

    return result;
  }

  private getNextDatetime(lastDatetime: string, timeframeLabel: string): string {
    const timeframeSeconds = this.getTimeframeSeconds(timeframeLabel);
    const lastDate = new Date(lastDatetime);
    const nextDate = new Date(lastDate.getTime() + timeframeSeconds * 1000);
    return nextDate.toISOString();
  }

  private getTimeframeSeconds(label: string): number {
    const match = label.match(/^(\d+)(s|m|h)$/);
    if (!match) return 60;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      default: return 60;
    }
  }

  async sendMultipleTimeframes(
    buffers: Map<string, Buffer>
  ): Promise<Map<string, CILResponse | null>> {
    const results = new Map<string, CILResponse | null>();

    for (const [timeframeLabel, buffer] of buffers.entries()) {
      if (buffer.size() >= this.config.rowCount - 1) {
        const result = await this.sendToCIL(buffer, timeframeLabel);
        results.set(timeframeLabel, result);
      }
    }

    return results;
  }
}
