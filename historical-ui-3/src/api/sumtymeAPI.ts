import { PredictionEntry } from '../types';
import {
  subscribeToPredictionUpdates as subscribeToService,
  getCurrentPredictions as getCurrentFromService
} from '../services/predictionService';

export const SUPPORTED_PREDICTION_INTERVALS = ['1m', '3m', '5m', '15m'];

type ViewUpdateCallback = () => void;
const viewUpdateCallbacks: ViewUpdateCallback[] = [];

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

export const addPollingTicker = (ticker: string) => {
  console.log('CSV mode: No polling needed for ticker:', ticker);
};

export const removePollingTicker = (ticker: string) => {
  console.log('CSV mode: No polling to remove for ticker:', ticker);
};

export const getActivePollingTickers = (): string[] => {
  return [];
};

export const switchPollingTicker = (newTicker: string) => {
  console.log('CSV mode: No polling to switch for ticker:', newTicker);
};

export const startPredictionPolling = () => {
  console.log('CSV mode: Prediction polling disabled');
};

export const stopPredictionPolling = () => {
  console.log('CSV mode: No polling to stop');
};

export const cleanup = () => {
  console.log('CSV mode: Cleanup complete');
};

export const checkServerHealth = async (): Promise<boolean> => {
  return true;
};

export const clearCache = () => {
  console.log('CSV mode: No cache to clear');
};
