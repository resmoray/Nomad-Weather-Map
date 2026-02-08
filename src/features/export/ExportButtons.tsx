import { useMemo, useState } from "react";
import type { UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { Region, RegionMonthRecord } from "../../types/weather";
import { evaluateDealbreakers } from "../matrix/dealbreakers";
import { downloadCsvExport } from "./exportCsv";
import { downloadJsonExport } from "./exportJson";
import { exportMonthlyPlan } from "./exportMonthlyPlan";
import { exportShortlist } from "./exportShortlist";

interface ExportButtonsProps {
  records: RegionMonthRecord[];
  timelineRecords: RegionMonthRecord[];
  regions: Region[];
  month: number;
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  profile: UserPreferenceProfile;
}

export function ExportButtons({
  records,
  timelineRecords,
  regions,
  month,
  seasonByRegion,
  profile,
}: ExportButtonsProps) {
  const [message, setMessage] = useState<string>("");

  const eligibleRecords = useMemo(
    () => records.filter((record) => evaluateDealbreakers(record, profile).passed),
    [records, profile],
  );
  const eligibleTimelineRecords = useMemo(
    () => timelineRecords.filter((record) => evaluateDealbreakers(record, profile).passed),
    [timelineRecords, profile],
  );
  const eligibleRegionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const record of [...eligibleRecords, ...eligibleTimelineRecords]) {
      ids.add(record.region.id);
    }
    return ids;
  }, [eligibleRecords, eligibleTimelineRecords]);
  const eligibleRegions = useMemo(
    () => regions.filter((region) => eligibleRegionIds.has(region.id)),
    [regions, eligibleRegionIds],
  );

  const disabled = eligibleRecords.length === 0;
  const excludedByDealbreakerCount = records.length - eligibleRecords.length;

  const recordCountLabel = useMemo(() => {
    if (eligibleRecords.length === 0) {
      return "No rows to export";
    }

    const base = `${eligibleRecords.length} row${eligibleRecords.length > 1 ? "s" : ""} ready`;
    if (excludedByDealbreakerCount <= 0) {
      return base;
    }

    return `${base} (${excludedByDealbreakerCount} excluded by dealbreakers)`;
  }, [eligibleRecords.length, excludedByDealbreakerCount]);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Export</h2>
        <p>Download shortlist, monthly plan, CSV or JSON for route planning.</p>
      </header>

      <div className="export-row">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            exportShortlist(eligibleRecords, profile, seasonByRegion);
            setMessage("Shortlist exported.");
          }}
        >
          Export Shortlist
        </button>

        <button
          type="button"
          disabled={eligibleRegions.length === 0}
          onClick={() => {
            exportMonthlyPlan({
              regions: eligibleRegions,
              monthRecords: eligibleRecords,
              timelineRecords: eligibleTimelineRecords,
              profile,
              seasonByRegion,
            });
            setMessage("Monthly plan exported.");
          }}
        >
          Export Monthly Plan
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            downloadCsvExport(eligibleRecords, month, profile, seasonByRegion);
            setMessage("CSV exported.");
          }}
        >
          Export CSV
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            downloadJsonExport(eligibleRecords, month, profile, seasonByRegion);
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
