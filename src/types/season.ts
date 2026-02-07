import type { Month } from "./weather";

export type SeasonLabel = "high" | "shoulder" | "off";

export type SeasonConfidence = "high" | "medium" | "low";
export type MarketConfidenceSource = "live" | "mixed" | "fallback" | "fixed";

export interface SeasonSource {
  name: string;
  url: string;
  lastUpdated: string;
}

export interface SeasonSignal {
  month: Month;
  seasonLabel: SeasonLabel;
  crowdIndex: number | null;
  priceIndex: number | null;
  weatherIndex: number;
  confidence: SeasonConfidence;
  marketConfidenceSource: MarketConfidenceSource;
  isPriceFallback: boolean;
  isCrowdFallback: boolean;
  sources: SeasonSource[];
  reasonText: string;
}

export type SeasonSignalByMonth = Partial<Record<Month, SeasonSignal>>;

export interface SeasonSummaryResponse {
  regionId: string;
  presetId: string;
  year: number;
  signals: SeasonSignal[];
}
