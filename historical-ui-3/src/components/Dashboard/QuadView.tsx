import React, { useState, useEffect } from 'react';
import ChartContainer from '../Chart/ChartContainer';
import { getInitialTimeframes, convertIntervalToMinutes, calculateDataLimit } from '../../api/binanceAPI';
import { subscribeToPredictionUpdates, loadPredictionsFromCSV } from '../../services/predictionService';
import { TimeframeConfig, PredictionEntry } from '../../types';
import { File } from 'lucide-react';
import { getAllLoadedFiles, getCSVMetadata } from '../../services/csvService';

interface QuadViewProps {
    userSelectedTimeframes: TimeframeConfig[];
    showHistoricalPerformance: boolean;
    onTimeframeUpdate: (updatedTimeframe: TimeframeConfig) => void;
    onFilesChange: (fileIds: string[]) => void;
    showAllInsights: boolean;
    loadedFileIds: string[];
}

interface ChartState {
    fileId: string;
    fileName: string;
    predictions: Record<string, PredictionEntry[]>;
}

const QuadView: React.FC<QuadViewProps> = ({
    userSelectedTimeframes,
    showHistoricalPerformance,
    onTimeframeUpdate,
    onFilesChange,
    showAllInsights,
    loadedFileIds
}) => {
    const [charts, setCharts] = useState<ChartState[]>([
        { fileId: '', fileName: 'No file', predictions: {} },
        { fileId: '', fileName: 'No file', predictions: {} },
        { fileId: '', fileName: 'No file', predictions: {} },
        { fileId: '', fileName: 'No file', predictions: {} }
    ]);

    const [showFileSelector, setShowFileSelector] = useState<number | null>(null);

    useEffect(() => {
        if (loadedFileIds.length > 0) {
            setCharts(prevCharts => {
                return prevCharts.map((chart, index) => {
                    if (!chart.fileId && loadedFileIds[index]) {
                        const metadata = getCSVMetadata(loadedFileIds[index]);
                        return {
                            fileId: loadedFileIds[index],
                            fileName: metadata?.filename || 'Unknown',
                            predictions: {}
                        };
                    }
                    return chart;
                });
            });
        }
    }, [loadedFileIds]);

    useEffect(() => {
        const currentFileIds = charts.map(chart => chart.fileId).filter(id => id);
        onFilesChange(currentFileIds);
    }, [charts, onFilesChange]);

    const getHighestFrequencyTimeframe = (): TimeframeConfig => {
        if (userSelectedTimeframes.length === 0) {
            return {
                id: '1m',
                label: '1 Minute',
                binanceInterval: '1m',
                wsEndpoint: 'file@kline_1m',
                color: '#919191',
                dataLimit: calculateDataLimit('1m'),
            };
        }

        return userSelectedTimeframes.reduce((highest, current) => {
            const currentMinutes = convertIntervalToMinutes(current.binanceInterval);
            const highestMinutes = convertIntervalToMinutes(highest.binanceInterval);
            return currentMinutes < highestMinutes ? current : highest;
        });
    };

    useEffect(() => {
        const unsubscribe = subscribeToPredictionUpdates((predictions, timeframeId, fileId) => {
            setCharts(prevCharts =>
                prevCharts.map(chart =>
                    chart.fileId === fileId
                        ? {
                            ...chart,
                            predictions: {
                                ...chart.predictions,
                                [timeframeId]: predictions
                            }
                        }
                        : chart
                )
            );
        });

        return unsubscribe;
    }, []);

    const handleFileSelect = (chartIndex: number, fileId: string) => {
        const metadata = getCSVMetadata(fileId);
        if (!metadata) return;

        loadPredictionsFromCSV(fileId, metadata.availableTimeframes);

        setCharts(prevCharts => {
            const newCharts = [...prevCharts];
            newCharts[chartIndex] = {
                fileId,
                fileName: metadata.filename,
                predictions: {}
            };
            return newCharts;
        });

        setShowFileSelector(null);
    };

    const allPredictionsForChart = (chartIndex: number): Record<string, PredictionEntry[]> => {
        return charts[chartIndex]?.predictions || {};
    };

    const renderFileSelector = (chartIndex: number) => {
        const loadedFiles = getAllLoadedFiles();

        return (
            <div className="absolute inset-0 bg-black bg-opacity-75 z-10 flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg max-w-md w-full max-h-96 overflow-y-auto">
                    <div className="p-4 border-b border-[#2a2a2a]">
                        <h3 className="text-white font-medium">Select CSV File</h3>
                    </div>
                    <div className="p-2">
                        {loadedFiles.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-[#999] text-sm">No CSV files loaded</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {loadedFiles.map(file => (
                                    <button
                                        key={file.id}
                                        onClick={() => handleFileSelect(chartIndex, file.id)}
                                        className="w-full p-3 text-left rounded hover:bg-[#2a2a2a] transition-colors"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <File size={16} className="text-[#999]" />
                                            <span className="text-white text-sm">{file.filename}</span>
                                        </div>
                                        <div className="text-[#666] text-xs mt-1">
                                            {file.rowCount.toLocaleString()} rows · {file.availableTimeframes.join(', ')}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-2 border-t border-[#2a2a2a]">
                        <button
                            onClick={() => setShowFileSelector(null)}
                            className="w-full p-2 text-[#999] hover:text-white text-sm rounded hover:bg-[#2a2a2a] transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full grid grid-cols-2 grid-rows-2 gap-px bg-[#2a2a2a]">
            {charts.map((chart, index) => (
                <div key={index} className="relative bg-[#1a1a1a]">
                    {chart.fileId ? (
                        <>
                            <div className="absolute top-2 left-2 z-10 bg-[#2a2a2a] bg-opacity-90 px-2 py-1 rounded text-xs text-white flex items-center space-x-2">
                                <File size={12} className="text-[#999]" />
                                <span>{chart.fileName}</span>
                                <button
                                    onClick={() => setShowFileSelector(index)}
                                    className="text-[#999] hover:text-white ml-2"
                                >
                                    Change
                                </button>
                            </div>
                            <ChartContainer
                                timeframe={getHighestFrequencyTimeframe()}
                                height={window.innerHeight / 2}
                                symbol={chart.fileId}
                                fixLeftEdge={false}
                                onTimeframeUpdate={onTimeframeUpdate}
                                showHistoricalPerformance={showHistoricalPerformance}
                                allPredictions={allPredictionsForChart(index)}
                                showAllInsights={showAllInsights}
                            />
                        </>
                    ) : (
                        <div className="h-full flex items-center justify-center">
                            <button
                                onClick={() => setShowFileSelector(index)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                            >
                                Select CSV File
                            </button>
                        </div>
                    )}
                    {showFileSelector === index && renderFileSelector(index)}
                </div>
            ))}
        </div>
    );
};

export default QuadView;
