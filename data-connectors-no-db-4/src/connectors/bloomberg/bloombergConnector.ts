import { Connector, ConnectorHealth, NormalizedTick } from '../../types/index.js';
import { CandleBuilder } from '../../core/candleBuilder.js';
import { SessionManager } from './sessionManager.js';
import { SubscriptionManager } from './subscriptionManager.js';
import { BloombergNormalizer } from './normalizer.js';

export interface BloombergConnectorConfig {
  host: string;
  port: number;
  securities: string[];
  fields?: string[];
  candleBuilder: CandleBuilder;
  serviceName?: string;
}

export class BloombergConnector implements Connector {
  private sessionManager: SessionManager;
  private subscriptionManager: SubscriptionManager;
  private candleBuilder: CandleBuilder;
  private config!: BloombergConnectorConfig;

  private startTime: number = 0;
  private errorCount: number = 0;
  private lastMessageTime: string | null = null;
  private isConnected: boolean = false;
  private messageCount: number = 0;

  constructor(candleBuilder: CandleBuilder) {
    this.candleBuilder = candleBuilder;
    this.sessionManager = new SessionManager({ host: '127.0.0.1', port: 8194 });
    this.subscriptionManager = new SubscriptionManager();
  }

  async init(config: BloombergConnectorConfig): Promise<void> {
    this.config = {
      fields: ['LAST_TRADE', 'BID', 'ASK', 'VOLUME'],
      serviceName: '//blp/mktdata',
      ...config,
    };

    this.sessionManager = new SessionManager({
      host: this.config.host,
      port: this.config.port,
    });

    await this.sessionManager.initialize();

    for (const security of this.config.securities) {
      this.subscriptionManager.addSubscription(security, this.config.fields!);
    }

    console.log('[BloombergConnector] Initialized with', this.config.securities.length, 'securities');
  }

  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Connector not initialized. Call init() first.');
    }

    this.startTime = Date.now();

    await this.sessionManager.connect();

    await this.sessionManager.openService(this.config.serviceName!);

    this.setupEventHandlers();

    this.subscribeToSecurities();

    this.isConnected = true;
    console.log('[BloombergConnector] Connected and subscribed');
  }

  private setupEventHandlers(): void {
    const session = this.sessionManager.getSession();
    if (!session) return;

    session.on('MarketDataEvents', (message: any) => {
      this.handleMarketDataEvent(message);
    });

    session.on('SessionTerminated', () => {
      console.log('[BloombergConnector] Session terminated');
      this.isConnected = false;
    });
  }

  private subscribeToSecurities(): void {
    const session = this.sessionManager.getSession();
    if (!session) return;

    const subscriptions = this.subscriptionManager.buildBloombergSubscriptions();

    if (subscriptions.length === 0) {
      console.warn('[BloombergConnector] No securities to subscribe to');
      return;
    }

    session.subscribe(subscriptions);

    console.log(
      `[BloombergConnector] Subscribed to ${subscriptions.length} securities:`,
      subscriptions.map(s => s.security).join(', ')
    );
  }

  private handleMarketDataEvent(message: any): void {
    try {
      this.messageCount++;

      if (!message.correlations || message.correlations.length === 0) {
        return;
      }

      const correlationId = message.correlations[0].value;
      const security = this.subscriptionManager.getSecurityByCorrelation(correlationId);

      if (!security) {
        console.warn('[BloombergConnector] Unknown correlation ID:', correlationId);
        return;
      }

      const tick = this.normalize(message, security);

      if (tick) {
        this.feedToCandleBuilder(tick);
      }
    } catch (error) {
      this.errorCount++;
      console.error('[BloombergConnector] Error handling market data:', error);
    }
  }

  normalize(message: any, security: string): NormalizedTick | null {
    return BloombergNormalizer.normalizeSubscriptionData(message, security);
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
    console.log('[BloombergConnector] Shutting down...');

    this.sessionManager.disconnect();
    this.subscriptionManager.clear();
    this.isConnected = false;
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  getSubscriptionCount(): number {
    return this.subscriptionManager.size();
  }

  addSecuritySubscription(security: string, fields?: string[]): void {
    const fieldsToUse = fields || this.config.fields!;
    this.subscriptionManager.addSubscription(security, fieldsToUse);

    if (this.isConnected) {
      const session = this.sessionManager.getSession();
      if (session) {
        const correlationId = this.subscriptionManager.getCorrelationBySecurity(security);
        if (correlationId !== null) {
          session.subscribe([
            {
              security,
              correlation: correlationId,
              fields: fieldsToUse,
            },
          ]);
          console.log(`[BloombergConnector] Added subscription for ${security}`);
        }
      }
    }
  }

  removeSecuritySubscription(security: string): boolean {
    return this.subscriptionManager.removeSubscription(security);
  }
}
