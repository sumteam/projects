import { UnivariateBuilder } from '../core/univariateBuilder.js';
import { UnivariateAdapter } from '../core/univariateAdapter.js';
import { AccuWeatherConnector } from '../connectors/accuweather/accuweatherConnector.js';
import timeframeNetworks from '../config/timeframeNetworks.json' assert { type: 'json' };
import { loadEnvironment, getEnvOrNull } from '../utils/envLoader.js';

async function runAccuWeatherExample(): Promise<void> {
  loadEnvironment();

  const accuweatherApiKey = getEnvOrNull('ACCUWEATHER_API_KEY');
  const locationKey = getEnvOrNull('ACCUWEATHER_LOCATION_KEY') || '349727';
  const univariateApiUrl = getEnvOrNull('UNIVARIATE_API_URL');
  const univariateApiKey = getEnvOrNull('UNIVARIATE_API_KEY');

  if (!accuweatherApiKey) {
    console.error('Please set ACCUWEATHER_API_KEY in your .env file');
    process.exit(1);
  }

  const symbol = locationKey;
  const timeframes = timeframeNetworks.networks.weather;

  console.log(`Starting AccuWeather connector for location ${locationKey}...`);

  const univariateBuilder = new UnivariateBuilder(symbol, timeframes);

  univariateBuilder.onDataPointComplete((dataPoint, timeframe) => {
    console.log(`[${timeframe}] Temperature data point:`, {
      datetime: dataPoint.datetime,
      value: dataPoint.value,
    });
  });

  const connector = new AccuWeatherConnector(univariateBuilder);

  await connector.init({
    apiKey: accuweatherApiKey,
    locationKey,
    univariateBuilder,
    pollingIntervalMs: 300000,
  });

  await connector.connect();

  console.log('AccuWeather connector connected successfully');

  if (univariateApiUrl && univariateApiKey) {
    const univariateAdapter = new UnivariateAdapter({
      apiUrl: univariateApiUrl,
      apiKey: univariateApiKey,
      rowCount: 5001,
    });

    setInterval(async () => {
      console.log('\n--- Checking buffers for univariate forecasting ---');

      const buffers = univariateBuilder.getAllBuffers();

      for (const [timeframe, buffer] of buffers) {
        const size = buffer.size();
        console.log(`${timeframe}: ${size} data points`);

        if (size >= 5000) {
          console.log(`Sending ${timeframe} to Univariate API...`);
          const result = await univariateAdapter.sendToUnivariate(buffer, timeframe);

          if (result) {
            console.log(`Forecast Result for ${timeframe}:`, result);
          }
        }
      }
    }, 300000);
  }

  setInterval(() => {
    const health = connector.health();
    console.log('\n--- Health Check ---');
    console.log('Status:', health.status);
    console.log('Uptime:', Math.floor(health.uptime / 1000), 'seconds');
    console.log('Errors:', health.errorCount);
    console.log('Last message:', health.lastMessageTime);

    if (health.rateLimitInfo) {
      console.log('Rate limit remaining:', health.rateLimitInfo.remaining);
      console.log('Rate limit reset:', health.rateLimitInfo.reset);
    }
  }, 60000);

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    univariateBuilder.forceFinalizeAll();
    await connector.shutdown();
    process.exit(0);
  });
}

runAccuWeatherExample().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
