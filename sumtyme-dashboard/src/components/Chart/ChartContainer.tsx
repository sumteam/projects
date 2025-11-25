import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';
import { CandlestickData, ChartContainerProps, PredictionEntry, ArrowPosition } from '../../types';
import { fetchKlineData, subscribeToUpdates, getCurrentData, parseAndValidateTimeframeInput, calculateDataLimit } from '../../api/binanceAPI';
import { subscribeToPredictionUpdates, getCurrentPredictions, subscribeToViewUpdates, SUPPORTED_PREDICTION_INTERVALS } from '../../api/sumtymeAPI';
import { getPredictionsToDisplay, organizePredictionsByTicker } from '../../utils/propagationTracker';
import PredictionArrow from './PredictionArrow';

const formatDateTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toISOString().slice(0, 19).replace('T', ' ');
};

const parseDateTime = (datetime: string): number => {
    return Math.floor(new Date(datetime.replace(' ', 'T') + 'Z').getTime() / 1000);
};

const getAlignedTimestamp = (timestamp: number, interval: string): number => {
    if (!timestamp || timestamp <= 0 || !isFinite(timestamp)) {
        console.error('Invalid timestamp:', timestamp);
        return Math.floor(Date.now() / 1000);
    }

    if (!interval || typeof interval !== 'string' || interval.length < 2) {
        console.error('Invalid interval format:', interval);
        return timestamp;
    }

    const date = new Date(timestamp * 1000);

    if (isNaN(date.getTime())) {
        console.error('Invalid date created from timestamp:', timestamp);
        return Math.floor(Date.now() / 1000);
    }

    const intervalValue = parseInt(interval.slice(0, -1), 10);
    const intervalUnit = interval.slice(-1).toLowerCase();

    if (isNaN(intervalValue) || intervalValue <= 0) {
        console.error('Invalid interval value:', interval);
        return timestamp;
    }

    try {
        switch (intervalUnit) {
            case 's': {
                const seconds = date.getUTCSeconds();
                const alignedSeconds = Math.floor(seconds / intervalValue) * intervalValue;
                date.setUTCSeconds(alignedSeconds, 0);
                break;
            }

            case 'm': {
                const minutes = date.getUTCMinutes();
                const alignedMinutes = Math.floor(minutes / intervalValue) * intervalValue;
                date.setUTCMinutes(alignedMinutes, 0, 0);
                break;
            }

            case 'h': {
                const hours = date.getUTCHours();
                const alignedHours = Math.floor(hours / intervalValue) * intervalValue;
                date.setUTCHours(alignedHours, 0, 0, 0);
                break;
            }

            case 'd': {
                date.setUTCHours(0, 0, 0, 0);

                if (intervalValue > 1) {
                    const epochTime = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
                    const daysSinceEpoch = Math.floor((date.getTime() - epochTime.getTime()) / (24 * 60 * 60 * 1000));
                    const alignedDays = Math.floor(daysSinceEpoch / intervalValue) * intervalValue;
                    date.setTime(epochTime.getTime() + (alignedDays * 24 * 60 * 60 * 1000));
                }
                break;
            }

            case 'w': {
                const dayOfWeek = date.getUTCDay();
                const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                date.setUTCDate(date.getUTCDate() - daysToMonday);
                date.setUTCHours(0, 0, 0, 0);

                if (intervalValue > 1) {
                    const referenceMonday = new Date(Date.UTC(2024, 0, 1, 0, 0, 0, 0));
                    const weeksSinceReference = Math.floor((date.getTime() - referenceMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                    const alignedWeeks = Math.floor(weeksSinceReference / intervalValue) * intervalValue;
                    date.setTime(referenceMonday.getTime() + (alignedWeeks * 7 * 24 * 60 * 60 * 1000));
                }
                break;
            }

            case 'M': {
                date.setUTCDate(1);
                date.setUTCHours(0, 0, 0, 0);

                if (intervalValue > 1) {
                    const year = date.getUTCFullYear();
                    const month = date.getUTCMonth();
                    const monthsSince2024 = (year - 2024) * 12 + month;
                    const alignedMonths = Math.floor(monthsSince2024 / intervalValue) * intervalValue;
                    const newYear = 2024 + Math.floor(alignedMonths / 12);
                    const newMonth = alignedMonths % 12;
                    date.setUTCFullYear(newYear, newMonth, 1);
                }
                break;
            }

            default: {
                console.warn(`Unsupported interval unit: ${intervalUnit}. Supported units: s, m, h, d, w, M`);
                return timestamp;
            }
        }

        const alignedTimestamp = Math.floor(date.getTime() / 1000);
        if (!isFinite(alignedTimestamp) || alignedTimestamp <= 0) {
            console.error('Invalid aligned timestamp calculated:', alignedTimestamp);
            return timestamp;
        }

        return alignedTimestamp;

    } catch (error) {
        console.error('Error in getAlignedTimestamp:', error, 'interval:', interval, 'timestamp:', timestamp);
        return timestamp;
    }
};

const ChartContainer: React.FC<ChartContainerProps> = ({
    timeframe,
    height,
    symbol,
    fixLeftEdge = true,
    onTimeframeUpdate,
    showAllInsights = false,
    showHistoricalPerformance = false,
    allPredictions = {}
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const overlayContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const [currentData, setCurrentData] = useState<CandlestickData[]>([]);
    const [lastPrice, setLastPrice] = useState<CandlestickData | null>(null);
    const [predictions, setPredictions] = useState<PredictionEntry[]>([]);
    const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
    const [viewUpdateTrigger, setViewUpdateTrigger] = useState(0);
    const [arrowPositions, setArrowPositions] = useState<ArrowPosition[]>([]);
    const [isMobile, setIsMobile] = useState(false);

    const [timeframeInputValue, setTimeframeInputValue] = useState('');
    const [timeframeInputError, setTimeframeInputError] = useState('');
    const [isEditingTimeframe, setIsEditingTimeframe] = useState(false);
    
    // Track previous history mode to prevent double fetches during transitions
    const prevHistoryModeRef = useRef<boolean>(showHistoricalPerformance);
    const isTransitioningRef = useRef<boolean>(false);

    useEffect(() => {
        const label = timeframe.label;
        if (label.includes('Minute')) {
            const value = label.replace(' Minutes', '').replace(' Minute', '');
            setTimeframeInputValue(`${value} M`);
        } else if (label.includes('Hour')) {
            const value = label.replace(' Hours', '').replace(' Hour', '');
            setTimeframeInputValue(`${value} H`);
        } else if (label.includes('Day')) {
            const value = label.replace(' Days', '').replace(' Day', '');
            setTimeframeInputValue(`${value} D`);
        } else if (label.includes('Week')) {
            const value = label.replace(' Weeks', '').replace(' Week', '');
            setTimeframeInputValue(`${value} W`);
        } else {
            setTimeframeInputValue(label);
        }
    }, [timeframe.label]);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 500);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleTimeframeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTimeframeInputValue(e.target.value);
        setTimeframeInputError('');
    };

    const handleTimeframeInputSubmit = () => {
        if (!onTimeframeUpdate) return;

        const parseResult = parseAndValidateTimeframeInput(timeframeInputValue);

        if (!parseResult.success) {
            setTimeframeInputError(parseResult.error || 'Invalid input');
            const label = timeframe.label;
            if (label.includes('Minute')) {
                const value = label.replace(' Minutes', '').replace(' Minute', '');
                setTimeframeInputValue(`${value} M`);
            } else if (label.includes('Hour')) {
                const value = label.replace(' Hours', '').replace(' Hour', '');
                setTimeframeInputValue(`${value} H`);
            } else {
                setTimeframeInputValue(label);
            }
            return;
        }

        if (parseResult.binanceInterval === timeframe.binanceInterval) {
            setIsEditingTimeframe(false);
            setTimeframeInputError('');
            return;
        }

        const newDataLimit = calculateDataLimit(parseResult.binanceInterval!);
        const finalDataLimit = newDataLimit;

        const updatedTimeframe = {
            ...timeframe,
            binanceInterval: parseResult.binanceInterval!,
            label: parseResult.label!,
            wsEndpoint: `${symbol.toLowerCase()}@kline_${parseResult.binanceInterval}`,
            dataLimit: finalDataLimit,
        };

        onTimeframeUpdate(updatedTimeframe);
        setIsEditingTimeframe(false);
    };

    const handleTimeframeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleTimeframeInputSubmit();
        } else if (e.key === 'Escape') {
            setIsEditingTimeframe(false);
            setTimeframeInputError('');
            const label = timeframe.label;
            if (label.includes('Minute')) {
                const value = label.replace(' Minutes', '').replace(' Minute', '');
                setTimeframeInputValue(`${value} M`);
            } else if (label.includes('Hour')) {
                const value = label.replace(' Hours', '').replace(' Hour', '');
                setTimeframeInputValue(`${value} H`);
            } else {
                setTimeframeInputValue(label);
            }
        }
    };

    const calculateArrowPositions = (): ArrowPosition[] => {
        if (!chartRef.current || !seriesRef.current || !chartContainerRef.current || currentData.length === 0) return [];

        const totalWidth = chartContainerRef.current.clientWidth;
        const rightPriceScale = chartRef.current.priceScale('right');
        const priceScaleWidth = rightPriceScale.width();
        const maxX = totalWidth - priceScaleWidth - 9;

        // Use propagation logic to get predictions to display
        const organizedPredictions = organizePredictionsByTicker(predictions);
        const tickerPredictions = organizedPredictions[symbol] || {};
        const predictionsToShow = getPredictionsToDisplay(tickerPredictions, symbol, showAllInsights);

        const arrowPositions: ArrowPosition[] = [];

        predictionsToShow.forEach(prediction => {
            const timestamp = parseDateTime(prediction.datetime);
            const alignedTimestamp = getAlignedTimestamp(timestamp, timeframe.binanceInterval);
            const candlestick = currentData.find(d => d.time === alignedTimestamp);

            if (!candlestick) return;

            const coordinate = seriesRef.current!.priceToCoordinate(candlestick.open);
            const timeScale = chartRef.current!.timeScale();
            const timeCoordinate = timeScale.timeToCoordinate(alignedTimestamp);

            if (coordinate === null || timeCoordinate === null) return;

            if (timeCoordinate >= maxX || timeCoordinate < 0) return;

            arrowPositions.push({
                x: timeCoordinate,
                y: coordinate,
                value: prediction.value,
                datetime: prediction.datetime,
                timeframeId: prediction.timeframeId,
                ticker: prediction.ticker,
                isChangeEnding: false
            });
        });

        return arrowPositions;
    };

    // FIXED: Recalculate arrow positions whenever predictions OR showAllInsights changes
    useEffect(() => {
        console.log(`[ChartContainer ${symbol}] Recalculating arrow positions - showAllInsights: ${showAllInsights}, predictions count: ${predictions.length}`);
        const newArrowPositions = calculateArrowPositions();
        console.log(`[ChartContainer ${symbol}] Calculated ${newArrowPositions.length} arrow positions`);
        setArrowPositions(newArrowPositions);
    }, [predictions, currentData, viewUpdateTrigger, chartDimensions, showAllInsights, symbol]);

    useEffect(() => {
        let resizeObserver: ResizeObserver | null = null;

        if (chartContainerRef.current) {
            const chartElement = chartContainerRef.current;
            chartElement.innerHTML = '';

            const containerWidth = Math.max(1, chartElement.clientWidth - 2);
            const containerHeight = Math.max(1, chartElement.clientHeight - 2);

            const fontSize = isMobile ? 8 : 10;
            const lineWidth = isMobile ? 1.5 : 1;
            const crosshairRadius = isMobile ? 3 : 4;

            const newChart = createChart(chartElement, {
                width: containerWidth,
                height: containerHeight,
                layout: {
                    background: { type: 'solid', color: '#1a1a1a' },
                    textColor: '#999',
                    fontSize: fontSize,
                    fontFamily: 'Inter, sans-serif',
                },
                grid: {
                    vertLines: { color: '#2a2a2a', style: 1 },
                    horzLines: { color: '#2a2a2a', style: 1 },
                },
                timeScale: {
                    borderColor: '#2a2a2a',
                    timeVisible: true,
                    secondsVisible: !isMobile,
                    borderVisible: true,
                    fixLeftEdge: fixLeftEdge,
                    fixRightEdge: true,
                    visible: true,
                    rightOffset: isMobile ? 5 : 10,
                },
                rightPriceScale: {
                    borderColor: '#2a2a2a',
                    borderVisible: true,
                    scaleMargins: {
                        top: 0.05,
                        bottom: isMobile ? 0.1 : 0.15,
                    },
                    visible: true,
                    width: isMobile ? 50 : 60,
                },
                crosshair: {
                    mode: 1,
                    vertLine: {
                        color: '#555',
                        width: 1,
                        style: 2,
                        labelBackgroundColor: '#1a1a1a',
                    },
                    horzLine: {
                        color: '#555',
                        width: 1,
                        style: 2,
                        labelBackgroundColor: '#1a1a1a',
                    },
                },
                handleScroll: {
                    mouseWheel: true,
                    pressedMouseMove: true,
                    horzTouchDrag: true,
                    vertTouchDrag: true,
                },
                handleScale: {
                    axisPressedMouseMove: {
                        time: true,
                        price: false,
                    },
                    mouseWheel: true,
                    pinch: true,
                },
                kineticScroll: {
                    mouse: true,
                    touch: true,
                },
            });

            const newSeries = newChart.addLineSeries({
                color: timeframe.color,
                lineWidth: lineWidth,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: crosshairRadius,
                crosshairMarkerBorderColor: timeframe.color,
                crosshairMarkerBackgroundColor: timeframe.color,
                priceLineVisible: false,
                lastValueVisible: false,
            });

            chartRef.current = newChart;
            seriesRef.current = newSeries;

            const timeScale = newChart.timeScale();
            timeScale.subscribeVisibleLogicalRangeChange(() => {
                setViewUpdateTrigger(prev => prev + 1);
            });

            setChartDimensions({
                width: containerWidth,
                height: containerHeight
            });

            resizeObserver = new ResizeObserver(entries => {
                if (entries[0] && chartRef.current) {
                    const { width, height: newHeight } = entries[0].contentRect;
                    const adjustedWidth = Math.max(1, width - 4);
                    const adjustedHeight = Math.max(1, newHeight - 4);

                    chartRef.current.applyOptions({
                        width: adjustedWidth,
                        height: adjustedHeight
                    });
                    setChartDimensions({ width: adjustedWidth, height: adjustedHeight });
                    setViewUpdateTrigger(prev => prev + 1);
                }
            });

            resizeObserver.observe(chartElement);
        }

        return () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }

            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
            seriesRef.current = null;
        };
    }, [height, timeframe.color, isMobile, fixLeftEdge]);

    useEffect(() => {
        if (chartRef.current) {
            chartRef.current.applyOptions({
                timeScale: {
                    fixLeftEdge: fixLeftEdge,
                },
            });
        }
    }, [fixLeftEdge]);

    useEffect(() => {
        const initializeData = async () => {
            const historyModeChanged = prevHistoryModeRef.current !== showHistoricalPerformance;
            
            if (historyModeChanged) {
                if (!isTransitioningRef.current) {
                    console.log(`[${symbol}] History mode transition detected, marking as transitioning`);
                    isTransitioningRef.current = true;
                    prevHistoryModeRef.current = showHistoricalPerformance;
                    return;
                }
                console.log(`[${symbol}] Transition complete, proceeding with fetch`);
                isTransitioningRef.current = false;
            }
            
            console.log(`[${symbol}] ChartContainer: Fetching data with dataLimit:`, timeframe.dataLimit, 'interval:', timeframe.binanceInterval, 'history:', showHistoricalPerformance);
            const historicalData = await fetchKlineData(timeframe, symbol, 0);
            if (seriesRef.current && historicalData.length > 0) {
                console.log(`[${symbol}] ChartContainer: Loaded`, historicalData.length, 'candles for', timeframe.binanceInterval);
                seriesRef.current.setData(
                    historicalData.map(candle => ({
                        time: candle.time,
                        value: candle.open,
                    }))
                );
                setCurrentData(historicalData);
                setLastPrice(historicalData[historicalData.length - 1]);

                if (chartRef.current && historicalData.length > 1) {
                    const timeScale = chartRef.current.timeScale();
                    timeScale.fitContent();
                }

                const allPreds: PredictionEntry[] = [];
                SUPPORTED_PREDICTION_INTERVALS.forEach(interval => {
                    const intervalPredictions = getCurrentPredictions(interval, showHistoricalPerformance || false, symbol);
                    allPreds.push(...intervalPredictions);
                });
                console.log(`[${symbol}] Loaded ${allPreds.length} predictions in initializeData`);
                setPredictions(allPreds);

                setViewUpdateTrigger(prev => prev + 1);
            }
        };

        initializeData();

        const unsubscribeUpdates = subscribeToUpdates((data, key) => {
            const [dataSymbol, timeframeId] = key.split('-');
            
            if (timeframeId === timeframe.id && dataSymbol === symbol && seriesRef.current) {
                console.log(`[${symbol}] Received kline update for ${key} at ${new Date().toISOString()}`);
                
                const currentDataToUse = getCurrentData(timeframe.id, symbol);
                const latestData = currentDataToUse[currentDataToUse.length - 1];

                seriesRef.current.setData(
                    currentDataToUse.map(candle => ({
                        time: candle.time,
                        value: candle.open,
                    }))
                );
                setCurrentData(currentDataToUse);
                setLastPrice(latestData);

                const allPreds: PredictionEntry[] = [];
                SUPPORTED_PREDICTION_INTERVALS.forEach(interval => {
                    const intervalPredictions = getCurrentPredictions(interval, showHistoricalPerformance || false, symbol);
                    allPreds.push(...intervalPredictions);
                });
                console.log(`[${symbol}] Updated predictions after kline update: ${allPreds.length} predictions`);
                setPredictions(allPreds);

                setViewUpdateTrigger(prev => prev + 1);
            }
        });

        const unsubscribePredictions = subscribeToPredictionUpdates((newPredictions, updatedTimeframeId, ticker) => {
            if (SUPPORTED_PREDICTION_INTERVALS.includes(updatedTimeframeId) && ticker === symbol) {
                console.log(`[${symbol}] Received prediction update for ${updatedTimeframeId}: ${newPredictions.length} predictions`);
                setTimeout(() => {
                    const allPreds: PredictionEntry[] = [];
                    SUPPORTED_PREDICTION_INTERVALS.forEach(interval => {
                        const intervalPredictions = getCurrentPredictions(interval, showHistoricalPerformance || false, symbol);
                        allPreds.push(...intervalPredictions);
                    });
                    console.log(`[${symbol}] Updated predictions after prediction update: ${allPreds.length} predictions`);
                    setPredictions(allPreds);
                }, 100);
            }
        });

        const unsubscribeViewUpdates = subscribeToViewUpdates(() => {
            setViewUpdateTrigger(prev => prev + 1);
        });

        return () => {
            unsubscribeUpdates();
            unsubscribePredictions();
            unsubscribeViewUpdates();
        };
    }, [timeframe.binanceInterval, timeframe.dataLimit, symbol, showHistoricalPerformance, timeframe.id]);

    // FIXED: Add effect to reload predictions when showAllInsights changes
    useEffect(() => {
        console.log(`[${symbol}] showAllInsights changed to: ${showAllInsights}`);
        const allPreds: PredictionEntry[] = [];
        SUPPORTED_PREDICTION_INTERVALS.forEach(interval => {
            const intervalPredictions = getCurrentPredictions(interval, showHistoricalPerformance || false, symbol);
            allPreds.push(...intervalPredictions);
        });
        console.log(`[${symbol}] Reloaded predictions after showAllInsights change: ${allPreds.length} predictions`);
        setPredictions(allPreds);
    }, [symbol, timeframe.binanceInterval, showHistoricalPerformance, showAllInsights]);

    return (
        <div className="relative h-full bg-[#1a1a1a]">
            <div className="h-5 md:h-6 border-b border-[#2a2a2a] px-1 md:px-2 flex items-center justify-between text-[8px] md:text-[8px]">
                <div className="flex items-center flex-1">
                    {isEditingTimeframe ? (
                        <div className="flex flex-col">
                            <input
                                type="text"
                                value={timeframeInputValue}
                                onChange={handleTimeframeInputChange}
                                onBlur={handleTimeframeInputSubmit}
                                onKeyDown={handleTimeframeInputKeyDown}
                                className="bg-[#2a2a2a] text-white text-[8px] md:text-[10px] px-1 py-0.5 rounded border border-[#3a3a3a] focus:border-blue-500 focus:outline-none w-16 md:w-20"
                                autoFocus
                            />
                            {timeframeInputError && (
                                <span className="text-red-400 text-[6px] md:text-[8px] mt-0.5">{timeframeInputError}</span>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditingTimeframe(true)}
                            className="text-[#999] font-medium hover:text-white transition-colors text-[8px] md:text-[10px]"
                        >
                            {timeframe.label}
                        </button>
                    )}
                </div>
                {lastPrice && (
                    <div className="flex items-center space-x-1 md:space-x-2">
                        <span className="text-[#999] hidden sm:inline">O {lastPrice.open.toFixed(2)}</span>
                        <span className="text-[#999]">
                            <span className="inline-block w-[2px] h-[2px] bg-green-500 rounded-full align-middle mr-1"></span>
                            positive insight &nbsp;
                            <span className="inline-block w-[2px] h-[2px] bg-red-500 rounded-full align-middle mr-1"></span>
                            negative insight
                        </span>
                    </div>
                )}
            </div>
            <div className="relative h-[calc(100%-20px)] md:h-[calc(100%-24px)]">
                <div ref={chartContainerRef} className="absolute inset-0 p-0.5" />

                <div ref={overlayContainerRef} className="absolute inset-0 p-0.5 pointer-events-none">
                    {arrowPositions.map((position) => (
                        <PredictionArrow
                            key={`${position.datetime}-${position.ticker}-${position.timeframeId}`}
                            value={position.value}
                            position={position}
                            timeframeId={position.timeframeId}
                            ticker={position.ticker}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ChartContainer;