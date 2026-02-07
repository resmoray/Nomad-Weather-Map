import type { TripTypeId } from "../../types/presentation";
import type { MetricKey } from "../../types/weather";

export interface TripTypeConfig {
  id: TripTypeId;
  label: string;
  description: string;
  weights: Partial<Record<MetricKey, number>>;
  keyMetrics: MetricKey[];
}

export const TRIP_TYPES: Record<TripTypeId, TripTypeConfig> = {
  beachVacation: {
    id: "beachVacation",
    label: "Beach Vacation",
    description: "Prioritizes warm beach weather with manageable rain and wind.",
    weights: {
      temperatureC: 30,
      rainfallMm: 25,
      uvIndex: 15,
      windKph: 10,
      humidityPct: 10,
      aqi: 5,
      pm25: 5,
    },
    keyMetrics: ["temperatureC", "rainfallMm", "uvIndex", "windKph"],
  },
  cityTrip: {
    id: "cityTrip",
    label: "City Trip",
    description: "Prioritizes walkable comfort and cleaner air.",
    weights: {
      temperatureC: 30,
      rainfallMm: 25,
      humidityPct: 15,
      aqi: 15,
      pm25: 10,
      uvIndex: 5,
    },
    keyMetrics: ["temperatureC", "rainfallMm", "aqi", "pm25"],
  },
  surfVacation: {
    id: "surfVacation",
    label: "Surf Vacation",
    description: "Prioritizes wave quality first, then weather comfort.",
    weights: {
      waveHeightM: 30,
      wavePeriodS: 25,
      windKph: 15,
      rainfallMm: 10,
      temperatureC: 8,
      humidityPct: 4,
      uvIndex: 3,
      aqi: 3,
      pm25: 2,
    },
    keyMetrics: ["waveHeightM", "wavePeriodS", "windKph"],
  },
};

export function getTripTypeLabel(tripTypeId: TripTypeId): string {
  return TRIP_TYPES[tripTypeId].label;
}
