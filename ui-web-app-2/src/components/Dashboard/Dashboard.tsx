import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ChartContainer from '../Chart/ChartContainer';
import QuadView from './QuadView';
import { getInitialTimeframes, startKlinePolling, cleanupConnections, parseAndValidateTimeframeInput, calculateDataLimit, convertIntervalToMinutes } from '../../api/binanceAPI';
import { subscribeToPredictionUpdates, setSixteenTimesMode } from '../../services/predictionService';
import { CryptoSymbol, TimeframeConfig, PredictionEntry } from '../../types';
import { SUPPORTED_PREDICTION_INTERVALS } from '../../api/sumtymeAPI';
import { Info, X, Search, Grid3x3, History } from 'lucide-react';
import { addPollingTicker } from '../../api/sumtymeAPI';
import { loadPredictionsForTicker } from '../../services/predictionService';
import { extractTrendIndicators, organizePredictionsByTicker, Propagation } from '../../utils/propagationTracker';

const Dashboard: React.FC = () => {
    const [currentSymbol, setCurrentSymbol] = useState<CryptoSymbol>('BTCUSDT');
    const [tickerInput, setTickerInput] = useState('');
    const [tickerError, setTickerError] = useState('');
    const [isValidatingTicker, setIsValidatingTicker] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showQuadView, setShowQuadView] = useState(false);
    const [showAllInsights, setShowAllInsights] = useState(false);
    const [showHistoricalPerformance, setShowHistoricalPerformance] = useState(false);
    const [isTogglingHistory, setIsTogglingHistory] = useState(false);

    const [userSelectedTimeframes, setUserSelectedTimeframes] = useState<TimeframeConfig[]>(() => 
        getInitialTimeframes(currentSymbol, false)
    );
    const [timeframeInput, setTimeframeInput] = useState('1m, 3m, 5m, 15m');
    const [timeframeInputError, setTimeframeInputError] = useState('');
    const [allPredictionsData, setAllPredictionsData] = useState<Record<string, Record<string, PredictionEntry[]>>>({});
    const [quadViewTickers, setQuadViewTickers] = useState<CryptoSymbol[]>(['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT']);

    const handleQuadViewTickersChange = useCallback((tickers: CryptoSymbol[]) => {
        setQuadViewTickers(tickers);
    }, []);

    // Start kline polling - only when NOT in quad view (quad view handles its own polling)
    useEffect(() => {
        if (!showQuadView) {
            startKlinePolling(currentSymbol, userSelectedTimeframes);
        }
        // Note: Don't cleanup here - let quad view handle cleanup when switching
    }, [currentSymbol, showQuadView, userSelectedTimeframes]);

    // Subscribe to prediction updates
    useEffect(() => {
        const unsubscribe = subscribeToPredictionUpdates((predictions, timeframeId, ticker) => {
            setAllPredictionsData(prev => ({
                ...prev,
                [ticker]: {
                    ...(prev[ticker] || {}),
                    [timeframeId]: predictions
                }
            }));
        });

        return unsubscribe;
    }, []);

    // Handle history toggle - update timeframes with 5x multiplier
    useEffect(() => {
        console.log('History mode changed to:', showHistoricalPerformance);
        
        // Update the prediction service mode
        setSixteenTimesMode(showHistoricalPerformance);
        
        // Update all timeframes with the new multiplier
        setUserSelectedTimeframes(prevTimeframes =>
            prevTimeframes.map(tf => {
                const baseDataLimit = calculateDataLimit(tf.binanceInterval);
                return {
                    ...tf,
                    dataLimit: showHistoricalPerformance ? baseDataLimit * 5 : baseDataLimit
                };
            })
        );
    }, [showHistoricalPerformance]);

    const getHighestFrequencyTimeframe = useMemo((): TimeframeConfig => {
        if (userSelectedTimeframes.length === 0) {
            const baseDataLimit = calculateDataLimit('1m');
            return {
                id: '1m',
                label: '1 Minute',
                binanceInterval: '1m',
                wsEndpoint: `${currentSymbol.toLowerCase()}@kline_1m`,
                color: '#919191',
                dataLimit: showHistoricalPerformance ? baseDataLimit * 5 : baseDataLimit,
            };
        }

        const highest = userSelectedTimeframes.reduce((highest, current) => {
            const currentMinutes = convertIntervalToMinutes(current.binanceInterval);
            const highestMinutes = convertIntervalToMinutes(highest.binanceInterval);
            return currentMinutes < highestMinutes ? current : highest;
        });

        return highest;
    }, [userSelectedTimeframes, currentSymbol, showHistoricalPerformance]);

    const handleSetTimeframes = () => {
        const trimmedInput = timeframeInput.trim();
        if (!trimmedInput) {
            setTimeframeInputError('Please enter at least one timeframe.');
            return;
        }

        const timeframeStrings = trimmedInput.split(',').map(tf => tf.trim()).filter(tf => tf.length > 0);

        if (timeframeStrings.length === 0) {
            setTimeframeInputError('Please enter at least one valid timeframe.');
            return;
        }

        const validTimeframes: TimeframeConfig[] = [];
        const invalidTimeframes: string[] = [];

        for (const tfString of timeframeStrings) {
            const parseResult = parseAndValidateTimeframeInput(tfString);

            if (parseResult.success && parseResult.binanceInterval && parseResult.label) {
                const baseDataLimit = calculateDataLimit(parseResult.binanceInterval);

                validTimeframes.push({
                    id: parseResult.binanceInterval,
                    label: parseResult.label,
                    binanceInterval: parseResult.binanceInterval,
                    wsEndpoint: `${currentSymbol.toLowerCase()}@kline_${parseResult.binanceInterval}`,
                    color: '#919191',
                    dataLimit: showHistoricalPerformance ? baseDataLimit * 5 : baseDataLimit,
                });
            } else {
                invalidTimeframes.push(tfString);
            }
        }

        if (validTimeframes.length === 0) {
            setTimeframeInputError('No valid timeframes found. Please check your input.');
            return;
        }

        if (invalidTimeframes.length > 0) {
            setTimeframeInputError(`Invalid timeframes: ${invalidTimeframes.join(', ')}`);
            return;
        }

        setUserSelectedTimeframes(validTimeframes);
        setTimeframeInputError('');
    };

    const toggleInfoModal = () => {
        setShowInfoModal(prev => !prev);
    };

    const toggleHistoricalPerformance = () => {
        if (isTogglingHistory) {
            console.log('Toggle already in progress, ignoring');
            return;
        }
        
        setIsTogglingHistory(true);
        setShowHistoricalPerformance(prev => {
            const newValue = !prev;
            console.log('Toggle clicked: changing from', prev, 'to', newValue);
            return newValue;
        });
        
        // Reset the toggle lock after a short delay
        setTimeout(() => {
            setIsTogglingHistory(false);
        }, 8000);
    };

    const handleTimeframeUpdate = (updatedTimeframe: TimeframeConfig) => {
        setUserSelectedTimeframes(prevTimeframes =>
            prevTimeframes.map(tf => {
                if (tf.id === updatedTimeframe.id) {
                    // Ensure the updated timeframe respects the current history mode
                    const baseDataLimit = calculateDataLimit(updatedTimeframe.binanceInterval);
                    return {
                        ...updatedTimeframe,
                        dataLimit: showHistoricalPerformance ? baseDataLimit * 5 : baseDataLimit
                    };
                }
                return tf;
            })
        );
    };

    const handleTickerInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTickerInput(e.target.value.toUpperCase());
        setTickerError('');
    };

    const validateTicker = async (ticker: string): Promise<boolean> => {
        try {
            const response = await fetch(
                `https://api.binance.us/api/v3/klines?symbol=${ticker}&interval=1m&limit=1`
            );

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return Array.isArray(data) && data.length > 0;
        } catch (error) {
            console.error('Error validating ticker:', error);
            return false;
        }
    };

    const handleTickerSubmit = async () => {
        const trimmedInput = tickerInput.trim();

        if (!trimmedInput) {
            setTickerError('Please enter a ticker.');
            return;
        }

        setIsValidatingTicker(true);
        setTickerError('');

        try {
            const isValid = await validateTicker(trimmedInput);

            if (!isValid) {
                setTickerError('Invalid ticker. Please try again.');
                return;
            }

            setCurrentSymbol(trimmedInput);
            addPollingTicker(trimmedInput);
            await loadPredictionsForTicker(trimmedInput);

            setTickerInput('');
            setTickerError('');

        } catch (error) {
            console.error('Error validating ticker:', error);
            setTickerError('Invalid ticker. Please try again.');
        } finally {
            setIsValidatingTicker(false);
        }
    };

    const handleTickerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleTickerSubmit();
        }
    };

    // Get propagations for display in info modal
    const getAllPropagations = (): Record<string, Propagation[]> => {
        const propagationsByTicker: Record<string, Propagation[]> = {};
        
        const tickersToShow = showQuadView ? quadViewTickers : [currentSymbol];
        
        for (const ticker of tickersToShow) {
            const tickerPredictions = allPredictionsData[ticker] || {};
            const { propagations } = extractTrendIndicators(tickerPredictions, ticker);
            propagationsByTicker[ticker] = propagations;
        }
        
        return propagationsByTicker;
    };

    const propagationsByTicker = getAllPropagations();

    return (
        <div className="h-screen flex flex-col bg-[#1a1a1a]">
            {/* Header */}
            <div className="flex items-center justify-between bg-[#1a1a1a] border-b border-[#2a2a2a] px-2 py-0.5 md:px-4 md:py-1">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={toggleInfoModal}
                        className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white transition-colors"
                    >
                        <Info size={12} />
                        <span>Info</span>
                    </button>

                    <button
                        onClick={() => setShowQuadView(prev => !prev)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            showQuadView
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white'
                        }`}
                    >
                        <Grid3x3 size={12} />
                        <span>Quad View</span>
                    </button>

                    <button
                        onClick={() => setShowAllInsights(prev => !prev)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            showAllInsights
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white'
                        }`}
                    >
                        <span>See All Insights</span>
                    </button>

                    <button
                        onClick={toggleHistoricalPerformance}
                        disabled={isTogglingHistory}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            showHistoricalPerformance
                                ? 'bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white'
                                : 'bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white'
                        } ${isTogglingHistory ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <History size={12} />
                        <span>History (5x)</span>
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex flex-col items-end">
                        <div className="flex items-center space-x-1">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={tickerInput}
                                    onChange={handleTickerInputChange}
                                    onKeyDown={handleTickerKeyDown}
                                    placeholder="Enter ticker (e.g. ETHUSDT)"
                                    disabled={isValidatingTicker}
                                    className="bg-[#2a2a2a] text-white text-[0.6rem] px-2 py-1 rounded border border-[#3a3a3a] focus:border-blue-500 focus:outline-none w-32 md:w-40 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                {isValidatingTicker && (
                                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleTickerSubmit}
                                disabled={isValidatingTicker || !tickerInput.trim()}
                                className="flex items-center justify-center px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Search size={12} />
                            </button>
                        </div>
                        {tickerError && (
                            <span className="text-red-400 text-[10px] mt-1">{tickerError}</span>
                        )}
                    </div>

                    <div className="text-[#999] text-xs font-medium">
                        {currentSymbol}
                    </div>
                </div>
            </div>

            {/* Info Modal */}
            {showInfoModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg max-w-6xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
                            <h2 className="text-white text-lg font-semibold">Dashboard Information</h2>
                            <button
                                onClick={toggleInfoModal}
                                className="text-[#999] hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-[#ccc] leading-relaxed">
                            <p className="text-white font-medium">
                                This dashboard visualises sumtyme.ai EIP's real-time analysis of market structure across multiple timeframes for any valid crypto ticker.
                            </p>

                            {/* Propagation Table */}
                            <div className="pt-4 border-t border-[#2a2a2a]">
                                <h3 className="text-white font-medium mb-3">Trend Propagations</h3>
                                <div className="overflow-x-auto">
                                    {Object.keys(propagationsByTicker).map(ticker => {
                                        const propagations = propagationsByTicker[ticker];
                                        if (propagations.length === 0) return null;
                                        
                                        return (
                                            <div key={ticker} className="mb-6">
                                                <h4 className="text-white text-sm font-medium mb-2">{ticker}</h4>
                                                <table className="w-full text-xs border border-[#3a3a3a]">
                                                    <thead className="bg-[#2a2a2a]">
                                                        <tr>
                                                            <th className="px-2 py-1 text-left border-r border-[#3a3a3a]">Prop ID</th>
                                                            <th className="px-2 py-1 text-left border-r border-[#3a3a3a]">Level</th>
                                                            <th className="px-2 py-1 text-left border-r border-[#3a3a3a]">Datetime</th>
                                                            <th className="px-2 py-1 text-left border-r border-[#3a3a3a]">Trend</th>
                                                            <th className="px-2 py-1 text-left border-r border-[#3a3a3a]">From TF</th>
                                                            <th className="px-2 py-1 text-left">To TF</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {propagations.map((prop, idx) => (
                                                            <tr key={idx} className="border-t border-[#3a3a3a] hover:bg-[#2a2a2a]">
                                                                <td className="px-2 py-1 font-mono border-r border-[#3a3a3a]">{prop.propagation_id}</td>
                                                                <td className="px-2 py-1 border-r border-[#3a3a3a]">{prop.propagation_level}</td>
                                                                <td className="px-2 py-1 font-mono text-[10px] border-r border-[#3a3a3a]">{prop.datetime}</td>
                                                                <td className={`px-2 py-1 font-bold border-r border-[#3a3a3a] ${prop.trend_type > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {prop.trend_type > 0 ? 'Positive' : 'Negative'}
                                                                </td>
                                                                <td className="px-2 py-1 font-mono border-r border-[#3a3a3a]">{prop.higher_freq}</td>
                                                                <td className="px-2 py-1 font-mono">{prop.lower_freq}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })}
                                    {Object.values(propagationsByTicker).every(props => props.length === 0) && (
                                        <p className="text-[#666] text-sm">No propagations detected yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-[#2a2a2a]">
                                <h3 className="text-white font-medium mb-2">How It Works</h3>
                                <p>
                                    The system identifies initial trend changes in the highest frequency timeframe and tracks how these trends propagate to lower frequency timeframes. 
                                    Each propagation is assigned a unique ID and level, showing the chain of trend continuation across different time scales.
                                </p>
                            </div>

                            <div className="pt-4 border-t border-[#2a2a2a]">
                                <p className="text-[#999] text-sm">
                                    Live Demo started 3rd July 2025, 7:45pm. All times are in UTC.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Container */}
            <div className="flex-1 overflow-hidden">
                {showQuadView ? (
                    <QuadView
                        userSelectedTimeframes={userSelectedTimeframes}
                        onTimeframeUpdate={handleTimeframeUpdate}
                        onTickersChange={handleQuadViewTickersChange}
                        showAllInsights={showAllInsights}
                        showHistoricalPerformance={showHistoricalPerformance}
                    />
                ) : (
                    <div className="h-full bg-[#1a1a1a]">
                        <ChartContainer
                            timeframe={getHighestFrequencyTimeframe}
                            height={window.innerHeight - 32}
                            symbol={currentSymbol}
                            fixLeftEdge={true}
                            onTimeframeUpdate={handleTimeframeUpdate}
                            allPredictions={allPredictionsData}
                            showAllInsights={showAllInsights}
                            showHistoricalPerformance={showHistoricalPerformance}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;