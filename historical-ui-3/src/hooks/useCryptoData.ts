import { useEffect, useState, useCallback } from 'react';
import { 
  TIMEFRAMES, 
  connectWebSocket, 
  fetchHistoricalData, 
  subscribeToUpdates, 
  cleanupConnections 
} from '../api/binanceAPI';
import { 
  initializePredictions, 
  getPrediction, 
  getLatestPrediction 
} from '../api/sumtymeAPI';
import { CandlestickData, PredictionResponse, TimeframeConfig } from '../types';

export const useCryptoData = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, CandlestickData[]>>({});
  const [predictions, setPredictions] = useState<Record<string, PredictionResponse | null>>({});
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>({});

  // Initialize data for all timeframes
  const initializeData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize predictions store
      initializePredictions(TIMEFRAMES);
      
      // Initialize connection status
      const initialConnectionStatus: Record<string, boolean> = {};
      TIMEFRAMES.forEach(tf => {
        initialConnectionStatus[tf.id] = false;
      });
      setConnectionStatus(initialConnectionStatus);
      
      // Fetch historical data for all timeframes
      const initialData: Record<string, CandlestickData[]> = {};
      for (const timeframe of TIMEFRAMES) {
        const historicalData = await fetchHistoricalData(timeframe);
        initialData[timeframe.id] = historicalData;
        
        // Get initial prediction
        if (historicalData.length > 0) {
          const prediction = await getPrediction(timeframe.id, historicalData);
          setPredictions(prev => ({
            ...prev,
            [timeframe.id]: prediction,
          }));
        }
      }
      
      setData(initialData);
    } catch (err) {
      setError('Failed to initialize data');
      console.error('Error initializing data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle data updates from WebSocket
  const handleDataUpdate = useCallback((newData: CandlestickData[], timeframeId: string) => {
    setData(prevData => ({
      ...prevData,
      [timeframeId]: newData,
    }));
    
    // Update connection status
    setConnectionStatus(prev => ({
      ...prev,
      [timeframeId]: true,
    }));
    
    // Get prediction for the updated data
    // Only get new prediction every few updates to avoid too many API calls
    const shouldGetPrediction = Math.random() < 0.2; // ~20% chance per update
    if (shouldGetPrediction && newData.length > 0) {
      getPrediction(timeframeId, newData)
        .then(prediction => {
          if (prediction) {
            setPredictions(prev => ({
              ...prev,
              [timeframeId]: prediction,
            }));
          }
        })
        .catch(err => console.error(`Error getting prediction for ${timeframeId}:`, err));
    }
  }, []);

  // Connect to WebSockets for all timeframes
  useEffect(() => {
    initializeData();
    
    // Subscribe to updates for all timeframes
    const unsubscribe = subscribeToUpdates(handleDataUpdate);
    
    // Connect to WebSockets for all timeframes
    TIMEFRAMES.forEach(timeframe => {
      connectWebSocket(timeframe);
    });
    
    // Cleanup on unmount
    return () => {
      unsubscribe();
      cleanupConnections();
    };
  }, [initializeData, handleDataUpdate]);

  // Get the latest data and prediction for a specific timeframe
  const getTimeframeData = useCallback((timeframeId: string) => {
    return {
      candlesticks: data[timeframeId] || [],
      prediction: predictions[timeframeId] || getLatestPrediction(timeframeId),
      isConnected: connectionStatus[timeframeId] || false,
    };
  }, [data, predictions, connectionStatus]);

  // Get configuration for a specific timeframe
  const getTimeframeConfig = useCallback((timeframeId: string): TimeframeConfig | undefined => {
    return TIMEFRAMES.find(tf => tf.id === timeframeId);
  }, []);

  return {
    isLoading,
    error,
    data,
    predictions,
    connectionStatus,
    timeframes: TIMEFRAMES,
    getTimeframeData,
    getTimeframeConfig,
  };
};