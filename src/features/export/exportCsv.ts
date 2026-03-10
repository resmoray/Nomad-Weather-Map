import Papa from "papaparse";
import type { MatrixMode, MatrixViewModel, UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { downloadFile } from "../../utils/downloadFile";
import { toLLMExportRecord } from "./toLLMExportRecord";
import { toTableExportMatrix } from "./toTableExportMatrix";

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

export function downloadTableCsvExport(
  viewModel: MatrixViewModel,
  mode: MatrixMode,
  contextLabel: string,
): void {
  const matrix = toTableExportMatrix(viewModel);
  const csv = Papa.unparse(matrix, { header: false });
  const slug = contextLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const prefix = mode === "timeline" ? "nomad-timeline" : "nomad-table";
  const fileName = `${prefix}-${slug}.csv`;
  downloadFile(csv, fileName, "text/csv;charset=utf-8;");
}
