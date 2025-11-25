import { BinanceKline, CandlestickData, CryptoSymbol, TimeframeConfig, TimeframeParseResult } from '../types';
import { getCSVData } from '../services/csvService';

// Supported Binance intervals
const SUPPORTED_BINANCE_INTERVALS = [
  '1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'
];

// Helper function to convert Binance interval to minutes
export const convertIntervalToMinutes = (interval: string): number => {
  const value = parseInt(interval.replace(/[a-zA-Z]/g, ''));
  const unit = interval.replace(/[0-9]/g, '').toLowerCase();
  
  switch (unit) {
    case 's':
      return value / 60; // Convert seconds to minutes
    case 'm':
      return value;
    case 'h':
      return value * 60;
    case 'd':
      return value * 60 * 24;
    case 'w':
      return value * 60 * 24 * 7;
    case 'M': // Assuming 30 days per month
      return value * 60 * 24 * 30;
    default:
      return value; // Default to treating as minutes
  }
};

// Helper function to calculate dataLimit based on the formula
export const calculateDataLimit = (interval: string): number => {
  // For 1 minute timeframe, always return 3000
  if (interval === '1m') {
    return 3000;
  }
  
  const convMinuteValue = convertIntervalToMinutes(interval);
  const calculatedLimit = Math.round(3000 / convMinuteValue);
  
  // Ensure minimum limit of 1 and maximum reasonable limit
  return Math.max(1, Math.min(calculatedLimit, 10000));
};

const createBaseTimeframes = (symbol: string): TimeframeConfig[] => [
  {
    id: '15m',
    label: '15 Minutes',
    binanceInterval: '15m',
    wsEndpoint: `${symbol.toLowerCase()}@kline_15m`,
    color: '#919191',
    dataLimit: calculateDataLimit('15m'), // Dynamic calculation
  },
  {
    id: '5m',
    label: '5 Minutes',
    binanceInterval: '5m',
    wsEndpoint: `${symbol.toLowerCase()}@kline_5m`,
    color: '#919191',
    dataLimit: calculateDataLimit('5m'), // Dynamic calculation
  },
  {
    id: '3m',
    label: '3 Minutes',
    binanceInterval: '3m',
    wsEndpoint: `${symbol.toLowerCase()}@kline_3m`,
    color: '#919191',
    dataLimit: calculateDataLimit('3m'), // Dynamic calculation
  },
  {
    id: '1m',
    label: '1 Minute',
    binanceInterval: '1m',
    wsEndpoint: `${symbol.toLowerCase()}@kline_1m`,
    color: '#919191',
    dataLimit: calculateDataLimit('1m'), // Dynamic calculation
  },
];

export const getInitialTimeframes = (symbol: CryptoSymbol, sixteenTimesDataLimit: boolean = false) => {
  const baseTimeframes = createBaseTimeframes(symbol);
  if (sixteenTimesDataLimit) {
    return baseTimeframes.map(tf => ({
      ...tf,
      dataLimit: tf.dataLimit * 4 // Now 16x the base limit (quadrupled again)
    }));
  }
  return baseTimeframes;
};

export const parseAndValidateTimeframeInput = (input: string): TimeframeParseResult => {
  // Trim and split the input
  const trimmedInput = input.trim();
  const parts = trimmedInput.split(/\s+/);
  
  if (parts.length !== 2) {
    return {
      success: false,
      error: 'Invalid format: please use "{time_value} {time_unit}" format.'
    };
  }
  
  const [valueStr, unit] = parts;
  const value = parseInt(valueStr, 10);
  
  // Validate the numeric value
  if (isNaN(value) || value <= 0) {
    return {
      success: false,
      error: 'Invalid format: please use "{time_value} {time_unit}" format.'
    };
  }
  
  // Validate and convert the unit
  let binanceInterval: string;
  let label: string;
  
  switch (unit.toUpperCase()) {
    case 'S':
      return {
        success: false,
        error: 'Timeframe unavailable.'
      };
    case 'M':
      binanceInterval = `${value}m`;
      label = value === 1 ? '1 Minute' : `${value} Minutes`;
      break;
    case 'H':
      binanceInterval = `${value}h`;
      label = value === 1 ? '1 Hour' : `${value} Hours`;
      break;
    case 'D':
      binanceInterval = `${value}d`;
      label = value === 1 ? '1 Day' : `${value} Days`;
      break;
    case 'W':
      binanceInterval = `${value}w`;
      label = value === 1 ? '1 Week' : `${value} Weeks`;
      break;
    default:
      return {
        success: false,
        error: 'Invalid format: please use "{time_value} {time_unit}" format.'
      };
  }
  
  // Check if the interval is supported by Binance
  if (!SUPPORTED_BINANCE_INTERVALS.includes(binanceInterval)) {
    return {
      success: false,
      error: 'Timeframe unavailable.'
    };
  }
  
  return {
    success: true,
    binanceInterval,
    label
  };
};

const candlestickData: Record<string, CandlestickData[]> = {};


type UpdateCallback = (data: CandlestickData[], timeframeId: string) => void;
const updateCallbacks: UpdateCallback[] = [];

export const fetchKlineData = async (
  timeframe: TimeframeConfig,
  symbol: CryptoSymbol,
  limit: number = 1
): Promise<CandlestickData[]> => {
  try {
    const csvData = getCSVData(symbol);

    if (csvData.length === 0) {
      console.warn(`No CSV data loaded for ${symbol}`);
      return [];
    }

    const key = `${symbol}-${timeframe.id}`;
    candlestickData[key] = csvData;

    return csvData;
  } catch (error) {
    console.error(`Error fetching CSV data for ${timeframe.label}:`, error);
    return [];
  }
};

export const startKlinePolling = (symbol: CryptoSymbol, activeTimeframes?: TimeframeConfig[]) => {
  console.log('CSV mode: Kline polling not needed');
};

export const subscribeToUpdates = (callback: UpdateCallback) => {
  updateCallbacks.push(callback);
  return () => {
    const index = updateCallbacks.indexOf(callback);
    if (index !== -1) {
      updateCallbacks.splice(index, 1);
    }
  };
};

export const getCurrentData = (timeframeId: string, symbol: CryptoSymbol): CandlestickData[] => {
  const key = `${symbol}-${timeframeId}`;
  return [...(candlestickData[key] || [])];
};

export const cleanupConnections = () => {
  console.log('CSV mode: No connections to clean up');
};