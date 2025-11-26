import { CandleBuilder } from './core/candleBuilder.js';
import { CILAdapter } from './core/cilAdapter.js';
import { UnivariateBuilder } from './core/univariateBuilder.js';
import { UnivariateAdapter } from './core/univariateAdapter.js';
import { PolygonConnector } from './connectors/polygon/polygonConnector.js';
import { AccuWeatherConnector } from './connectors/accuweather/accuweatherConnector.js';
import { BloombergConnector } from './connectors/bloomberg/bloombergConnector.js';
import { BinanceConnector } from './connectors/binance/binanceConnector.js';
import timeframeNetworks from './config/timeframeNetworks.json' assert { type: 'json' };
import { loadEnvironment, getEnvOrNull } from './utils/envLoader.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Main');

async function main(): Promise<void> {
  loadEnvironment();

  logger.info('Starting Universal Causal Insights Microservice...');

  const connectorType = process.env.CONNECTOR_TYPE || 'polygon';

  if (connectorType === 'polygon') {
    await runPolygonConnector();
  } else if (connectorType === 'accuweather') {
    await runAccuWeatherConnector();
  } else if (connectorType === 'bloomberg') {
    await runBloombergConnector();
  } else if (connectorType === 'binance') {
    await runBinanceConnector();
  } else if (connectorType === 'both') {
    await Promise.all([runPolygonConnector(), runAccuWeatherConnector()]);
  } else if (connectorType === 'all') {
    await Promise.all([
      runPolygonConnector(),
      runAccuWeatherConnector(),
      runBloombergConnector(),
      runBinanceConnector(),
    ]);
  } else {
    logger.error(`Unknown connector type: ${connectorType}`);
    process.exit(1);
  }
}

async function runPolygonConnector(): Promise<void> {
  const polygonApiKey = getEnvOrNull('POLYGON_API_KEY');
  if (!polygonApiKey) {
    logger.warn('POLYGON_API_KEY not set, skipping Polygon connector');
    return;
  }

  const symbol = process.env.POLYGON_SYMBOL || 'AAPL';
  const timeframes = timeframeNetworks.networks.stocks;

  logger.info(`Initializing Polygon connector for ${symbol}`);

  const candleBuilder = new CandleBuilder(symbol, timeframes);

  candleBuilder.onCandleComplete((candle, timeframe) => {
    logger.info(`[${timeframe}] ${symbol} Candle: ${candle.close}`);
  });

  const connector = new PolygonConnector(candleBuilder);

  await connector.init({
    apiKey: polygonApiKey,
    symbols: [symbol],
    candleBuilder,
    enableBackfill: true,
  });

  await connector.connect();

  setupHealthCheck(connector, 'Polygon');
  setupCILAnalysis(candleBuilder, 'Polygon');
  setupGracefulShutdown([connector], [candleBuilder]);
}

async function runAccuWeatherConnector(): Promise<void> {
  const accuweatherApiKey = getEnvOrNull('ACCUWEATHER_API_KEY');
  if (!accuweatherApiKey) {
    logger.warn('ACCUWEATHER_API_KEY not set, skipping AccuWeather connector');
    return;
  }

  const locationKey = process.env.ACCUWEATHER_LOCATION_KEY || '349727';
  const timeframes = timeframeNetworks.networks.weather;

  logger.info(`Initializing AccuWeather connector for location ${locationKey}`);

  const univariateBuilder = new UnivariateBuilder(locationKey, timeframes);

  univariateBuilder.onDataPointComplete((dataPoint, timeframe) => {
    logger.info(`[${timeframe}] Temperature: ${dataPoint.value}°C`);
  });

  const connector = new AccuWeatherConnector(univariateBuilder);

  await connector.init({
    apiKey: accuweatherApiKey,
    locationKey,
    univariateBuilder,
    pollingIntervalMs: 300000,
  });

  await connector.connect();

  setupHealthCheck(connector, 'AccuWeather');
  setupUnivariateAnalysis(univariateBuilder, 'AccuWeather');
  setupUnivariateShutdown([connector], [univariateBuilder]);
}

async function runBloombergConnector(): Promise<void> {
  const bloombergHost = getEnvOrNull('BLOOMBERG_HOST') || '127.0.0.1';
  const bloombergPort = parseInt(getEnvOrNull('BLOOMBERG_PORT') || '8194');
  const securitiesStr = getEnvOrNull('BLOOMBERG_SECURITIES');

  if (!securitiesStr) {
    logger.warn('BLOOMBERG_SECURITIES not set, skipping Bloomberg connector');
    return;
  }

  const securities = securitiesStr.split(',').map(s => s.trim());
  const symbol = securities[0];
  const timeframes = timeframeNetworks.networks.stocks;

  logger.info(`Initializing Bloomberg connector for ${securities.length} securities`);

  const candleBuilder = new CandleBuilder(symbol, timeframes);

  candleBuilder.onCandleComplete((candle, timeframe) => {
    logger.info(`[${timeframe}] ${symbol} Bloomberg: ${candle.close}`);
  });

  const connector = new BloombergConnector(candleBuilder);

  await connector.init({
    host: bloombergHost,
    port: bloombergPort,
    securities,
    candleBuilder,
  });

  await connector.connect();

  setupHealthCheck(connector, 'Bloomberg');
  setupCILAnalysis(candleBuilder, 'Bloomberg');
  setupGracefulShutdown([connector], [candleBuilder]);
}

async function runBinanceConnector(): Promise<void> {
  const symbolsStr = getEnvOrNull('BINANCE_SYMBOLS');

  if (!symbolsStr) {
    logger.warn('BINANCE_SYMBOLS not set, skipping Binance connector');
    return;
  }

  const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase());
  const symbol = symbols[0];
  const timeframes = timeframeNetworks.networks.stocks;

  logger.info(`Initializing Binance connector for ${symbols.length} symbols`);

  const candleBuilder = new CandleBuilder(symbol, timeframes);

  candleBuilder.onCandleComplete((candle, timeframe) => {
    logger.info(`[${timeframe}] ${symbol} Binance: ${candle.close}`);
  });

  const connector = new BinanceConnector(candleBuilder);

  await connector.init({
    symbols,
    candleBuilder,
  });

  await connector.connect();

  setupHealthCheck(connector, 'Binance');
  setupCILAnalysis(candleBuilder, 'Binance');
  setupGracefulShutdown([connector], [candleBuilder]);
}

function setupHealthCheck(connector: any, name: string): void {
  setInterval(() => {
    const health = connector.health();
    logger.info(`[${name}] Health: ${health.status}, Errors: ${health.errorCount}`);
  }, 30000);
}

function setupCILAnalysis(candleBuilder: CandleBuilder, name: string): void {
  const cilApiUrl = getEnvOrNull('CIL_API_URL');
  const cilApiKey = getEnvOrNull('CIL_API_KEY');

  if (!cilApiUrl || !cilApiKey) {
    logger.warn(`CIL API not configured for ${name}, skipping analysis`);
    return;
  }

  const cilAdapter = new CILAdapter({
    apiUrl: cilApiUrl,
    apiKey: cilApiKey,
    rowCount: 5001,
  });

  setInterval(async () => {
    const buffers = candleBuilder.getAllBuffers();

    for (const [timeframe, buffer] of buffers) {
      if (buffer.size() >= 5000) {
        logger.info(`[${name}] Analyzing ${timeframe}...`);

        const result = await cilAdapter.sendToCIL(buffer, timeframe);

        if (result) {
          logger.info(
            `[${name}] ${timeframe}: chain_detected = ${result.chain_detected}, ` +
            `forecast_datetime = ${result.datetime}`
          );
        }
      }
    }
  }, 60000);
}

function setupUnivariateAnalysis(univariateBuilder: UnivariateBuilder, name: string): void {
  const univariateApiUrl = getEnvOrNull('UNIVARIATE_API_URL');
  const univariateApiKey = getEnvOrNull('UNIVARIATE_API_KEY');

  if (!univariateApiUrl || !univariateApiKey) {
    logger.warn(`Univariate API not configured for ${name}, skipping analysis`);
    return;
  }

  const univariateAdapter = new UnivariateAdapter({
    apiUrl: univariateApiUrl,
    apiKey: univariateApiKey,
    rowCount: 5001,
  });

  setInterval(async () => {
    const buffers = univariateBuilder.getAllBuffers();

    for (const [timeframe, buffer] of buffers) {
      if (buffer.size() >= 5000) {
        logger.info(`[${name}] Forecasting ${timeframe}...`);

        const result = await univariateAdapter.sendToUnivariate(buffer, timeframe);

        if (result) {
          logger.info(`[${name}] Forecast for ${timeframe} completed`);
        }
      }
    }
  }, 60000);
}

function setupUnivariateShutdown(
  connectors: any[],
  univariateBuilders: UnivariateBuilder[]
): void {
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    for (const builder of univariateBuilders) {
      builder.forceFinalizeAll();
    }

    for (const connector of connectors) {
      await connector.shutdown();
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function setupGracefulShutdown(
  connectors: any[],
  candleBuilders: CandleBuilder[]
): void {
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');

    for (const builder of candleBuilders) {
      builder.forceFinalizeAll();
    }

    for (const connector of connectors) {
      await connector.shutdown();
    }

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
