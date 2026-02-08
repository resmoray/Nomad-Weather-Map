import type { MetricKey, Month } from "./weather";
import type { MarketConfidenceSource, SeasonConfidence, SeasonLabel, SeasonSource } from "./season";

export type MatrixMode = "timeline" | "monthCompare";

export type TempPreference = "cool" | "mild" | "warm" | "hot" | "noPreference";
export type HumidityPreference = "dry" | "balanced" | "humid" | "noPreference";
export type RainTolerance = "avoidRain" | "okayRain" | "rainFlexible" | "noPreference";
export type AirSensitivity = "sensitive" | "normal" | "tolerant" | "noPreference";
export type UvSensitivity = "sensitive" | "normal" | "tolerant" | "noPreference";

export interface DealbreakerSettings {
  avoidHeavyRain: boolean;
  avoidUnhealthyAir: boolean;
  avoidVeryHighUv: boolean;
  avoidStrongWind: boolean;
  coastalOnly: boolean;
}

export interface UserPreferenceProfile {
  tempPreference: TempPreference;
  humidityPreference: HumidityPreference;
  rainTolerance: RainTolerance;
  airSensitivity: AirSensitivity;
  uvSensitivity: UvSensitivity;
  surfEnabled: boolean;
  dealbreakers: DealbreakerSettings;
}

export type CellSeverity = "excellent" | "good" | "caution" | "bad" | "extreme" | "missing";
export type MatrixRowGroup = "seasons" | "comfort" | "air" | "surf";

export interface MetricAssessment {
  label: string;
  severity: CellSeverity;
  reason: string;
  icon: string;
}

export interface PersonalDriver {
  metric: MetricKey;
  direction: "positive" | "negative";
  contribution: number;
  reason: string;
}

export interface PersonalConfidenceDetails {
  level: "high" | "medium" | "low";
  coverage: number;
  missingMetrics: MetricKey[];
  reason: string;
}

export interface PersonalScore {
  score: number;
  band: "Poor" | "Fair" | "Good" | "Excellent";
  confidence: "high" | "medium" | "low";
  confidenceDetails: PersonalConfidenceDetails;
  drivers: PersonalDriver[];
  warnings: string[];
  profile: UserPreferenceProfile;
}

export interface MatrixColumnViewModel {
  key: string;
  title: string;
  subtitle: string;
  month: Month;
  regionId: string;
  personalScore: number;
}

export interface MatrixCellViewModel {
  key: string;
  label: string;
  valueText: string;
  severity: CellSeverity;
  icon: string;
  reason: string;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  confidenceText?: string;
  seasonLabel?: SeasonLabel;
  seasonConfidence?: SeasonConfidence;
  marketConfidenceSource?: MarketConfidenceSource;
  isPriceFallback?: boolean;
  isCrowdFallback?: boolean;
  seasonSources?: SeasonSource[];
  rowGroup?: MatrixRowGroup;
  regionId?: string;
  month?: Month;
  personalDrivers?: PersonalDriver[];
  personalWarnings?: string[];
  confidenceDetails?: PersonalConfidenceDetails;
  tooltipText?: string;
}

export interface MatrixRowViewModel {
  key: MetricKey | "marketSeason" | "climateSeason" | "personal";
  label: string;
  group: MatrixRowGroup;
  unitHint?: string;
  cells: MatrixCellViewModel[];
}

export interface MatrixViewModel {
  columns: MatrixColumnViewModel[];
  rows: MatrixRowViewModel[];
}
