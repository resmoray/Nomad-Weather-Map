import type { MetricKey, Month } from "./weather";
import type { MarketConfidenceSource, SeasonConfidence, SeasonLabel, SeasonSource } from "./season";

export type MatrixMode = "timeline" | "monthCompare";

export type ComfortProfileId = "tropicalLover" | "warmTraveler" | "perfectTemp" | "coolLover";
export type TripTypeId = "beachVacation" | "cityTrip" | "surfVacation";

export type CellSeverity = "excellent" | "good" | "caution" | "bad" | "extreme" | "missing";

export interface MetricAssessment {
  label: string;
  severity: CellSeverity;
  reason: string;
  icon: string;
}

export interface PersonalScore {
  score: number;
  band: "Poor" | "Fair" | "Good" | "Excellent";
  comfortProfileId: ComfortProfileId;
  tripTypeId: TripTypeId;
  confidence: "high" | "medium" | "low";
}

export interface MatrixColumnViewModel {
  key: string;
  title: string;
  subtitle: string;
  month: Month;
  regionId: string;
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
}

export interface MatrixRowViewModel {
  key: MetricKey | "marketSeason" | "climateSeason" | "personal";
  label: string;
  cells: MatrixCellViewModel[];
}

export interface MatrixViewModel {
  columns: MatrixColumnViewModel[];
  rows: MatrixRowViewModel[];
}
