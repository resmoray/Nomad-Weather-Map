import type { LLMExportRecord } from "../../types/export";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { downloadFile } from "../../utils/downloadFile";
import { toLLMExportRecord } from "./toLLMExportRecord";

export function buildJsonExport(
  records: RegionMonthRecord[],
  seasonByRegion: Record<string, SeasonSignalByMonth> = {},
): LLMExportRecord[] {
  return records.map((record) =>
    toLLMExportRecord(record, seasonByRegion[record.region.id]?.[record.month]),
  );
}

export function downloadJsonExport(
  records: RegionMonthRecord[],
  month: number,
  seasonByRegion: Record<string, SeasonSignalByMonth> = {},
): void {
  const payload = buildJsonExport(records, seasonByRegion);
  const fileName = `nomad-weather-month-${month}.json`;
  const json = JSON.stringify(payload, null, 2);

  downloadFile(json, fileName, "application/json");
}
