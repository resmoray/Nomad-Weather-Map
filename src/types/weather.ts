export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export type Month = (typeof MONTHS)[number];

export type CountryCode =
  | "AE"
  | "AR"
  | "AT"
  | "AU"
  | "BN"
  | "BR"
  | "CA"
  | "CL"
  | "CN"
  | "CO"
  | "DE"
  | "EG"
  | "ES"
  | "FR"
  | "FI"
  | "GB"
  | "GR"
  | "IS"
  | "IN"
  | "IT"
  | "KH"
  | "ID"
  | "JP"
  | "KE"
  | "KR"
  | "LK"
  | "LA"
  | "MA"
  | "MX"
  | "MY"
  | "MM"
  | "NZ"
  | "NO"
  | "PE"
  | "PH"
  | "PT"
  | "SA"
  | "SG"
  | "TH"
  | "TL"
  | "TR"
  | "TW"
  | "US"
  | "VN"
  | "ZA";

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
