import WebSocket from 'ws';

export interface BinanceWebSocketConfig {
  baseUrl?: string;
  symbols: string[];
  streams?: string[];
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly config: BinanceWebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private lastMessageTime: number = 0;
  private isShuttingDown = false;

  private onMessageCallback: ((data: string) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;
  private onDisconnectedCallback: (() => void) | null = null;

  constructor(config: BinanceWebSocketConfig) {
    this.config = {
      baseUrl: 'wss://stream.binance.com:9443',
      reconnectDelay: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      streams: ['trade', 'aggTrade'],
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('WebSocket client is shutting down');
    }

    return new Promise((resolve, reject) => {
      try {
        const url = this.buildWebSocketURL();
        console.log('[BinanceWS] Connecting to:', url);

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          console.log('[BinanceWS] Connected');
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();
          this.startPingTimer();

          if (this.onConnectedCallback) {
            this.onConnectedCallback();
          }

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.lastMessageTime = Date.now();
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          console.error('[BinanceWS] Error:', error.message);
        });

        this.ws.on('close', () => {
          console.log('[BinanceWS] Disconnected');
          this.stopPingTimer();

          if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback();
          }

          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('ping', () => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.pong();
          }
        });

        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private buildWebSocketURL(): string {
    const streamNames = this.config.symbols
      .flatMap(symbol => {
        const lowerSymbol = symbol.toLowerCase();
        return this.config.streams!.map(stream => `${lowerSymbol}@${stream}`);
      })
      .join('/');

    return `${this.config.baseUrl}/stream?streams=${streamNames}`;
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = data.toString();

      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    } catch (error) {
      console.error('[BinanceWS] Error handling message:', error);
    }
  }

  private startPingTimer(): void {
    this.stopPingTimer();

    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;

        if (timeSinceLastMessage > this.config.pingInterval! * 3) {
          console.warn('[BinanceWS] No messages received, reconnecting...');
          this.ws.close();
        } else {
          this.ws.ping();
        }
      }
    }, this.config.pingInterval!);
  }

  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('[BinanceWS] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts),
      60000
    );

    this.reconnectAttempts++;

    console.log(
      `[BinanceWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(err => {
        console.error('[BinanceWS] Reconnection failed:', err.message);
      });
    }, delay);
  }

  subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[BinanceWS] WebSocket not connected, cannot subscribe');
      return;
    }

    const params = symbols.flatMap(symbol => {
      const lowerSymbol = symbol.toLowerCase();
      return this.config.streams!.map(stream => `${lowerSymbol}@${stream}`);
    });

    const subscribeMessage = {
      method: 'SUBSCRIBE',
      params,
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('[BinanceWS] Subscribed to:', params.join(', '));
  }

  unsubscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[BinanceWS] WebSocket not connected, cannot unsubscribe');
      return;
    }

    const params = symbols.flatMap(symbol => {
      const lowerSymbol = symbol.toLowerCase();
      return this.config.streams!.map(stream => `${lowerSymbol}@${stream}`);
    });

    const unsubscribeMessage = {
      method: 'UNSUBSCRIBE',
      params,
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
    console.log('[BinanceWS] Unsubscribed from:', params.join(', '));
  }

  onMessage(callback: (data: string) => void): void {
    this.onMessageCallback = callback;
  }

  onConnected(callback: () => void): void {
    this.onConnectedCallback = callback;
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallback = callback;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getLastMessageTime(): number {
    return this.lastMessageTime;
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    this.stopPingTimer();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
