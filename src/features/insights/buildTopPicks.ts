import type { UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { evaluateDealbreakers } from "../matrix/dealbreakers";
import { calculatePersonalScore } from "../matrix/presets";

export interface TopPick {
  regionId: string;
  displayName: string;
  score: number;
  band: "Poor" | "Fair" | "Good" | "Excellent";
  confidence: "high" | "medium" | "low";
  reasons: string[];
  warnings: string[];
}

function pickReasons(
  drivers: Array<{ direction: "positive" | "negative"; reason: string }>,
  fallbackReason: string,
): string[] {
  const positives = drivers.filter((driver) => driver.direction === "positive").slice(0, 2);
  if (positives.length > 0) {
    return positives.map((driver) => driver.reason);
  }

  return [fallbackReason];
}

export function buildTopPicks(input: {
  records: RegionMonthRecord[];
  profile: UserPreferenceProfile;
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  maxPicks?: number;
}): TopPick[] {
  const maxPicks = input.maxPicks ?? 3;

  const picks = input.records
    .filter((record) => evaluateDealbreakers(record, input.profile).passed)
    .map((record) => {
      const personal = calculatePersonalScore(record, input.profile);
      const seasonSignal = input.seasonByRegion[record.region.id]?.[record.month];

      const displayName = `${record.region.cityName}, ${record.region.countryName}`;
      const reasons = pickReasons(
        personal.drivers,
        seasonSignal?.reasonText ?? "Balanced score across selected metrics.",
      );

      return {
        regionId: record.region.id,
        displayName,
        score: personal.score,
        band: personal.band,
        confidence: personal.confidence,
        reasons,
        warnings: personal.warnings,
      } satisfies TopPick;
    })
    .sort((left, right) => right.score - left.score);

  return picks.slice(0, maxPicks);
}
