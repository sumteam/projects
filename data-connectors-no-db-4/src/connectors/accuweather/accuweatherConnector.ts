import { Connector, ConnectorHealth, NormalizedTick } from '../../types/index.js';
import { UnivariateBuilder } from '../../core/univariateBuilder.js';
import { PollingLoop } from './pollingLoop.js';
import { AccuWeatherNormalizer } from './normalizer.js';

export interface AccuWeatherConnectorConfig {
  apiKey: string;
  locationKey: string;
  univariateBuilder: UnivariateBuilder;
  pollingIntervalMs?: number;
  baseUrl?: string;
}

export class AccuWeatherConnector implements Connector {
  private pollingLoop: PollingLoop | null = null;
  private univariateBuilder: UnivariateBuilder;
  private config!: AccuWeatherConnectorConfig;

  private startTime: number = 0;
  private errorCount: number = 0;
  private lastMessageTime: string | null = null;
  private isConnected: boolean = false;
  private rateLimitRemaining: number = -1;
  private rateLimitReset: string | null = null;
  private lastFetchedData: any = null;

  constructor(univariateBuilder: UnivariateBuilder) {
    this.univariateBuilder = univariateBuilder;
  }

  async init(config: AccuWeatherConnectorConfig): Promise<void> {
    this.config = {
      pollingIntervalMs: 300000,
      baseUrl: 'http://dataservice.accuweather.com',
      ...config,
    };

    console.log('[AccuWeatherConnector] Initialized');
  }

  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Connector not initialized. Call init() first.');
    }

    this.startTime = Date.now();
    this.isConnected = true;

    this.pollingLoop = new PollingLoop(
      () => this.poll(),
      { intervalMs: this.config.pollingIntervalMs! }
    );

    this.pollingLoop.start();

    await this.poll();

    console.log('[AccuWeatherConnector] Connected and polling started');
  }

  private async poll(): Promise<void> {
    try {
      const data = await this.fetchCurrentConditions();

      if (data) {
        this.onMessage(data);
      }
    } catch (error) {
      this.errorCount++;
      console.error('[AccuWeatherConnector] Poll error:', error);
      throw error;
    }
  }

  private async fetchCurrentConditions(): Promise<any> {
    const url = this.buildCurrentConditionsURL();

    const response = await fetch(url);

    if (response.headers.has('RateLimit-Remaining')) {
      this.rateLimitRemaining = parseInt(
        response.headers.get('RateLimit-Remaining') || '-1'
      );
    }

    if (response.headers.has('RateLimit-Reset')) {
      this.rateLimitReset = response.headers.get('RateLimit-Reset');
    }

    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid response format');
    }

    return data[0];
  }

  private buildCurrentConditionsURL(): string {
    const params = new URLSearchParams({
      apikey: this.config.apiKey,
      details: 'true',
    });

    return `${this.config.baseUrl}/currentconditions/v1/${this.config.locationKey}?${params.toString()}`;
  }

  private onMessage(raw: any): void {
    try {
      this.lastFetchedData = raw;

      const tick = this.normalize(raw);

      if (tick) {
        this.feedToCandleBuilder(tick);
      }
    } catch (error) {
      this.errorCount++;
      console.error('[AccuWeatherConnector] Error processing message:', error);
    }
  }

  normalize(raw: any): NormalizedTick | null {
    return AccuWeatherNormalizer.normalize(raw, this.config.locationKey);
  }

  feedToCandleBuilder(tick: NormalizedTick): void {
    this.lastMessageTime = tick.ts;
    this.univariateBuilder.addTick(tick);
  }

  health(): ConnectorHealth {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;

    const health: ConnectorHealth = {
      status: this.isConnected ? 'connected' : 'disconnected',
      lastMessageTime: this.lastMessageTime || undefined,
      errorCount: this.errorCount,
      uptime,
    };

    if (this.rateLimitRemaining >= 0) {
      health.rateLimitInfo = {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset || 'unknown',
      };
    }

    return health;
  }

  async shutdown(): Promise<void> {
    console.log('[AccuWeatherConnector] Shutting down...');

    if (this.pollingLoop) {
      this.pollingLoop.stop();
    }

    this.isConnected = false;
  }

  getLastFetchedData(): any {
    return this.lastFetchedData;
  }
}
