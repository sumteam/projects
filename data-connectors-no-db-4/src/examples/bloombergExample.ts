import { CandleBuilder } from '../core/candleBuilder.js';
import { CILAdapter } from '../core/cilAdapter.js';
import { BloombergConnector } from '../connectors/bloomberg/bloombergConnector.js';
import timeframeNetworks from '../config/timeframeNetworks.json' assert { type: 'json' };
import { loadEnvironment, getEnvOrNull } from '../utils/envLoader.js';

async function runBloombergExample(): Promise<void> {
  loadEnvironment();

  const bloombergHost = getEnvOrNull('BLOOMBERG_HOST') || '127.0.0.1';
  const bloombergPort = parseInt(getEnvOrNull('BLOOMBERG_PORT') || '8194');
  const securitiesStr = getEnvOrNull('BLOOMBERG_SECURITIES') || 'AAPL US Equity,MSFT US Equity';
  const securities = securitiesStr.split(',').map(s => s.trim());
  const cilApiUrl = getEnvOrNull('CIL_API_URL');
  const cilApiKey = getEnvOrNull('CIL_API_KEY');

  const symbol = securities[0];
  const timeframes = timeframeNetworks.networks.stocks;

  console.log(`Starting Bloomberg connector for ${securities.length} securities...`);
  console.log(`Connecting to Bloomberg at ${bloombergHost}:${bloombergPort}`);

  const candleBuilder = new CandleBuilder(symbol, timeframes);

  candleBuilder.onCandleComplete((candle, timeframe) => {
    console.log(`[${timeframe}] Candle complete:`, {
      datetime: candle.datetime,
      open: candle.open.toFixed(2),
      high: candle.high.toFixed(2),
      low: candle.low.toFixed(2),
      close: candle.close.toFixed(2),
    });
  });

  const connector = new BloombergConnector(candleBuilder);

  await connector.init({
    host: bloombergHost,
    port: bloombergPort,
    securities,
    fields: ['LAST_TRADE', 'BID', 'ASK', 'VOLUME', 'LAST_PRICE'],
    candleBuilder,
    serviceName: '//blp/mktdata',
  });

  await connector.connect();

  console.log('Bloomberg connector connected successfully');
  console.log('Waiting for market data...');

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
    console.log('Messages received:', connector.getMessageCount());
    console.log('Active subscriptions:', connector.getSubscriptionCount());
  }, 30000);

  setTimeout(() => {
    console.log('\n--- Adding dynamic subscription ---');
    connector.addSecuritySubscription('TSLA US Equity');
  }, 10000);

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    candleBuilder.forceFinalizeAll();
    await connector.shutdown();
    process.exit(0);
  });
}

runBloombergExample().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
