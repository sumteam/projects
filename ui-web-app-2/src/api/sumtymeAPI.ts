import { loadPredictionsForTicker } from '../services/predictionService';
import { PredictionData, PredictionEntry } from '../types';
import {
    savePrediction,
    subscribeToPredictionUpdates as subscribeToService,
    getCurrentPredictions as getCurrentFromService
} from '../services/predictionService';
import { getInitialTimeframes, fetchKlineData } from './binanceAPI';

// FastAPI server URL - adjust as needed
const SUMTYME_API_BASE_URL = import.meta.env.VITE_SUMTYME_API_URL;

// Define supported prediction intervals - only these timeframes have prediction data
export const SUPPORTED_PREDICTION_INTERVALS = ['1m', '3m', '5m', '15m'];

// Store callbacks for view updates
type ViewUpdateCallback = () => void;
const viewUpdateCallbacks: ViewUpdateCallback[] = [];

// Historical data cache for OHLC data needed by sumtyme
const ohlcDataCache: Map<string, OHLCData[]> = new Map();

// Current polling state
let pollingInterval: number | null = null;
let isPolling = false;
let activePollingTickers = new Set<string>(["BTCUSDT"]);

// Interfaces matching the updated sumtyme.ai API
interface OHLCData {
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
}

interface OHLCForecastRequest {
    data_input: OHLCData[];
    interval: number;
    interval_unit: string;
    reasoning_mode: string;
}

interface OHLCForecastResponse {
    causal_chain: number;
    timestamp: string;
    processing_time_ms?: number;
    data_periods?: number;
}

// Helper function to get timeframe label from timeframe ID
const getTimeframeLabel = (timeframeId: string): string => {
    const timeframes = getInitialTimeframes('BTCUSDT', false);
    const timeframe = timeframes.find(tf => tf.id === timeframeId);
    return timeframe?.label || timeframeId;
};

// Helper function to format date in UTC as YYYY-MM-DD HH:mm:ss
const formatDateTimeUTC = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Function to trigger view updates after API response
const triggerDelayedViewUpdate = () => {
    setTimeout(() => {
        viewUpdateCallbacks.forEach(callback => callback());
    }, 2000);
};

// Convert timeframe ID to interval configuration for sumtyme
const getIntervalConfig = (timeframeId: string): { interval: number; interval_unit: string } => {
    const intervalValue = parseInt(timeframeId.replace(/[a-zA-Z]/g, ''));
    const unit = timeframeId.replace(/[0-9]/g, '').toLowerCase();

    let intervalMinutes: number;
    switch (unit) {
        case 'm':
            intervalMinutes = intervalValue;
            break;
        case 'h':
            intervalMinutes = intervalValue * 60;
            break;
        case 'd':
            intervalMinutes = intervalValue * 60 * 24;
            break;
        default:
            intervalMinutes = intervalValue;
    }

    return {
        interval: intervalMinutes,
        interval_unit: 'minutes'
    };
};

// Get historical OHLC data needed for sumtyme analysis
// CRITICAL: Requires at least 5001 periods - if more, take the latest 5000 plus forecast placeholder
const getHistoricalOHLCData = async (
    timeframeId: string,
    symbol: string = 'BTCUSDT',
    forecastDatetime?: string // Optional: specify the forecast datetime
): Promise<OHLCData[]> => {
    const cacheKey = `${symbol}_${timeframeId}_5001`;

    // Don't use cache if we have a specific forecast datetime
    if (!forecastDatetime && ohlcDataCache.has(cacheKey)) {
        return ohlcDataCache.get(cacheKey)!;
    }

    try {
        const timeframes = getInitialTimeframes(symbol, false);
        const timeframe = timeframes.find(tf => tf.id === timeframeId);

        if (!timeframe) {
            throw new Error(`Unsupported timeframe: ${timeframeId}`);
        }

        // Fetch available historical data - we'll trim to 5000 if needed
        const tempTimeframe = {
            ...timeframe,
            dataLimit: Math.max(5000, timeframe.dataLimit) // Fetch at least 5000
        };

        const candlestickData = await fetchKlineData(tempTimeframe, symbol, 0);

        // Take the latest 5000 data points if we have more
        const latestData = candlestickData.length > 5000
            ? candlestickData.slice(-5000)
            : candlestickData;

        // Convert to OHLC format
        const ohlcData: OHLCData[] = latestData.map(candle => ({
            datetime: formatDateTimeUTC(new Date(candle.time * 1000)),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close
        }));

        // Add forecast placeholder as the 5001st row
        const lastDatetime = latestData[latestData.length - 1]?.time;
        if (lastDatetime) {
            const { interval } = getIntervalConfig(timeframeId);
            const nextDatetime = new Date((lastDatetime + (interval * 60)) * 1000);

            ohlcData.push({
                datetime: forecastDatetime || formatDateTimeUTC(nextDatetime),
                open: 0,
                high: 0,
                low: 0,
                close: 0
            });
        }

        // Only cache if we're not using a specific forecast datetime
        if (!forecastDatetime) {
            ohlcDataCache.set(cacheKey, ohlcData);
        }

        console.log(`Prepared ${ohlcData.length} OHLC data points for ${timeframeId} (${latestData.length} historical + 1 forecast placeholder)`);
        return ohlcData;
    } catch (error) {
        console.error(`Error fetching historical OHLC data for ${timeframeId}:`, error);
        return [];
    }
};

// Main prediction function using updated sumtyme API
export const getPrediction = async (
    timeframeId: string,
    datetime: string,
    symbol: string = 'BTCUSDT'
): Promise<PredictionData> => {
    try {
        if (!SUPPORTED_PREDICTION_INTERVALS.includes(timeframeId)) {
            console.warn(`Timeframe ${timeframeId} not supported for predictions`);
            return { [datetime]: 0 };
        }

        console.log(`Making sumtyme ohlc_forecast call for ${timeframeId} at ${datetime} for ${symbol}`);

        // Get historical OHLC data with forecast placeholder
        const historicalData = await getHistoricalOHLCData(timeframeId, symbol, datetime);

        if (historicalData.length !== 5001) {
            console.warn(`Invalid data length: ${historicalData.length}. Expected 5001 periods.`);
            return { [datetime]: 0 };
        }

        const { interval, interval_unit } = getIntervalConfig(timeframeId);

        const requestPayload: OHLCForecastRequest = {
            data_input: historicalData,
            interval,
            interval_unit,
            reasoning_mode: 'proactive'
        };

        // Updated endpoint: /forecast/ohlc instead of /predict/directional_change
        const response = await fetch(`${SUMTYME_API_BASE_URL}/forecast/ohlc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: OHLCForecastResponse = await response.json();

        const timestamp = result.timestamp;
        const predictionValue = result.causal_chain;
        const prediction: PredictionData = { [timestamp]: predictionValue };

        console.log(
        `Sumtyme ohlc_forecast for ${timeframeId}: ${predictionValue} (causal_chain) at ${timestamp}`
        );

        // Optional: log extra info if present
        if (result.processing_time_ms !== undefined) {
        console.log(`Processing time: ${result.processing_time_ms} ms`);
        }
        if (result.data_periods !== undefined) {
        console.log(`Data periods: ${result.data_periods}`);
        }

        // Save prediction to global state (only if non-zero)
        if (predictionValue !== 0) {
            const timeframeLabel = getTimeframeLabel(timeframeId);
            await savePrediction(timeframeId, datetime, predictionValue, timeframeLabel, symbol);
        }

        triggerDelayedViewUpdate();

        return prediction;
    } catch (error) {
        console.error(`Error with sumtyme ohlc_forecast for ${timeframeId}:`, error);
        return { [datetime]: 0 };
    }
};

// Main polling logic - checks time and makes predictions
const checkAndCallAPI = async () => {
    if (!isPolling) return;

    const now = new Date();
    const seconds = now.getUTCSeconds();
    const minutes = now.getUTCMinutes();

    // Only make API calls when the second is 1
    if (seconds !== 1) return;

    const datetime = formatDateTimeUTC(now);

    const predictionPromises: Promise<void>[] = [];

    for (const ticker of activePollingTickers) {
        // 1 minute - every minute
        if (minutes % 1 === 0) {
            predictionPromises.push(
                getPrediction('1m', datetime, ticker).then(prediction =>
                    notifyPredictionUpdate(prediction, '1m', ticker)
                ).catch(error => console.error(`Error with 1m prediction for ${ticker}:`, error))
            );
        }

        // 3 minutes - every 3 minutes
        if (minutes % 3 === 0) {
            predictionPromises.push(
                getPrediction('3m', datetime, ticker).then(prediction =>
                    notifyPredictionUpdate(prediction, '3m', ticker)
                ).catch(error => console.error(`Error with 3m prediction for ${ticker}:`, error))
            );
        }

        // 5 minutes - every 5 minutes
        if (minutes % 5 === 0) {
            predictionPromises.push(
                getPrediction('5m', datetime, ticker).then(prediction =>
                    notifyPredictionUpdate(prediction, '5m', ticker)
                ).catch(error => console.error(`Error with 5m prediction for ${ticker}:`, error))
            );
        }

        // 15 minutes - every 15 minutes
        if (minutes % 15 === 0) {
            predictionPromises.push(
                getPrediction('15m', datetime, ticker).then(prediction =>
                    notifyPredictionUpdate(prediction, '15m', ticker)
                ).catch(error => console.error(`Error with 15m prediction for ${ticker}:`, error))
            );
        }
    }

    if (predictionPromises.length > 0) {
        console.log(`Making ${predictionPromises.length} ohlc_forecast(s) for ${activePollingTickers.size} ticker(s) at ${datetime}`);
        await Promise.allSettled(predictionPromises);
    }
};

// Add a ticker to active polling
export const addPollingTicker = (ticker: string) => {
    if (!activePollingTickers.has(ticker)) {
        console.log(`Adding ticker ${ticker} to prediction polling`);
        activePollingTickers.add(ticker);

        ohlcDataCache.clear(); // Clear entire cache to force fresh data

        loadPredictionsForTicker(ticker);
    }
};

// Remove a ticker from active polling
export const removePollingTicker = (ticker: string) => {
    if (activePollingTickers.has(ticker)) {
        console.log(`Removing ticker ${ticker} from prediction polling`);
        activePollingTickers.delete(ticker);

        const keysToDelete = Array.from(ohlcDataCache.keys()).filter(key => key.startsWith(ticker));
        keysToDelete.forEach(key => ohlcDataCache.delete(key));
    }
};

// Get all active polling tickers
export const getActivePollingTickers = (): string[] => {
    return Array.from(activePollingTickers);
};

// Legacy function for backward compatibility
export const switchPollingTicker = (newTicker: string) => {
    addPollingTicker(newTicker);
};

// Alternative prediction using univariate forecast (if needed)
export const getUnivariatePrediction = async (
    timeframeId: string,
    datetime: string,
    symbol: string = 'BTCUSDT'
): Promise<PredictionData> => {
    try {
        // This would require fetching univariate data (e.g., close prices only)
        // and formatting it differently - implement if needed
        console.warn('Univariate forecast not yet implemented');
        return { [datetime]: 0 };
    } catch (error) {
        console.error(`Error with univariate forecast for ${timeframeId}:`, error);
        return { [datetime]: 0 };
    }
};

// Keep all existing export functions for backward compatibility
export const subscribeToPredictionUpdates = subscribeToService;

export const getCurrentPredictions = (timeframeId: string, useQuadrupled: boolean = false, ticker: string = 'BTCUSDT') =>
    getCurrentFromService(timeframeId, useQuadrupled, ticker);

export const subscribeToViewUpdates = (callback: ViewUpdateCallback) => {
    viewUpdateCallbacks.push(callback);

    return () => {
        const index = viewUpdateCallbacks.indexOf(callback);
        if (index !== -1) {
            viewUpdateCallbacks.splice(index, 1);
        }
    };
};

const notifyPredictionUpdate = async (prediction: PredictionData, timeframeId: string, ticker: string) => {
    const timeframeLabel = getTimeframeLabel(timeframeId);

    for (const [datetime, value] of Object.entries(prediction)) {
        if (value !== 0) {
            await savePrediction(timeframeId, datetime, value, timeframeLabel, ticker);
        }
    }

    triggerDelayedViewUpdate();
};

// Function to start prediction polling
export const startPredictionPolling = () => {
    if (pollingInterval !== null) {
        clearInterval(pollingInterval);
    }

    isPolling = true;

    pollingInterval = window.setInterval(() => {
        checkAndCallAPI().catch(error => {
            console.error('Error in polling cycle:', error);
        });
    }, 1000);

    console.log(`Sumtyme ohlc_forecast polling started for tickers: ${Array.from(activePollingTickers).join(', ')}`);
};

// Function to stop prediction polling
export const stopPredictionPolling = () => {
    if (pollingInterval !== null) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    isPolling = false;
    console.log('Sumtyme prediction polling stopped');
};

// Cleanup function
export const cleanup = () => {
    stopPredictionPolling();
    activePollingTickers.clear();
    ohlcDataCache.clear();
};

// Health check function
export const checkServerHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${SUMTYME_API_BASE_URL}/health`);
        return response.ok;
    } catch (error) {
        console.error('Sumtyme server health check failed:', error);
        return false;
    }
};

// Clear cache function
export const clearCache = () => {
    ohlcDataCache.clear();
    console.log('OHLC data cache cleared');
};

// Initialize polling automatically
startPredictionPolling();