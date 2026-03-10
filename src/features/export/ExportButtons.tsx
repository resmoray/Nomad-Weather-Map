import { useEffect, useMemo, useRef, useState } from "react";
import type { MatrixMode, MatrixViewModel, UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { Region, RegionMonthRecord } from "../../types/weather";
import { evaluateDealbreakers } from "../matrix/dealbreakers";
import { downloadCsvExport, downloadTableCsvExport } from "./exportCsv";
import { downloadJsonExport } from "./exportJson";
import { exportMonthlyPlan } from "./exportMonthlyPlan";
import { exportShortlist } from "./exportShortlist";

interface ExportButtonsProps {
  records: RegionMonthRecord[];
  regions: Region[];
  month: number;
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  profile: UserPreferenceProfile;
  loadRegionTimeline: (region: Region) => Promise<RegionMonthRecord[]>;
  matrixViewModel?: MatrixViewModel;
  matrixMode?: MatrixMode;
  matrixContextLabel?: string;
}

export function ExportButtons({
  records,
  regions,
  month,
  seasonByRegion,
  profile,
  loadRegionTimeline,
  matrixViewModel,
  matrixMode,
  matrixContextLabel,
}: ExportButtonsProps) {
  const [message, setMessage] = useState<string>("");
  const [isMonthlyPlanExporting, setIsMonthlyPlanExporting] = useState(false);
  const [csvDropdownOpen, setCsvDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!csvDropdownOpen) return;
    function handleOutsideClick(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCsvDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [csvDropdownOpen]);

  const eligibleRecords = useMemo(
    () => records.filter((record) => evaluateDealbreakers(record, profile).passed),
    [records, profile],
  );

  const disabled = eligibleRecords.length === 0;
  const excludedByDealbreakerCount = records.length - eligibleRecords.length;
  const monthlyPlanDisabled = regions.length === 0 || isMonthlyPlanExporting;
  const tableExportAvailable = !!matrixViewModel && matrixViewModel.columns.length > 0;

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

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown export error";
  }

  async function handleMonthlyPlanExport(): Promise<void> {
    if (monthlyPlanDisabled) return;
    setIsMonthlyPlanExporting(true);
    setMessage("Loading full 12-month weather timeline for selected regions...");
    try {
      const timelineResults = await Promise.allSettled(
        regions.map(async (region) => ({
          region,
          records: await loadRegionTimeline(region),
        })),
      );
      const failedRegionIds: string[] = [];
      const fullTimelineRecords: RegionMonthRecord[] = [];
      for (let index = 0; index < timelineResults.length; index += 1) {
        const result = timelineResults[index];
        if (result.status === "fulfilled") {
          fullTimelineRecords.push(...result.value.records);
          continue;
        }
        if (result.status === "rejected") {
          failedRegionIds.push(regions[index].id);
        }
      }
      const eligibleTimelineRecords = fullTimelineRecords.filter(
        (record) => evaluateDealbreakers(record, profile).passed,
      );
      const eligibleRegionIds = new Set(eligibleTimelineRecords.map((record) => record.region.id));
      const regionsWithAnyEligibleMonth = regions.filter((region) => eligibleRegionIds.has(region.id));
      if (eligibleTimelineRecords.length === 0 || regionsWithAnyEligibleMonth.length === 0) {
        setMessage("Monthly plan not exported: no eligible month remained after dealbreakers.");
        return;
      }
      exportMonthlyPlan({
        regions: regionsWithAnyEligibleMonth,
        monthRecords: [],
        timelineRecords: eligibleTimelineRecords,
        profile,
        seasonByRegion,
        selectedRegionCount: regions.length,
        failedRegionIds,
      });
      if (failedRegionIds.length > 0) {
        setMessage(`Monthly plan exported (${failedRegionIds.length} region load error(s), partial input).`);
        return;
      }
      setMessage("Monthly plan exported.");
    } catch (error) {
      setMessage(`Monthly plan export failed: ${errorMessage(error)}`);
    } finally {
      setIsMonthlyPlanExporting(false);
    }
  }

  function handleTableCsv(): void {
    if (!matrixViewModel || !matrixMode) return;
    downloadTableCsvExport(matrixViewModel, matrixMode, matrixContextLabel ?? String(month));
    setMessage("Table CSV exported.");
    setCsvDropdownOpen(false);
  }

  function handleRawDataCsv(): void {
    downloadCsvExport(eligibleRecords, month, profile, seasonByRegion);
    setMessage("Raw Data CSV exported.");
    setCsvDropdownOpen(false);
  }

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
          disabled={monthlyPlanDisabled}
          onClick={() => {
            void handleMonthlyPlanExport();
          }}
        >
          {isMonthlyPlanExporting ? "Exporting Monthly Plan..." : "Export Monthly Plan"}
        </button>

        {/* CSV dropdown */}
        <div className="export-dropdown" ref={dropdownRef}>
          <button
            type="button"
            disabled={disabled && !tableExportAvailable}
            onClick={() => setCsvDropdownOpen((prev) => !prev)}
          >
            Export CSV ▾
          </button>
          {csvDropdownOpen && (
            <div className="export-dropdown-menu">
              <button
                type="button"
                disabled={!tableExportAvailable}
                onClick={handleTableCsv}
              >
                Table CSV
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={handleRawDataCsv}
              >
                Raw Data CSV
              </button>
            </div>
          )}
        </div>

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
