import type { UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { Region, RegionMonthRecord } from "../../types/weather";
import { MONTHS } from "../../types/weather";
import { downloadFile } from "../../utils/downloadFile";
import { calculatePersonalScore } from "../matrix/presets";

interface MonthlyPlanEntry {
  month: number;
  regionId: string;
  cityName: string;
  countryCode: string;
  personalScore: number;
  personalBand: string;
}

function bestRecordByMonth(
  month: number,
  regions: Region[],
  recordsByKey: Map<string, RegionMonthRecord>,
  profile: UserPreferenceProfile,
): MonthlyPlanEntry | null {
  const candidates = regions
    .map((region) => recordsByKey.get(`${region.id}-${month}`))
    .filter((record): record is RegionMonthRecord => Boolean(record));

  if (candidates.length === 0) {
    return null;
  }

  const ranked = candidates
    .map((record) => ({ record, personal: calculatePersonalScore(record, profile) }))
    .sort((left, right) => right.personal.score - left.personal.score);
  const top = ranked[0];

  return {
    month,
    regionId: top.record.region.id,
    cityName: top.record.region.cityName,
    countryCode: top.record.region.countryCode,
    personalScore: top.personal.score,
    personalBand: top.personal.band,
  };
}

export function exportMonthlyPlan(input: {
  regions: Region[];
  monthRecords: RegionMonthRecord[];
  timelineRecords: RegionMonthRecord[];
  profile: UserPreferenceProfile;
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  selectedRegionCount?: number;
  failedRegionIds?: string[];
}): void {
  const recordsByKey = new Map<string, RegionMonthRecord>();
  for (const record of [...input.monthRecords, ...input.timelineRecords]) {
    recordsByKey.set(`${record.region.id}-${record.month}`, record);
  }

  const plan: MonthlyPlanEntry[] = MONTHS.map((month) =>
    bestRecordByMonth(month, input.regions, recordsByKey, input.profile),
  ).filter((entry): entry is MonthlyPlanEntry => Boolean(entry));
  const coveredMonths = new Set(plan.map((entry) => entry.month));
  const usedRegionIds = new Set(plan.map((entry) => entry.regionId));
  const missingMonths = MONTHS.filter((month) => !coveredMonths.has(month));

  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      type: "monthly-plan",
      profile: input.profile,
      entries: plan,
      seasonByRegion: input.seasonByRegion,
      coverage: {
        selectedRegionCount: input.selectedRegionCount ?? input.regions.length,
        includedRegionCount: input.regions.length,
        usedRegionCount: usedRegionIds.size,
        missingMonths,
        failedRegionIds: input.failedRegionIds ?? [],
      },
    },
    null,
    2,
  );

  downloadFile(payload, "nomad-weather-monthly-plan.json", "application/json");
}
