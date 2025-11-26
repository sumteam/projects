import React, { useEffect, useState, useCallback } from 'react';
import ChartContainer from '../Chart/ChartContainer';
import QuadView from './QuadView';
import CSVUpload from '../CSVUpload/CSVUpload';
import FileManager from '../CSVUpload/FileManager';
import { getInitialTimeframes, calculateDataLimit, convertIntervalToMinutes } from '../../api/binanceAPI';
import { setSixteenTimesMode, subscribeToPredictionUpdates, loadPredictionsForTicker } from '../../services/predictionService';
import { TimeframeConfig, PredictionEntry } from '../../types';
import { SUPPORTED_PREDICTION_INTERVALS } from '../../api/sumtymeAPI';
import { Info, X, BarChart3, Upload, FolderOpen, Grid3x3 as Grid3X3, File } from 'lucide-react';
import { getCSVMetadata, getAllLoadedFiles, loadCSVFile } from '../../services/csvService';

const Dashboard: React.FC = () => {
    const [currentFileId, setCurrentFileId] = useState<string>('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showFileManager, setShowFileManager] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showHistoricalPerformance, setShowHistoricalPerformance] = useState(false);
    const [showQuadView, setShowQuadView] = useState(false);
    const [showAllInsights, setShowAllInsights] = useState(false);
    const [loadedFileIds, setLoadedFileIds] = useState<string[]>([]);

    const [userSelectedTimeframes, setUserSelectedTimeframes] = useState<TimeframeConfig[]>(
        getInitialTimeframes('DEFAULT', showHistoricalPerformance)
    );
    const [allPredictionsData, setAllPredictionsData] = useState<Record<string, Record<string, PredictionEntry[]>>>({});
    const [quadViewFileIds, setQuadViewFileIds] = useState<string[]>([]);

    const handleQuadViewFilesChange = useCallback((fileIds: string[]) => {
        setQuadViewFileIds(fileIds);
    }, []);

    useEffect(() => {
        const updatedTimeframes = userSelectedTimeframes.map(tf => {
            const baseDataLimit = calculateDataLimit(tf.binanceInterval);

            return {
                ...tf,
                dataLimit: showHistoricalPerformance ? baseDataLimit * 4 : baseDataLimit
            };
        });
        setUserSelectedTimeframes(updatedTimeframes);
    }, [showHistoricalPerformance]);

    useEffect(() => {
        const unsubscribe = subscribeToPredictionUpdates((predictions, timeframeId, fileId) => {
            setAllPredictionsData(prev => ({
                ...prev,
                [fileId]: {
                    ...(prev[fileId] || {}),
                    [timeframeId]: predictions
                }
            }));
        });

        return unsubscribe;
    }, []);

    const getHighestFrequencyTimeframe = (): TimeframeConfig => {
        if (userSelectedTimeframes.length === 0) {
            return {
                id: '1m',
                label: '1 Minute',
                binanceInterval: '1m',
                wsEndpoint: 'csv@kline_1m',
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

    const handleTimeframeUpdate = (updatedTimeframe: TimeframeConfig) => {
        setUserSelectedTimeframes(prevTimeframes =>
            prevTimeframes.map(tf =>
                tf.id === updatedTimeframe.id ? updatedTimeframe : tf
            )
        );
    };

    const toggleHistoricalPerformance = () => {
        setShowHistoricalPerformance(prev => !prev);
    };

    const handleUploadComplete = async (fileId: string) => {
        const metadata = getCSVMetadata(fileId);
        if (!metadata) return;

        await loadCSVFile(fileId);
        loadPredictionsForTicker(fileId);

        if (!currentFileId) {
            setCurrentFileId(fileId);
        }

        setLoadedFileIds(prev => [...prev, fileId]);
    };

    const handleFileSelect = async (fileId: string) => {
        await loadCSVFile(fileId);
        loadPredictionsForTicker(fileId);
        setCurrentFileId(fileId);
        setShowFileManager(false);
    };

    const currentMetadata = currentFileId ? getCSVMetadata(currentFileId) : null;

    return (
        <div className="h-screen flex flex-col bg-[#1a1a1a]">
            <div className="flex items-center justify-between bg-[#1a1a1a] border-b border-[#2a2a2a] px-2 py-0.5 md:px-4 md:py-1">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        <Upload size={12} />
                        <span>Upload CSV</span>
                    </button>

                    <button
                        onClick={() => setShowFileManager(true)}
                        className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white transition-colors"
                    >
                        <FolderOpen size={12} />
                        <span>Files</span>
                    </button>

                    <button
                        onClick={() => setShowInfoModal(true)}
                        className="flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white transition-colors"
                    >
                        <Info size={12} />
                        <span>Info</span>
                    </button>


                    <button
                        onClick={() => setShowQuadView(prev => !prev)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${showQuadView
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <Grid3X3 size={12} />
                        <span>Quad View</span>
                    </button>

                    <button
                        onClick={() => setShowAllInsights(prev => !prev)}
                        className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium transition-colors ${showAllInsights
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-[#2a2a2a] text-[#999] hover:bg-[#3a3a3a] hover:text-white'
                            }`}
                    >
                        <span>All Insights</span>
                    </button>
                </div>

                <div className="flex items-center space-x-4">
                    {currentMetadata && (
                        <div className="flex items-center space-x-2 text-xs">
                            <File size={12} className="text-[#999]" />
                            <span className="text-white font-medium">{currentMetadata.filename}</span>
                            <span className="text-[#666]">·</span>
                            <span className="text-[#999]">{currentMetadata.rowCount.toLocaleString()} rows</span>
                        </div>
                    )}
                </div>
            </div>

            {showInfoModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
                            <h2 className="text-white text-lg font-semibold">CSV Visualization Tool</h2>
                            <button
                                onClick={() => setShowInfoModal(false)}
                                className="text-[#999] hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 text-[#ccc] leading-relaxed">
                            <p className="text-white font-medium">
                                This tool visualizes historical cryptocurrency data from CSV files with trend predictions.
                            </p>

                            <div className="pt-4 border-t border-[#2a2a2a]">
                                <h3 className="text-white font-medium mb-2">CSV Format Requirements</h3>
                                <ul className="list-disc list-inside space-y-1 text-sm">
                                    <li><strong>Required columns:</strong> datetime, open, high, low, close</li>
                                    <li><strong>Datetime formats:</strong> YYYY-MM-DD HH:mm:ss, DD-MM-YYYY HH:mm:ss, MM-DD-YYYY HH:mm:ss, DD/MM/YYYY HH:mm:ss, or MM/DD/YYYY HH:mm:ss</li>
                                    <li><strong>Optional prediction columns:</strong> chain_detected_{'{'}number{'}{'}unit{'}'} where unit is s (seconds), m (minutes), or h (hours)</li>
                                    <li><strong>Examples:</strong> chain_detected_30s, chain_detected_1m, chain_detected_5m, chain_detected_15m, chain_detected_1h</li>
                                    <li><strong>Prediction values:</strong> -1 (negative), 0 (neutral), or 1 (positive)</li>
                                </ul>
                            </div>

                            <div className="pt-4 border-t border-[#2a2a2a]">
                                <h3 className="text-white font-medium mb-2">How to Use</h3>
                                <ol className="list-decimal list-inside space-y-1 text-sm">
                                    <li>Click "Upload CSV" to select and upload your CSV file</li>
                                    <li>Use "Files" button to manage and switch between uploaded files</li>
                                    <li>Enable "Quad View" to compare multiple CSV files side-by-side</li>
                                    <li>Turn on "All Insights" to see all prediction points instead of just signal changes</li>
                                </ol>
                            </div>

                            <div className="pt-4 border-t border-[#2a2a2a]">
                                <h3 className="text-white font-medium mb-2">Visualization</h3>
                                <p className="text-sm">
                                    The chart displays the open price as a line. Green dots represent positive trend predictions,
                                    while red dots represent negative predictions. Predictions are plotted at the open price of
                                    the corresponding candle.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showUploadModal && (
                <CSVUpload
                    onUploadComplete={handleUploadComplete}
                    onClose={() => setShowUploadModal(false)}
                />
            )}

            {showFileManager && (
                <FileManager
                    onSelectFile={handleFileSelect}
                    selectedFileId={currentFileId}
                    onClose={() => setShowFileManager(false)}
                />
            )}

            <div className="flex-1 overflow-hidden">
                {showQuadView ? (
                    <QuadView
                        userSelectedTimeframes={userSelectedTimeframes}
                        showHistoricalPerformance={showHistoricalPerformance}
                        onTimeframeUpdate={handleTimeframeUpdate}
                        onFilesChange={handleQuadViewFilesChange}
                        showAllInsights={showAllInsights}
                        loadedFileIds={loadedFileIds}
                    />
                ) : currentFileId ? (
                    <div className="h-full bg-[#1a1a1a]">
                        <ChartContainer
                            timeframe={getHighestFrequencyTimeframe()}
                            height={window.innerHeight - 32}
                            symbol={currentFileId}
                            fixLeftEdge={true}
                            onTimeframeUpdate={handleTimeframeUpdate}
                            showHistoricalPerformance={showHistoricalPerformance}
                            allPredictions={allPredictionsData}
                            showAllInsights={showAllInsights}
                        />
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <Upload className="mx-auto mb-4 text-[#666]" size={64} />
                            <h2 className="text-white text-xl mb-2">No CSV File Loaded</h2>
                            <p className="text-[#999] mb-4">Upload a CSV file to begin visualization</p>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                                Upload CSV File
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
