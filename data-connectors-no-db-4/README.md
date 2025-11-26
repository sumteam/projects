# Universal Causal Insights Microservice

Production-quality TypeScript/Node.js microservice for integrating multiple data sources into a unified time-series analysis pipeline that feeds the sumtyme.ai Causal Intelligence Layer (CIL) API.

## Features

### Connectors

1. **Polygon.io Connector**
   - Real-time WebSocket connection for market data
   - REST API backfill for gap detection and recovery
   - Automatic reconnection with exponential backoff
   - Rate limit handling

2. **AccuWeather Connector**
   - Polling-based weather data collection
   - Configurable polling intervals
   - Rate limit tracking
   - Temperature-based OHLC candles

3. **Bloomberg Connector**
   - Real-time market data via Bloomberg BLPAPI
   - Subscription-based data streaming
   - Support for multiple securities
   - Mock mode for development without Bloomberg Terminal
   - Dynamic subscription management

4. **Binance Connector**
   - Real-time cryptocurrency data via WebSocket
   - Trade and aggregated trade streams
   - No API key required for public market data
   - Dynamic symbol subscription management
   - Automatic reconnection with exponential backoff

### Core Components

- **Candle Builder**: Constructs OHLC candles for arbitrary timeframe networks
- **Buffer**: Rolling window storage of 5000 candles per timeframe
- **CIL Adapter**: Sends 5001-row CSV payloads to CIL API
- **Supabase Integration**: Persistent storage for candles and analysis results

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Choose connector type (polygon | accuweather | bloomberg | binance | all)
CONNECTOR_TYPE=polygon

# Polygon.io (if using)
POLYGON_API_KEY=your_api_key
POLYGON_SYMBOL=AAPL

# AccuWeather (if using)
ACCUWEATHER_API_KEY=your_api_key
ACCUWEATHER_LOCATION_KEY=349727

# Bloomberg (if using)
BLOOMBERG_HOST=127.0.0.1
BLOOMBERG_PORT=8194
BLOOMBERG_SECURITIES=AAPL US Equity,MSFT US Equity

# Binance (if using)
BINANCE_SYMBOLS=BTCUSDT,ETHUSDT,BNBUSDT

# CIL API (optional)
CIL_API_URL=https://api.sumtyme.ai/cil/analyze
CIL_API_KEY=your_cil_api_key
```

## Usage

### Run Main Application

```bash
npm run dev
```

### Run Specific Examples

**Polygon.io Example:**
```bash
CONNECTOR_TYPE=polygon npm run dev
```

**AccuWeather Example:**
```bash
CONNECTOR_TYPE=accuweather npm run dev
```

**Bloomberg Example:**
```bash
CONNECTOR_TYPE=bloomberg npm run dev
```

**Binance Example:**
```bash
CONNECTOR_TYPE=binance npm run dev
```

**All Connectors:**
```bash
CONNECTOR_TYPE=all npm run dev
```

### Individual Example Scripts

```bash
npx tsx src/examples/polygonExample.ts
npx tsx src/examples/accuweatherExample.ts
npx tsx src/examples/bloombergExample.ts
npx tsx src/examples/binanceExample.ts
```

## Architecture

```
src/
├── connectors/
│   ├── polygon/
│   │   ├── polygonConnector.ts      # Main connector implementation
│   │   ├── websocketClient.ts       # WebSocket connection handler
│   │   ├── restBackfill.ts          # Gap detection & backfill
│   │   └── normalizer.ts            # Data normalization
│   ├── accuweather/
│   │   ├── accuweatherConnector.ts  # Main connector implementation
│   │   ├── pollingLoop.ts           # Polling mechanism
│   │   └── normalizer.ts            # Data normalization
│   ├── bloomberg/
│   │   ├── bloombergConnector.ts    # Main connector implementation
│   │   ├── sessionManager.ts        # Bloomberg session handler
│   │   ├── subscriptionManager.ts   # Subscription tracking
│   │   └── normalizer.ts            # Data normalization
│   └── binance/
│       ├── binanceConnector.ts      # Main connector implementation
│       ├── websocketClient.ts       # WebSocket connection handler
│       └── normalizer.ts            # Data normalization
├── core/
│   ├── buffer.ts                    # Rolling window buffer
│   ├── candleBuilder.ts             # OHLC candle construction
│   └── cilAdapter.ts                # CIL API integration
├── storage/
│   ├── supabaseClient.ts            # Supabase connection
│   ├── candleRepository.ts          # Candle persistence
│   └── cilRepository.ts             # CIL result persistence
├── config/
│   ├── config.json                  # Application configuration
│   └── timeframeNetworks.json       # Timeframe definitions
└── types/
    └── index.ts                     # TypeScript interfaces
```

## Timeframe Networks

Configured in `src/config/timeframeNetworks.json`:

**Stocks**: 1s, 5s, 15s, 30s, 1m, 5m, 15m, 1h

**Weather**: 1m, 5m, 15m, 30m, 1h

Each timeframe maintains a rolling buffer of 5000 candles.

## CIL Integration

When buffers reach 5000 candles, the CIL Adapter:

1. Collects last 5000 OHLC rows
2. Appends placeholder row (zeros)
3. Sends 5001-row CSV to CIL API
4. Parses chain detection results:
   - `chain_detected_30s`: -1 | 0 | 1
   - `chain_detected_1m`: -1 | 0 | 1
   - `chain_detected_1h`: -1 | 0 | 1

## Database Schema

### Candles Table
Stores OHLC time-series data from all sources.

### CIL Results Table
Stores analysis outputs from CIL API with chain detection results.

## Health Monitoring

Health endpoints available through connector instances:

```typescript
const health = connector.health();
console.log(health.status);      // 'connected' | 'disconnected' | 'error'
console.log(health.errorCount);  // Number of errors
console.log(health.uptime);      // Milliseconds since start
```

## Error Handling

- Automatic reconnection with exponential backoff
- Rate limit detection and retry logic
- Gap detection and backfill for missing data
- Comprehensive error logging

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## License

MIT License. Just tell me first!
