import { NormalizedTick } from '../../types/index.js';

export interface BinanceTradeData {
  e: string;
  E: number;
  s: string;
  t: number;
  p: string;
  q: string;
  b: number;
  a: number;
  T: number;
  m: boolean;
  M: boolean;
}

export interface BinanceAggTradeData {
  e: string;
  E: number;
  s: string;
  a: number;
  p: string;
  q: string;
  f: number;
  l: number;
  T: number;
  m: boolean;
  M: boolean;
}

export class BinanceNormalizer {
  static normalizeTrade(data: BinanceTradeData): NormalizedTick | null {
    if (!data.s || !data.p || !data.T) {
      console.warn('[BinanceNormalizer] Invalid trade data:', data);
      return null;
    }

    return {
      ts: new Date(data.T).toISOString(),
      price: parseFloat(data.p),
      size: parseFloat(data.q),
      symbol: data.s,
      exchange: 'binance',
    };
  }

  static normalizeAggTrade(data: BinanceAggTradeData): NormalizedTick | null {
    if (!data.s || !data.p || !data.T) {
      console.warn('[BinanceNormalizer] Invalid agg trade data:', data);
      return null;
    }

    return {
      ts: new Date(data.T).toISOString(),
      price: parseFloat(data.p),
      size: parseFloat(data.q),
      symbol: data.s,
      exchange: 'binance',
    };
  }

  static normalize(data: any): NormalizedTick | null {
    if (!data || typeof data !== 'object') {
      return null;
    }

    if (data.e === 'trade') {
      return this.normalizeTrade(data as BinanceTradeData);
    }

    if (data.e === 'aggTrade') {
      return this.normalizeAggTrade(data as BinanceAggTradeData);
    }

    return null;
  }

  static normalizeStreamMessage(message: string): NormalizedTick | null {
    try {
      const parsed = JSON.parse(message);

      if (parsed.stream && parsed.data) {
        return this.normalize(parsed.data);
      }

      return this.normalize(parsed);
    } catch (error) {
      console.error('[BinanceNormalizer] Error parsing message:', error);
      return null;
    }
  }
}
