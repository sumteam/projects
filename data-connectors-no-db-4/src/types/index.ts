export interface NormalizedTick {
  ts: string;
  price: number;
  size?: number;
  symbol: string;
  exchange: string;
}

export interface Candle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TimeframeConfig {
  seconds: number;
  label: string;
  bufferSize: number;
}

export interface ConnectorHealth {
  status: 'connected' | 'disconnected' | 'error';
  lastMessageTime?: string;
  errorCount: number;
  uptime: number;
  rateLimitInfo?: {
    remaining: number;
    reset: string;
  };
}

export interface Connector {
  init(config: any): Promise<void>;
  connect(): Promise<void>;
  health(): ConnectorHealth;
  shutdown(): Promise<void>;
}

export interface CILResponse {
  datetime: string;
  chain_detected: -1 | 0 | 1;
  timestamp?: string;
}

export interface UnivariateDataPoint {
  datetime: string;
  value: number;
}

export interface UnivariateResponse {
  datetime: string;
  chain_detected: -1 | 0 | 1;
  timestamp?: string;
}
