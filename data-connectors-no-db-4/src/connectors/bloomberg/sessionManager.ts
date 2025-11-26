export interface SessionConfig {
  host: string;
  port: number;
}

export interface BloombergSession {
  on(event: string, callback: (message: any) => void): void;
  openService(serviceName: string, serviceId: number): void;
  subscribe(securities: any[]): void;
  request(service: string, requestType: string, params: any, correlationId: number, identity?: any): void;
  authorizeUser(params: any, correlationId: number): void;
  destroy(): void;
}

export class SessionManager {
  private session: BloombergSession | null = null;
  private blpapiModule: any = null;
  private readonly config: SessionConfig;
  private isConnected: boolean = false;
  private serviceId: number = 1;
  private connectionPromise: Promise<void> | null = null;

  constructor(config: SessionConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      this.blpapiModule = await import('blpapi').catch(() => null);
      if (this.blpapiModule) {
        console.log('[SessionManager] Bloomberg BLPAPI module loaded');
      } else {
        throw new Error('blpapi module not available');
      }
    } catch (error) {
      const err = error as Error;
      console.warn('[SessionManager] Bloomberg BLPAPI module not available:', err.message);
      console.warn('[SessionManager] Using mock Bloomberg session for development');
      this.blpapiModule = this.createMockModule();
    }
  }

  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.performConnection();
    return this.connectionPromise;
  }

  private async performConnection(): Promise<void> {
    if (!this.blpapiModule) {
      throw new Error('BLPAPI module not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      try {
        this.session = new this.blpapiModule.Session({
          host: this.config.host,
          port: this.config.port,
        });

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 30000);

        this.session!.on('SessionStarted', () => {
          clearTimeout(timeout);
          console.log('[SessionManager] Bloomberg session started');
          this.isConnected = true;
          resolve();
        });

        this.session!.on('SessionStartupFailure', (error: any) => {
          clearTimeout(timeout);
          console.error('[SessionManager] Session startup failed:', error);
          this.isConnected = false;
          reject(new Error('Session startup failed'));
        });

        this.session!.on('SessionTerminated', () => {
          console.log('[SessionManager] Session terminated');
          this.isConnected = false;
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async openService(serviceName: string): Promise<void> {
    if (!this.session || !this.isConnected) {
      throw new Error('Session not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Service open timeout: ${serviceName}`));
      }, 10000);

      this.session!.on('ServiceOpened', (message: any) => {
        if (message.correlations && message.correlations[0].value === this.serviceId) {
          clearTimeout(timeout);
          console.log(`[SessionManager] Service opened: ${serviceName}`);
          resolve();
        }
      });

      this.session!.on('ServiceOpenFailure', (message: any) => {
        if (message.correlations && message.correlations[0].value === this.serviceId) {
          clearTimeout(timeout);
          reject(new Error(`Failed to open service: ${serviceName}`));
        }
      });

      this.session!.openService(serviceName, this.serviceId);
      this.serviceId++;
    });
  }

  getSession(): BloombergSession | null {
    return this.session;
  }

  isSessionConnected(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    if (this.session) {
      this.session.destroy();
      this.session = null;
      this.isConnected = false;
    }
  }

  private createMockModule(): any {
    console.log('[SessionManager] Creating mock Bloomberg session');

    return {
      Session: class MockSession implements BloombergSession {
        private eventHandlers: Map<string, Array<(message: any) => void>> = new Map();
        private mockDataInterval: NodeJS.Timeout | null = null;

        constructor(config: SessionConfig) {
          console.log(`[MockSession] Created with ${config.host}:${config.port}`);

          setTimeout(() => {
            this.emit('SessionStarted', {});
          }, 100);
        }

        on(event: string, callback: (message: any) => void): void {
          if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
          }
          this.eventHandlers.get(event)!.push(callback);
        }

        openService(_serviceName: string, serviceId: number): void {
          setTimeout(() => {
            this.emit('ServiceOpened', {
              correlations: [{ value: serviceId }],
            });
          }, 50);
        }

        subscribe(securities: any[]): void {
          console.log(`[MockSession] Subscribed to ${securities.length} securities`);

          this.mockDataInterval = setInterval(() => {
            for (const sub of securities) {
              this.emit('MarketDataEvents', {
                data: {
                  LAST_TRADE: 100 + Math.random() * 50,
                  VOLUME: Math.floor(Math.random() * 1000000),
                  TIME: new Date().toISOString(),
                },
                correlations: [{ value: sub.correlation }],
                messageType: 'MarketDataEvents',
              });
            }
          }, 5000);
        }

        request(
          _service: string,
          requestType: string,
          _params: any,
          _correlationId: number,
          _identity?: any
        ): void {
          console.log(`[MockSession] Request: ${requestType}`);
        }

        authorizeUser(_params: any, correlationId: number): void {
          setTimeout(() => {
            this.emit('AuthorizationResponse', {
              correlations: [{ value: correlationId }],
              data: { identity: { mock: true } },
            });
          }, 100);
        }

        destroy(): void {
          if (this.mockDataInterval) {
            clearInterval(this.mockDataInterval);
          }
          console.log('[MockSession] Destroyed');
        }

        private emit(event: string, message: any): void {
          const handlers = this.eventHandlers.get(event);
          if (handlers) {
            handlers.forEach(handler => handler(message));
          }
        }
      },
    };
  }
}
