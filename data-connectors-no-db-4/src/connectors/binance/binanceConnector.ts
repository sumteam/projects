import { Connector, ConnectorHealth, NormalizedTick } from '../../types/index.js';
import { CandleBuilder } from '../../core/candleBuilder.js';
import { BinanceWebSocketClient } from './websocketClient.js';
import { BinanceNormalizer } from './normalizer.js';

export interface BinanceConnectorConfig {
  symbols: string[];
  candleBuilder: CandleBuilder;
  baseUrl?: string;
  streams?: string[];
}

export class BinanceConnector implements Connector {
  private wsClient: BinanceWebSocketClient | null = null;
  private candleBuilder: CandleBuilder;
  private config!: BinanceConnectorConfig;

  private startTime: number = 0;
  private errorCount: number = 0;
  private lastMessageTime: string | null = null;
  private isConnected: boolean = false;
  private messageCount: number = 0;

  constructor(candleBuilder: CandleBuilder) {
    this.candleBuilder = candleBuilder;
  }

  async init(config: BinanceConnectorConfig): Promise<void> {
    this.config = {
      baseUrl: 'wss://stream.binance.com:9443',
      streams: ['trade', 'aggTrade'],
      ...config,
    };

    this.wsClient = new BinanceWebSocketClient({
      baseUrl: this.config.baseUrl,
      symbols: this.config.symbols,
      streams: this.config.streams,
    });

    this.wsClient.onMessage(data => this.onMessage(data));
    this.wsClient.onConnected(() => this.onConnected());
    this.wsClient.onDisconnected(() => this.onDisconnected());

    console.log(
      '[BinanceConnector] Initialized with',
      this.config.symbols.length,
      'symbols'
    );
  }

  async connect(): Promise<void> {
    if (!this.wsClient) {
      throw new Error('Connector not initialized. Call init() first.');
    }

    this.startTime = Date.now();

    await this.wsClient.connect();
  }

  private onConnected(): void {
    console.log('[BinanceConnector] Connected to Binance WebSocket');
    this.isConnected = true;
  }

  private onDisconnected(): void {
    console.log('[BinanceConnector] Disconnected from Binance WebSocket');
    this.isConnected = false;
  }

  private onMessage(data: string): void {
    try {
      this.messageCount++;

      const tick = this.normalize(data);

      if (tick) {
        this.feedToCandleBuilder(tick);
      }
    } catch (error) {
      this.errorCount++;
      console.error('[BinanceConnector] Error processing message:', error);
    }
  }

  normalize(data: string): NormalizedTick | null {
    return BinanceNormalizer.normalizeStreamMessage(data);
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
    console.log('[BinanceConnector] Shutting down...');

    if (this.wsClient) {
      await this.wsClient.shutdown();
    }

    this.isConnected = false;
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  addSymbol(symbol: string): void {
    if (!this.wsClient || !this.isConnected) {
      console.warn('[BinanceConnector] Cannot add symbol, not connected');
      return;
    }

    this.wsClient.subscribe([symbol]);
    console.log(`[BinanceConnector] Added subscription for ${symbol}`);
  }

  removeSymbol(symbol: string): void {
    if (!this.wsClient || !this.isConnected) {
      console.warn('[BinanceConnector] Cannot remove symbol, not connected');
      return;
    }

    this.wsClient.unsubscribe([symbol]);
    console.log(`[BinanceConnector] Removed subscription for ${symbol}`);
  }

  getSymbols(): string[] {
    return this.config.symbols;
  }
}
