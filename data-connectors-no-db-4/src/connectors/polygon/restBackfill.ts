import { NormalizedTick } from '../../types/index.js';
import { PolygonNormalizer } from './normalizer.js';

export interface BackfillConfig {
  apiKey: string;
  baseUrl?: string;
}

export class PolygonRESTBackfill {
  private readonly config: BackfillConfig;
  private readonly baseUrl: string;

  constructor(config: BackfillConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.polygon.io';
  }

  async backfillTrades(
    symbol: string,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<NormalizedTick[]> {
    const fromDate = new Date(fromTimestamp).toISOString().split('T')[0];
    const toDate = new Date(toTimestamp).toISOString().split('T')[0];

    console.log(
      `[PolygonBackfill] Fetching trades for ${symbol} from ${fromDate} to ${toDate}`
    );

    try {
      const trades = await this.fetchTradesInRange(
        symbol,
        fromTimestamp,
        toTimestamp
      );

      console.log(`[PolygonBackfill] Retrieved ${trades.length} trades`);

      return trades
        .map(trade => PolygonNormalizer.normalize(trade))
        .filter((tick): tick is NormalizedTick => tick !== null)
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    } catch (error) {
      console.error('[PolygonBackfill] Error fetching trades:', error);
      return [];
    }
  }

  private async fetchTradesInRange(
    symbol: string,
    fromTimestamp: number,
    toTimestamp: number
  ): Promise<any[]> {
    const allTrades: any[] = [];
    let currentTimestamp = fromTimestamp;

    while (currentTimestamp < toTimestamp) {
      const url = this.buildTradesURL(symbol, currentTimestamp, toTimestamp);

      const response = await this.fetchWithRetry(url);

      if (!response.results || response.results.length === 0) {
        break;
      }

      allTrades.push(
        ...response.results.map((r: any) => ({
          ev: 'T',
          sym: symbol,
          p: r.price,
          s: r.size,
          t: r.sip_timestamp || r.participant_timestamp,
        }))
      );

      if (response.results.length < 50000) {
        break;
      }

      currentTimestamp =
        response.results[response.results.length - 1].sip_timestamp + 1;

      await this.sleep(250);
    }

    return allTrades;
  }

  private buildTradesURL(
    symbol: string,
    fromTimestamp: number,
    toTimestamp: number
  ): string {
    const params = new URLSearchParams({
      'timestamp.gte': fromTimestamp.toString(),
      'timestamp.lte': toTimestamp.toString(),
      'order': 'asc',
      'limit': '50000',
      'apiKey': this.config.apiKey,
    });

    return `${this.baseUrl}/v3/trades/${symbol}?${params.toString()}`;
  }

  private async fetchWithRetry(
    url: string,
    maxRetries = 3
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url);

        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

          console.warn(
            `[PolygonBackfill] Rate limited, retrying after ${delay}ms`
          );

          await this.sleep(delay);
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error as Error;
        console.error(
          `[PolygonBackfill] Attempt ${attempt + 1} failed:`,
          error
        );

        if (attempt < maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error('Unknown error during backfill');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async detectGap(
    lastKnownTimestamp: string | null,
    currentTimestamp: number,
    maxGapSeconds = 60
  ): Promise<{ hasGap: boolean; from: number; to: number } | null> {
    if (!lastKnownTimestamp) {
      return null;
    }

    const lastKnown = new Date(lastKnownTimestamp).getTime();
    const gap = (currentTimestamp - lastKnown) / 1000;

    if (gap > maxGapSeconds) {
      return {
        hasGap: true,
        from: lastKnown,
        to: currentTimestamp,
      };
    }

    return null;
  }
}
