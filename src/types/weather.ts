export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type Month = (typeof MONTHS)[number];

export type CountryCode =
  | "AT"
  | "AU"
  | "BN"
  | "CN"
  | "ES"
  | "KH"
  | "ID"
  | "JP"
  | "KR"
  | "LK"
  | "LA"
  | "MA"
  | "MY"
  | "MM"
  | "NZ"
  | "PH"
  | "SG"
  | "TH"
  | "TL"
  | "TW"
  | "VN";

export interface Region {
  id: string;
  countryCode: CountryCode;
  countryName: string;
  regionName: string;
  cityName: string;
  lat: number;
  lon: number;
  cityIata: string;
  destinationIata: string;
  isCoastal: boolean;
}

export type MetricStatus = "ok" | "missing" | "error";

export type MetricKey =
  | "temperatureC"
  | "rainfallMm"
  | "humidityPct"
  | "windKph"
  | "uvIndex"
  | "pm25"
  | "aqi"
  | "waveHeightM"
  | "wavePeriodS"
  | "waveDirectionDeg"
  | "floodRisk"
  | "stormRisk";

export interface MetricValue {
  value: number | null;
  unit: string;
  status: MetricStatus;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
}

export type MonthlyMetrics = Record<MetricKey, MetricValue>;

export type SuitabilityBand = "Poor" | "Fair" | "Good" | "Excellent";

export interface SuitabilityBreakdown {
  metric: MetricKey;
  weight: number;
  normalizedScore: number | null;
  weightedContribution: number;
  status: MetricStatus;
}

export interface SuitabilityScore {
  score: number;
  band: SuitabilityBand;
  confidence: number;
  breakdown: SuitabilityBreakdown[];
}

export interface TemperatureProfile {
  minC: number | null;
  avgC: number | null;
  maxC: number | null;
}

export interface RegionMonthRecord {
  region: Region;
  month: Month;
  metrics: MonthlyMetrics;
  suitability: SuitabilityScore;
  temperatureProfile?: TemperatureProfile;
}

export interface SourceInfo {
  sourceName: string;
  sourceUrl: string;
  notes: string;
}

export type SourceCatalog = Record<MetricKey, SourceInfo>;
