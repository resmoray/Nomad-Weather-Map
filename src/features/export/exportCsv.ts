import Papa from "papaparse";
import type { UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { downloadFile } from "../../utils/downloadFile";
import { toLLMExportRecord } from "./toLLMExportRecord";

export function downloadCsvExport(
  records: RegionMonthRecord[],
  month: number,
  profile: UserPreferenceProfile,
  seasonByRegion: Record<string, SeasonSignalByMonth> = {},
): void {
  const rows = records.map((record) =>
    toLLMExportRecord(record, profile, seasonByRegion[record.region.id]?.[record.month]),
  );
  const csv = Papa.unparse(rows);
  const fileName = `nomad-weather-month-${month}.csv`;

  downloadFile(csv, fileName, "text/csv;charset=utf-8;");
}
