import { NormalizedTick } from '../../types/index.js';

interface PolygonTradeMessage {
  ev: string;
  sym: string;
  p: number;
  s: number;
  t: number;
  x?: number;
  c?: number[];
}

export class PolygonNormalizer {
  static normalize(raw: PolygonTradeMessage): NormalizedTick | null {
    if (raw.ev !== 'T') {
      return null;
    }

    if (!raw.sym || typeof raw.p !== 'number' || !raw.t) {
      console.warn('[PolygonNormalizer] Invalid trade message:', raw);
      return null;
    }

    return {
      ts: new Date(raw.t).toISOString(),
      price: raw.p,
      size: raw.s || 0,
      symbol: raw.sym,
      exchange: 'polygon',
    };
  }

  static normalizeBatch(messages: PolygonTradeMessage[]): NormalizedTick[] {
    return messages
      .map(msg => this.normalize(msg))
      .filter((tick): tick is NormalizedTick => tick !== null);
  }
}
