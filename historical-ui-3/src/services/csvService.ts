import { supabase } from '../lib/supabase';
import { parseCSVFile, convertToChartData, extractPredictions, ParsedCSVRow } from '../utils/csvParser';
import { CandlestickData, PredictionEntry } from '../types';

export interface CSVFileMetadata {
  id: string;
  filename: string;
  fileSize: number;
  rowCount: number;
  datetimeFormat: string;
  startDate: Date;
  endDate: Date;
  availableTimeframes: string[];
  uploadedAt: Date;
}

interface StoredCSVFile {
  id: string;
  filename: string;
  file_size: number;
  row_count: number;
  datetime_format: string;
  start_date: string;
  end_date: string;
  available_timeframes: string[];
  uploaded_at: string;
}

const csvDataCache = new Map<string, CandlestickData[]>();
const csvPredictionsCache = new Map<string, Map<string, PredictionEntry[]>>();
const csvMetadataCache = new Map<string, CSVFileMetadata>();

type CSVDataCallback = () => void;
const csvDataCallbacks: CSVDataCallback[] = [];

export async function uploadCSVFile(file: File): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    const parseResult = await parseCSVFile(file);

    if (!parseResult.success || !parseResult.data) {
      return {
        success: false,
        error: parseResult.error || 'Failed to parse CSV file'
      };
    }

    const { data: parsedData, availableTimeframes, datetimeFormat, startDate, endDate } = parseResult;

    const { data: fileRecord, error: fileError } = await supabase
      .from('csv_files')
      .insert({
        filename: file.name,
        file_size: file.size,
        row_count: parsedData.length,
        datetime_format: datetimeFormat!,
        start_date: startDate!.toISOString(),
        end_date: endDate!.toISOString(),
        available_timeframes: availableTimeframes || []
      })
      .select()
      .single();

    if (fileError || !fileRecord) {
      console.error('Error saving file metadata:', fileError);
      return {
        success: false,
        error: 'Failed to save file metadata to database'
      };
    }

    const fileId = fileRecord.id;

    const batchSize = 500;
    for (let i = 0; i < parsedData.length; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);
      const dataRows = batch.map(row => ({
        file_id: fileId,
        datetime: row.datetime.toISOString(),
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        predictions: row.predictions
      }));

      const { error: dataError } = await supabase
        .from('csv_data')
        .insert(dataRows);

      if (dataError) {
        console.error('Error saving CSV data batch:', dataError);
      }
    }

    const chartData = convertToChartData(parsedData);
    csvDataCache.set(fileId, chartData);

    const predictions = extractPredictions(parsedData, fileId);
    csvPredictionsCache.set(fileId, predictions);

    const metadata: CSVFileMetadata = {
      id: fileId,
      filename: file.name,
      fileSize: file.size,
      rowCount: parsedData.length,
      datetimeFormat: datetimeFormat!,
      startDate: startDate!,
      endDate: endDate!,
      availableTimeframes: availableTimeframes || [],
      uploadedAt: new Date()
    };
    csvMetadataCache.set(fileId, metadata);

    notifyCSVDataUpdates();

    return {
      success: true,
      fileId
    };

  } catch (error) {
    console.error('Error uploading CSV file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function loadCSVFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (csvDataCache.has(fileId) && csvPredictionsCache.has(fileId)) {
      return { success: true };
    }

    const { data: fileRecord, error: fileError } = await supabase
      .from('csv_files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !fileRecord) {
      return {
        success: false,
        error: 'File not found'
      };
    }

    const metadata: CSVFileMetadata = {
      id: fileRecord.id,
      filename: fileRecord.filename,
      fileSize: fileRecord.file_size,
      rowCount: fileRecord.row_count,
      datetimeFormat: fileRecord.datetime_format,
      startDate: new Date(fileRecord.start_date),
      endDate: new Date(fileRecord.end_date),
      availableTimeframes: fileRecord.available_timeframes || [],
      uploadedAt: new Date(fileRecord.uploaded_at)
    };
    csvMetadataCache.set(fileId, metadata);

    const allData: ParsedCSVRow[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: dataRows, error: dataError } = await supabase
        .from('csv_data')
        .select('*')
        .eq('file_id', fileId)
        .order('datetime', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (dataError) {
        console.error('Error loading CSV data:', dataError);
        return {
          success: false,
          error: 'Failed to load CSV data from database'
        };
      }

      if (!dataRows || dataRows.length === 0) {
        hasMore = false;
      } else {
        dataRows.forEach(row => {
          allData.push({
            datetime: new Date(row.datetime),
            open: parseFloat(row.open),
            high: parseFloat(row.high),
            low: parseFloat(row.low),
            close: parseFloat(row.close),
            predictions: row.predictions || {}
          });
        });

        if (dataRows.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }
    }

    const chartData = convertToChartData(allData);
    csvDataCache.set(fileId, chartData);

    const predictions = extractPredictions(allData, fileId);
    csvPredictionsCache.set(fileId, predictions);

    notifyCSVDataUpdates();

    return { success: true };

  } catch (error) {
    console.error('Error loading CSV file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function deleteCSVFile(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('csv_files')
      .delete()
      .eq('id', fileId);

    if (error) {
      return {
        success: false,
        error: 'Failed to delete file from database'
      };
    }

    csvDataCache.delete(fileId);
    csvPredictionsCache.delete(fileId);
    csvMetadataCache.delete(fileId);

    notifyCSVDataUpdates();

    return { success: true };

  } catch (error) {
    console.error('Error deleting CSV file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function listCSVFiles(): Promise<CSVFileMetadata[]> {
  try {
    const { data: files, error } = await supabase
      .from('csv_files')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error listing CSV files:', error);
      return [];
    }

    return (files || []).map((file: StoredCSVFile) => ({
      id: file.id,
      filename: file.filename,
      fileSize: file.file_size,
      rowCount: file.row_count,
      datetimeFormat: file.datetime_format,
      startDate: new Date(file.start_date),
      endDate: new Date(file.end_date),
      availableTimeframes: file.available_timeframes || [],
      uploadedAt: new Date(file.uploaded_at)
    }));

  } catch (error) {
    console.error('Error listing CSV files:', error);
    return [];
  }
}

export function getCSVData(fileId: string): CandlestickData[] {
  return csvDataCache.get(fileId) || [];
}

export function getCSVPredictions(fileId: string, timeframe?: string): PredictionEntry[] {
  const filePredictions = csvPredictionsCache.get(fileId);
  if (!filePredictions) return [];

  if (timeframe) {
    return filePredictions.get(timeframe) || [];
  }

  const allPredictions: PredictionEntry[] = [];
  filePredictions.forEach(predictions => {
    allPredictions.push(...predictions);
  });
  return allPredictions;
}

export function getCSVMetadata(fileId: string): CSVFileMetadata | undefined {
  return csvMetadataCache.get(fileId);
}

export function getAllLoadedFiles(): CSVFileMetadata[] {
  return Array.from(csvMetadataCache.values());
}

export function subscribeToCSVDataUpdates(callback: CSVDataCallback): () => void {
  csvDataCallbacks.push(callback);

  return () => {
    const index = csvDataCallbacks.indexOf(callback);
    if (index !== -1) {
      csvDataCallbacks.splice(index, 1);
    }
  };
}

function notifyCSVDataUpdates(): void {
  csvDataCallbacks.forEach(callback => callback());
}

export async function saveAnalysisSession(
  name: string,
  fileIds: string[],
  viewConfig: any,
  description?: string
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('analysis_sessions')
      .insert({
        name,
        description: description || null,
        file_ids: fileIds,
        view_config: viewConfig
      })
      .select()
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Failed to save analysis session'
      };
    }

    return {
      success: true,
      sessionId: data.id
    };

  } catch (error) {
    console.error('Error saving analysis session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function loadAnalysisSession(sessionId: string): Promise<{
  success: boolean;
  session?: any;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: 'Session not found'
      };
    }

    return {
      success: true,
      session: data
    };

  } catch (error) {
    console.error('Error loading analysis session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export function clearAllCSVData(): void {
  csvDataCache.clear();
  csvPredictionsCache.clear();
  csvMetadataCache.clear();
  notifyCSVDataUpdates();
}
