import { UnivariateDataPoint, UnivariateResponse } from '../types/index.js';
import { UnivariateBuffer } from './univariateBuffer.js';

export interface UnivariateAdapterConfig {
  apiUrl: string;
  apiKey?: string;
  rowCount: number;
}

export class UnivariateAdapter {
  private readonly config: UnivariateAdapterConfig;

  constructor(config: UnivariateAdapterConfig) {
    this.config = {
      ...config,
      rowCount: config.rowCount || 5001,
    };
  }

  async sendToUnivariate(buffer: UnivariateBuffer, timeframeLabel: string): Promise<UnivariateResponse | null> {
    const dataPoints = buffer.getLast(this.config.rowCount - 1);

    if (dataPoints.length < this.config.rowCount - 1) {
      console.warn(
        `[UnivariateAdapter] Insufficient data points for ${timeframeLabel}. ` +
        `Need ${this.config.rowCount - 1}, have ${dataPoints.length}`
      );
      return null;
    }

    const csvRows = this.buildCSVPayload(dataPoints, timeframeLabel);

    try {
      const response = await this.postToUnivariate(csvRows);
      return this.parseResponse(response, timeframeLabel);
    } catch (error) {
      console.error(`[UnivariateAdapter] Error sending to Univariate API:`, error);
      return null;
    }
  }

  private buildCSVPayload(dataPoints: UnivariateDataPoint[], timeframeLabel: string): string {
    const rows: string[] = ['datetime,value'];

    for (const dataPoint of dataPoints) {
      rows.push(`${dataPoint.datetime},${dataPoint.value}`);
    }

    const lastDataPoint = dataPoints[dataPoints.length - 1];
    const nextDatetime = this.getNextDatetime(lastDataPoint.datetime, timeframeLabel);

    rows.push(`${nextDatetime},0`);

    return rows.join('\n');
  }

  private async postToUnivariate(csvData: string): Promise<any> {
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
        `Univariate API returned ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  }

  private parseResponse(response: any, timeframeLabel: string): UnivariateResponse {
    const result: UnivariateResponse = {
      datetime: response.datetime,
      chain_detected: response.chain_detected,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[UnivariateAdapter] ${timeframeLabel}: chain_detected = ${response.chain_detected}, ` +
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
    buffers: Map<string, UnivariateBuffer>
  ): Promise<Map<string, UnivariateResponse | null>> {
    const results = new Map<string, UnivariateResponse | null>();

    for (const [timeframeLabel, buffer] of buffers.entries()) {
      if (buffer.size() >= this.config.rowCount - 1) {
        const result = await this.sendToUnivariate(buffer, timeframeLabel);
        results.set(timeframeLabel, result);
      }
    }

    return results;
  }
}
