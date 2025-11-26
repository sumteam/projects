import { NormalizedTick } from '../../types/index.js';

export interface BloombergTickData {
  LAST_PRICE?: number;
  BID?: number;
  ASK?: number;
  VOLUME?: number;
  LAST_TRADE?: number;
  TIME?: string;
}

export class BloombergNormalizer {
  static normalize(
    data: BloombergTickData,
    security: string
  ): NormalizedTick | null {
    const price = data.LAST_TRADE || data.LAST_PRICE || data.BID || data.ASK;

    if (price === undefined || price === null) {
      return null;
    }

    const timestamp = data.TIME ? new Date(data.TIME).toISOString() : new Date().toISOString();

    return {
      ts: timestamp,
      price,
      size: data.VOLUME,
      symbol: security,
      exchange: 'bloomberg',
    };
  }

  static normalizeSubscriptionData(
    message: any,
    security: string
  ): NormalizedTick | null {
    if (!message.data || typeof message.data !== 'object') {
      return null;
    }

    return this.normalize(message.data, security);
  }

  static extractSecurityFromCorrelation(
    message: any,
    subscriptions: Map<number, string>
  ): string | null {
    if (!message.correlations || message.correlations.length === 0) {
      return null;
    }

    const correlationId = message.correlations[0].value;
    return subscriptions.get(correlationId) || null;
  }
}
