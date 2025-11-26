import { CandleBuilder } from '../core/candleBuilder.js';
import { CILAdapter } from '../core/cilAdapter.js';
import { PolygonConnector } from '../connectors/polygon/polygonConnector.js';
import timeframeNetworks from '../config/timeframeNetworks.json' assert { type: 'json' };
import { loadEnvironment, getEnvOrNull } from '../utils/envLoader.js';

async function runPolygonExample(): Promise<void> {
  loadEnvironment();

  const polygonApiKey = getEnvOrNull('POLYGON_API_KEY');
  const cilApiUrl = getEnvOrNull('CIL_API_URL');
  const cilApiKey = getEnvOrNull('CIL_API_KEY');

  if (!polygonApiKey) {
    console.error('Please set POLYGON_API_KEY in your .env file');
    process.exit(1);
  }

  const symbol = 'AAPL';
  const timeframes = timeframeNetworks.networks.stocks;

  console.log(`Starting Polygon connector for ${symbol}...`);

  const candleBuilder = new CandleBuilder(symbol, timeframes);

  candleBuilder.onCandleComplete((candle, timeframe) => {
    console.log(`[${timeframe}] Candle complete:`, {
      datetime: candle.datetime,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });
  });

  const connector = new PolygonConnector(candleBuilder);

  await connector.init({
    apiKey: polygonApiKey,
    symbols: [symbol],
    candleBuilder,
    enableBackfill: true,
  });

  await connector.connect();

  console.log('Polygon connector connected successfully');

  if (cilApiUrl && cilApiKey) {
    const cilAdapter = new CILAdapter({
      apiUrl: cilApiUrl,
      apiKey: cilApiKey,
      rowCount: 5001,
    });

    setInterval(async () => {
      console.log('\n--- Checking buffers for CIL analysis ---');

      const buffers = candleBuilder.getAllBuffers();

      for (const [timeframe, buffer] of buffers) {
        const size = buffer.size();
        console.log(`${timeframe}: ${size} candles`);

        if (size >= 5000) {
          console.log(`Sending ${timeframe} to CIL API...`);
          const result = await cilAdapter.sendToCIL(buffer, timeframe);

          if (result) {
            console.log(`CIL Result for ${timeframe}:`, result);
          }
        }
      }
    }, 60000);
  }

  setInterval(() => {
    const health = connector.health();
    console.log('\n--- Health Check ---');
    console.log('Status:', health.status);
    console.log('Uptime:', Math.floor(health.uptime / 1000), 'seconds');
    console.log('Errors:', health.errorCount);
    console.log('Last message:', health.lastMessageTime);
  }, 30000);

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    candleBuilder.forceFinalizeAll();
    await connector.shutdown();
    process.exit(0);
  });
}

runPolygonExample().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
