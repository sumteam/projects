import { PredictionEntry } from '../types';
import { getCSVPredictions, subscribeToCSVDataUpdates } from './csvService';

const predictionCache: Record<string, Record<string, PredictionEntry[]>> = {};
const sixteenTimesPredictionCache: Record<string, Record<string, PredictionEntry[]>> = {};

type PredictionCallback = (predictions: PredictionEntry[], timeframeId: string, ticker: string) => void;
const predictionCallbacks: PredictionCallback[] = [];

let isInitialized = false;
let currentSixteenTimesMode = false;

const initializeTickerCache = (ticker: string) => {
    if (!predictionCache[ticker]) {
        predictionCache[ticker] = { '1m': [], '3m': [], '5m': [], '15m': [] };
    }
    if (!sixteenTimesPredictionCache[ticker]) {
        sixteenTimesPredictionCache[ticker] = { '1m': [], '3m': [], '5m': [], '15m': [] };
    }
};

export const initializePredictionService = async () => {
    if (isInitialized) return;

    try {
        subscribeToCSVDataUpdates(() => {
            notifyAllPredictionUpdates();
        });

        isInitialized = true;
        console.log('Prediction service initialized for CSV mode');
    } catch (error) {
        console.error('Failed to initialize prediction service:', error);
    }
};

export const loadPredictionsFromCSV = (fileId: string, timeframes: string[]) => {
    initializeTickerCache(fileId);

    timeframes.forEach(timeframe => {
        const predictions = getCSVPredictions(fileId, timeframe);

        predictionCache[fileId][timeframe] = predictions;
        sixteenTimesPredictionCache[fileId][timeframe] = predictions;
    });

    notifyPredictionsForTicker(fileId);
};

export const subscribeToPredictionUpdates = (callback: PredictionCallback) => {
    predictionCallbacks.push(callback);

    Object.keys(predictionCache).forEach(ticker => {
        Object.keys(predictionCache[ticker]).forEach(timeframe => {
            const cacheToUse = currentSixteenTimesMode ? sixteenTimesPredictionCache : predictionCache;
            if (cacheToUse[ticker] && cacheToUse[ticker][timeframe].length > 0) {
                callback(cacheToUse[ticker][timeframe], timeframe, ticker);
            }
        });
    });

    return () => {
        const index = predictionCallbacks.indexOf(callback);
        if (index !== -1) {
            predictionCallbacks.splice(index, 1);
        }
    };
};

export const getCurrentPredictions = (timeframeId: string, useSixteenTimes: boolean, ticker: string): PredictionEntry[] => {
    const cacheToUse = useSixteenTimes ? sixteenTimesPredictionCache : predictionCache;
    return (cacheToUse[ticker] && cacheToUse[ticker][timeframeId]) ? cacheToUse[ticker][timeframeId] : [];
};

export const loadPredictionsForTicker = (ticker: string) => {
    const allPredictions = getCSVPredictions(ticker);

    initializeTickerCache(ticker);

    ['1m', '3m', '5m', '15m'].forEach(timeframe => {
        const timeframePredictions = allPredictions.filter(p => p.timeframeId === timeframe);
        predictionCache[ticker][timeframe] = timeframePredictions;
        sixteenTimesPredictionCache[ticker][timeframe] = timeframePredictions;
    });

    notifyPredictionsForTicker(ticker);
};

export const setSixteenTimesMode = async (sixteenTimesMode: boolean) => {
    if (currentSixteenTimesMode !== sixteenTimesMode) {
        currentSixteenTimesMode = sixteenTimesMode;
        notifyAllPredictionUpdates();
    }
};

function notifyPredictionsForTicker(ticker: string) {
    Object.keys(predictionCache[ticker] || {}).forEach(timeframe => {
        const cacheToUse = currentSixteenTimesMode ? sixteenTimesPredictionCache : predictionCache;
        if (cacheToUse[ticker] && cacheToUse[ticker][timeframe]) {
            predictionCallbacks.forEach(callback =>
                callback(cacheToUse[ticker][timeframe], timeframe, ticker)
            );
        }
    });
}

function notifyAllPredictionUpdates() {
    Object.keys(predictionCache).forEach(ticker => {
        notifyPredictionsForTicker(ticker);
    });
}

export const cleanupPredictionService = async () => {
    isInitialized = false;
    currentSixteenTimesMode = false;
};

export const savePrediction = async (
    timeframe: string,
    datetime: string,
    value: number,
    timeframeLabel: string,
    ticker: string
): Promise<void> => {
    console.log('CSV mode: Predictions are loaded from CSV, not saved dynamically');
};
