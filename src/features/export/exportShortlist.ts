import type { UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { downloadFile } from "../../utils/downloadFile";
import { buildTopPicks } from "../insights/buildTopPicks";

export function exportShortlist(
  records: RegionMonthRecord[],
  profile: UserPreferenceProfile,
  seasonByRegion: Record<string, SeasonSignalByMonth>,
): void {
  const picks = buildTopPicks({ records, profile, seasonByRegion, maxPicks: 3 });
  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      type: "shortlist",
      profile,
      picks,
    },
    null,
    2,
  );

  downloadFile(payload, "nomad-weather-shortlist.json", "application/json");
}
