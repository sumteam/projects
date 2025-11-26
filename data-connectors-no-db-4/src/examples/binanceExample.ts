import { CandleBuilder } from '../core/candleBuilder.js';
import { CILAdapter } from '../core/cilAdapter.js';
import { BinanceConnector } from '../connectors/binance/binanceConnector.js';
import timeframeNetworks from '../config/timeframeNetworks.json' assert { type: 'json' };
import { loadEnvironment, getEnvOrNull } from '../utils/envLoader.js';

async function runBinanceExample(): Promise<void> {
  loadEnvironment();

  const symbolsStr = getEnvOrNull('BINANCE_SYMBOLS') || 'BTCUSDT,ETHUSDT';
  const symbols = symbolsStr.split(',').map(s => s.trim().toUpperCase());
  const cilApiUrl = getEnvOrNull('CIL_API_URL');
  const cilApiKey = getEnvOrNull('CIL_API_KEY');

  const primarySymbol = symbols[0];
  const timeframes = timeframeNetworks.networks.stocks;

  console.log(`Starting Binance connector for ${symbols.length} symbols...`);
  console.log('Symbols:', symbols.join(', '));

  const candleBuilder = new CandleBuilder(primarySymbol, timeframes);

  candleBuilder.onCandleComplete((candle, timeframe) => {
    console.log(`[${timeframe}] ${primarySymbol} Candle:`, {
      datetime: candle.datetime,
      open: candle.open.toFixed(2),
      high: candle.high.toFixed(2),
      low: candle.low.toFixed(2),
      close: candle.close.toFixed(2),
      volume: candle.volume?.toFixed(4),
    });
  });

  const connector = new BinanceConnector(candleBuilder);

  await connector.init({
    symbols,
    candleBuilder,
    streams: ['trade', 'aggTrade'],
  });

  await connector.connect();

  console.log('Binance connector connected successfully');
  console.log('Streaming real-time trade data...');

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
    console.log('Active symbols:', connector.getSymbols().join(', '));
  }, 30000);

  setTimeout(() => {
    console.log('\n--- Adding dynamic subscription ---');
    connector.addSymbol('BNBUSDT');
  }, 15000);

  setTimeout(() => {
    console.log('\n--- Removing dynamic subscription ---');
    connector.removeSymbol('BNBUSDT');
  }, 45000);

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    candleBuilder.forceFinalizeAll();
    await connector.shutdown();
    process.exit(0);
  });
}

runBinanceExample().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
