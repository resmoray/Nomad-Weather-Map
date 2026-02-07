import { useMemo, useState } from "react";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { downloadCsvExport } from "./exportCsv";
import { downloadJsonExport } from "./exportJson";

interface ExportButtonsProps {
  records: RegionMonthRecord[];
  month: number;
  seasonByRegion: Record<string, SeasonSignalByMonth>;
}

export function ExportButtons({ records, month, seasonByRegion }: ExportButtonsProps) {
  const [message, setMessage] = useState<string>("");
  const disabled = records.length === 0;

  const recordCountLabel = useMemo(() => {
    if (records.length === 0) {
      return "No rows to export";
    }

    return `${records.length} row${records.length > 1 ? "s" : ""} ready`;
  }, [records.length]);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Export</h2>
        <p>Download selected results as CSV or JSON for route planning.</p>
      </header>

      <div className="export-row">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            downloadCsvExport(records, month, seasonByRegion);
            setMessage("CSV exported.");
          }}
        >
          Export CSV
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            downloadJsonExport(records, month, seasonByRegion);
            setMessage("JSON exported.");
          }}
        >
          Export JSON
        </button>
      </div>

      <p className="hint-text">{recordCountLabel}</p>
      {message ? <p className="hint-text">{message}</p> : null}
    </section>
  );
}
