import { Connector, ConnectorHealth, NormalizedTick } from '../../types/index.js';
import { CandleBuilder } from '../../core/candleBuilder.js';
import { PolygonWebSocketClient } from './websocketClient.js';
import { PolygonRESTBackfill } from './restBackfill.js';
import { PolygonNormalizer } from './normalizer.js';

export interface PolygonConnectorConfig {
  apiKey: string;
  symbols: string[];
  candleBuilder: CandleBuilder;
  wsUrl?: string;
  enableBackfill?: boolean;
}

export class PolygonConnector implements Connector {
  private wsClient: PolygonWebSocketClient | null = null;
  private backfillClient: PolygonRESTBackfill | null = null;
  private candleBuilder: CandleBuilder;
  private config!: PolygonConnectorConfig;

  private startTime: number = 0;
  private errorCount: number = 0;
  private lastMessageTime: string | null = null;
  private isConnected: boolean = false;

  constructor(candleBuilder: CandleBuilder) {
    this.candleBuilder = candleBuilder;
  }

  async init(config: PolygonConnectorConfig): Promise<void> {
    this.config = {
      wsUrl: 'wss://socket.polygon.io/stocks',
      enableBackfill: true,
      ...config,
    };

    this.wsClient = new PolygonWebSocketClient({
      url: this.config.wsUrl!,
      apiKey: this.config.apiKey,
      symbols: this.config.symbols,
    });

    if (this.config.enableBackfill) {
      this.backfillClient = new PolygonRESTBackfill({
        apiKey: this.config.apiKey,
      });
    }

    this.wsClient.onMessage(data => this.onMessage(data));
    this.wsClient.onConnected(() => this.onConnected());
    this.wsClient.onDisconnected(() => this.onDisconnected());

    console.log('[PolygonConnector] Initialized');
  }

  async connect(): Promise<void> {
    if (!this.wsClient) {
      throw new Error('Connector not initialized. Call init() first.');
    }

    this.startTime = Date.now();

    await this.wsClient.connect();
  }

  private onConnected(): void {
    console.log('[PolygonConnector] Connected and authenticated');
    this.isConnected = true;
  }

  private async onDisconnected(): Promise<void> {
    console.log('[PolygonConnector] Disconnected');
    this.isConnected = false;

    if (this.config.enableBackfill && this.backfillClient && this.lastMessageTime) {
      const now = Date.now();
      const gapInfo = await this.backfillClient.detectGap(
        this.lastMessageTime,
        now,
        60
      );

      if (gapInfo?.hasGap) {
        console.log(
          `[PolygonConnector] Gap detected: ${(gapInfo.to - gapInfo.from) / 1000}s`
        );
        await this.performBackfill(gapInfo.from, gapInfo.to);
      }
    }
  }

  private async performBackfill(fromTimestamp: number, toTimestamp: number): Promise<void> {
    if (!this.backfillClient) return;

    for (const symbol of this.config.symbols) {
      if (symbol !== this.candleBuilder.getSymbol()) continue;

      const ticks = await this.backfillClient.backfillTrades(
        symbol,
        fromTimestamp,
        toTimestamp
      );

      console.log(`[PolygonConnector] Replaying ${ticks.length} backfilled ticks`);

      for (const tick of ticks) {
        this.feedToCandleBuilder(tick);
      }
    }
  }

  private onMessage(raw: any): void {
    try {
      const tick = this.normalize(raw);

      if (tick) {
        this.feedToCandleBuilder(tick);
      }
    } catch (error) {
      this.errorCount++;
      console.error('[PolygonConnector] Error processing message:', error);
    }
  }

  normalize(raw: any): NormalizedTick | null {
    return PolygonNormalizer.normalize(raw);
  }

  feedToCandleBuilder(tick: NormalizedTick): void {
    this.lastMessageTime = tick.ts;
    this.candleBuilder.addTick(tick);
  }

  health(): ConnectorHealth {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      lastMessageTime: this.lastMessageTime || undefined,
      errorCount: this.errorCount,
      uptime,
    };
  }

  async shutdown(): Promise<void> {
    console.log('[PolygonConnector] Shutting down...');

    if (this.wsClient) {
      await this.wsClient.shutdown();
    }

    this.isConnected = false;
  }
}
