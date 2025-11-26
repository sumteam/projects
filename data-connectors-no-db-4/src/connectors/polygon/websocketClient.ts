import WebSocket from 'ws';

export interface WebSocketClientConfig {
  url: string;
  apiKey: string;
  symbols: string[];
  heartbeatInterval?: number;
}

export class PolygonWebSocketClient {
  private ws: WebSocket | null = null;
  private readonly config: WebSocketClientConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastMessageTime: number = 0;
  private isShuttingDown = false;

  private onMessageCallback: ((data: any) => void) | null = null;
  private onConnectedCallback: (() => void) | null = null;
  private onDisconnectedCallback: (() => void) | null = null;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      heartbeatInterval: 30000,
      ...config,
    };
  }

  async connect(): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('WebSocket client is shutting down');
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url);

        this.ws.on('open', () => {
          console.log('[PolygonWS] Connected');
          this.reconnectAttempts = 0;
          this.authenticate();
          this.startHeartbeat();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.lastMessageTime = Date.now();
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          console.error('[PolygonWS] Error:', error.message);
        });

        this.ws.on('close', () => {
          console.log('[PolygonWS] Disconnected');
          this.stopHeartbeat();

          if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback();
          }

          if (!this.isShuttingDown) {
            this.scheduleReconnect();
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

  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const authMessage = {
      action: 'auth',
      params: this.config.apiKey,
    };

    this.ws.send(JSON.stringify(authMessage));
    console.log('[PolygonWS] Authentication sent');

    setTimeout(() => {
      this.subscribe();
    }, 1000);
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const params = this.config.symbols.map(sym => `T.${sym}`).join(',');

    const subscribeMessage = {
      action: 'subscribe',
      params,
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('[PolygonWS] Subscribed to:', params);
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const messages = JSON.parse(data.toString());

      if (Array.isArray(messages)) {
        for (const msg of messages) {
          if (msg.ev === 'status') {
            this.handleStatusMessage(msg);
          } else if (this.onMessageCallback) {
            this.onMessageCallback(msg);
          }
        }
      }
    } catch (error) {
      console.error('[PolygonWS] Error parsing message:', error);
    }
  }

  private handleStatusMessage(msg: any): void {
    console.log('[PolygonWS] Status:', msg.status, msg.message);

    if (msg.status === 'auth_success' && this.onConnectedCallback) {
      this.onConnectedCallback();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;

        if (timeSinceLastMessage > this.config.heartbeatInterval! * 2) {
          console.warn('[PolygonWS] No messages received, reconnecting...');
          this.ws.close();
        }
      }
    }, this.config.heartbeatInterval!);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[PolygonWS] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000
    );

    this.reconnectAttempts++;

    console.log(
      `[PolygonWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect().catch(err => {
        console.error('[PolygonWS] Reconnection failed:', err.message);
      });
    }, delay);
  }

  onMessage(callback: (data: any) => void): void {
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
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
