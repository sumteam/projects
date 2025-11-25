import { CandlestickData, PredictionEntry } from '../types';

export interface ParsedCSVRow {
  datetime: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  predictions: Record<string, number>;
}

export interface CSVParseResult {
  success: boolean;
  data?: ParsedCSVRow[];
  availableTimeframes?: string[];
  datetimeFormat?: string;
  startDate?: Date;
  endDate?: Date;
  error?: string;
  errorLine?: number;
}

const DATETIME_FORMATS = [
  { pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, format: 'YYYY-MM-DD HH:mm:ss', parser: parseYYYYMMDD, separator: '-' },
  { pattern: /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/, format: 'DD-MM-YYYY HH:mm:ss', parser: parseDDMMYYYY, separator: '-' },
  { pattern: /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/, format: 'MM-DD-YYYY HH:mm:ss', parser: parseMMDDYYYY, separator: '-' },
  { pattern: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/, format: 'DD/MM/YYYY HH:mm:ss', parser: parseDDMMYYYYSlash, separator: '/' },
  { pattern: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/, format: 'MM/DD/YYYY HH:mm:ss', parser: parseMMDDYYYYSlash, separator: '/' }
];

function parseYYYYMMDD(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));

  return isNaN(date.getTime()) ? null : date;
}

function parseDDMMYYYY(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hour, minute, second] = match;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));

  return isNaN(date.getTime()) ? null : date;
}

function parseMMDDYYYY(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, month, day, year, hour, minute, second] = match;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));

  return isNaN(date.getTime()) ? null : date;
}

function parseDDMMYYYYSlash(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, day, month, year, hour, minute, second] = match;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));

  return isNaN(date.getTime()) ? null : date;
}

function parseMMDDYYYYSlash(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, month, day, year, hour, minute, second] = match;
  const date = new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));

  return isNaN(date.getTime()) ? null : date;
}

function detectDatetimeFormat(dateStr: string): { format: string; parser: (str: string) => Date | null } | null {
  for (const fmt of DATETIME_FORMATS) {
    if (fmt.pattern.test(dateStr)) {
      const testDate = fmt.parser(dateStr);
      if (testDate) {
        return { format: fmt.format, parser: fmt.parser };
      }
    }
  }
  return null;
}

function disambiguateDDMMvsMMDD(rows: string[][], separator: string): { format: string; parser: (str: string) => Date | null } | null {
  const sepEscaped = separator === '/' ? '\\/' : separator;
  const pattern = new RegExp(`^(\\d{2})${sepEscaped}(\\d{2})${sepEscaped}(\\d{4}) \\d{2}:\\d{2}:\\d{2}$`);

  for (let i = 0; i < Math.min(rows.length, 50); i++) {
    const dateStr = rows[i][0];
    if (!dateStr) continue;

    const match = dateStr.match(pattern);
    if (!match) continue;

    const firstNum = parseInt(match[1]);
    const secondNum = parseInt(match[2]);

    if (firstNum > 12) {
      return separator === '/'
        ? { format: 'DD/MM/YYYY HH:mm:ss', parser: parseDDMMYYYYSlash }
        : { format: 'DD-MM-YYYY HH:mm:ss', parser: parseDDMMYYYY };
    }
    if (secondNum > 12) {
      return separator === '/'
        ? { format: 'MM/DD/YYYY HH:mm:ss', parser: parseMMDDYYYYSlash }
        : { format: 'MM-DD-YYYY HH:mm:ss', parser: parseMMDDYYYY };
    }
  }

  return separator === '/'
    ? { format: 'MM/DD/YYYY HH:mm:ss', parser: parseMMDDYYYYSlash }
    : { format: 'MM-DD-YYYY HH:mm:ss', parser: parseMMDDYYYY };
}

export async function parseCSVFile(file: File): Promise<CSVParseResult> {
  try {
    const text = await file.text();
    return parseCSVText(text);
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function parseCSVText(text: string): CSVParseResult {
  try {
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    if (lines.length < 2) {
      return {
        success: false,
        error: 'CSV file must contain at least a header row and one data row'
      };
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const requiredColumns = ['datetime', 'open', 'high', 'low', 'close'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
      return {
        success: false,
        error: `Missing required columns: ${missingColumns.join(', ')}`
      };
    }

    const datetimeIdx = headers.indexOf('datetime');
    const openIdx = headers.indexOf('open');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const closeIdx = headers.indexOf('close');

    const predictionColumns: { index: number; timeframe: string }[] = [];
    headers.forEach((header, idx) => {
      if (header.startsWith('trend_identified_')) {
        const timeframe = header.replace('trend_identified_', '');
        predictionColumns.push({ index: idx, timeframe });
      }
    });

    const availableTimeframes = predictionColumns.map(pc => pc.timeframe);

    const dataRows = lines.slice(1).map(line => line.split(',').map(v => v.trim()));

    if (dataRows.length === 0) {
      return {
        success: false,
        error: 'No data rows found in CSV file'
      };
    }

    const firstDateStr = dataRows[0][datetimeIdx];
    let datetimeInfo = detectDatetimeFormat(firstDateStr);

    if (!datetimeInfo) {
      return {
        success: false,
        error: `Invalid datetime format in first data row. Expected formats: YYYY-MM-DD HH:mm:ss, DD-MM-YYYY HH:mm:ss, MM-DD-YYYY HH:mm:ss, DD/MM/YYYY HH:mm:ss, or MM/DD/YYYY HH:mm:ss`,
        errorLine: 2
      };
    }

    if (firstDateStr.match(/^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}$/)) {
      const disambiguated = disambiguateDDMMvsMMDD(dataRows, '-');
      if (disambiguated) {
        datetimeInfo = disambiguated;
      }
    } else if (firstDateStr.match(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)) {
      const disambiguated = disambiguateDDMMvsMMDD(dataRows, '/');
      if (disambiguated) {
        datetimeInfo = disambiguated;
      }
    }

    const parsedData: ParsedCSVRow[] = [];
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const lineNumber = i + 2;

      if (row.length < requiredColumns.length) {
        return {
          success: false,
          error: `Insufficient columns in row ${lineNumber}`,
          errorLine: lineNumber
        };
      }

      const dateStr = row[datetimeIdx];
      const parsedDate = datetimeInfo.parser(dateStr);

      if (!parsedDate) {
        return {
          success: false,
          error: `Invalid datetime format in row ${lineNumber}: "${dateStr}"`,
          errorLine: lineNumber
        };
      }

      const open = parseFloat(row[openIdx]);
      const high = parseFloat(row[highIdx]);
      const low = parseFloat(row[lowIdx]);
      const close = parseFloat(row[closeIdx]);

      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        return {
          success: false,
          error: `Invalid numeric value in row ${lineNumber}`,
          errorLine: lineNumber
        };
      }

      const predictions: Record<string, number> = {};
      for (const predCol of predictionColumns) {
        const value = parseFloat(row[predCol.index]);
        if (!isNaN(value)) {
          predictions[predCol.timeframe] = value;
        }
      }

      parsedData.push({
        datetime: parsedDate,
        open,
        high,
        low,
        close,
        predictions
      });

      if (!minDate || parsedDate < minDate) minDate = parsedDate;
      if (!maxDate || parsedDate > maxDate) maxDate = parsedDate;
    }

    return {
      success: true,
      data: parsedData,
      availableTimeframes,
      datetimeFormat: datetimeInfo.format,
      startDate: minDate || undefined,
      endDate: maxDate || undefined
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export function convertToChartData(parsedData: ParsedCSVRow[]): CandlestickData[] {
  return parsedData.map(row => ({
    time: Math.floor(row.datetime.getTime() / 1000),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close
  }));
}

export function extractPredictions(parsedData: ParsedCSVRow[], fileId: string): Map<string, PredictionEntry[]> {
  const predictionMap = new Map<string, PredictionEntry[]>();

  for (const row of parsedData) {
    for (const [timeframe, value] of Object.entries(row.predictions)) {
      if (!predictionMap.has(timeframe)) {
        predictionMap.set(timeframe, []);
      }

      const datetime = formatDateTimeUTC(row.datetime);

      predictionMap.get(timeframe)!.push({
        datetime,
        value,
        timeframeId: timeframe,
        ticker: fileId
      });
    }
  }

  return predictionMap;
}

function formatDateTimeUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
