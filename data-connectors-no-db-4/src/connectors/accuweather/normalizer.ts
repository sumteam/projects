import { NormalizedTick } from '../../types/index.js';

interface AccuWeatherCurrentConditions {
  LocalObservationDateTime: string;
  EpochTime?: number;
  Temperature: {
    Metric: {
      Value: number;
      Unit?: string;
    };
  };
  RelativeHumidity?: number;
  Wind?: {
    Speed: {
      Metric: {
        Value: number;
      };
    };
  };
}

export class AccuWeatherNormalizer {
  static normalize(
    raw: AccuWeatherCurrentConditions,
    locationKey: string
  ): NormalizedTick | null {
    if (!raw.Temperature?.Metric?.Value) {
      console.warn('[AccuWeatherNormalizer] Invalid weather data:', raw);
      return null;
    }

    let timestamp: string;

    if (raw.LocalObservationDateTime) {
      timestamp = new Date(raw.LocalObservationDateTime).toISOString();
    } else if (raw.EpochTime) {
      timestamp = new Date(raw.EpochTime * 1000).toISOString();
    } else {
      timestamp = new Date().toISOString();
    }

    return {
      ts: timestamp,
      price: raw.Temperature.Metric.Value,
      symbol: locationKey,
      exchange: 'accuweather',
      size: raw.RelativeHumidity,
    };
  }

  static normalizeBatch(
    dataArray: AccuWeatherCurrentConditions[],
    locationKey: string
  ): NormalizedTick[] {
    if (!Array.isArray(dataArray)) {
      return [];
    }

    return dataArray
      .map(data => this.normalize(data, locationKey))
      .filter((tick): tick is NormalizedTick => tick !== null);
  }
}
