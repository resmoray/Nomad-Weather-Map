# Table CSV Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Table CSV" export that downloads exactly what is shown in the ClimateMatrix — rows = metrics, columns = cities or months — and wrap both exports (Table CSV + existing Raw Data CSV) in a dropdown button.

**Architecture:** Pure data transformation — `MatrixViewModel` (already computed and displayed) is converted to a 2D array and passed to `Papa.unparse()`. No new API calls. The existing `ExportButtons.tsx` CSV button becomes a split-dropdown with two options.

**Tech Stack:** React 19, TypeScript strict, PapaParse, existing `downloadFile` utility.

---

### Task 1: Create `toTableExportMatrix.ts` — transform MatrixViewModel to 2D array

**Files:**
- Create: `src/features/export/toTableExportMatrix.ts`
- Create: `src/features/export/toTableExportMatrix.test.ts`

**Step 1: Write the failing test**

```typescript
// src/features/export/toTableExportMatrix.test.ts
import { describe, expect, it } from "vitest";
import type { MatrixViewModel } from "../../types/presentation";
import { toTableExportMatrix } from "./toTableExportMatrix";

const mockViewModel: MatrixViewModel = {
  columns: [
    { key: "col1", title: "Da Nang", subtitle: "VN · Central · Mar", month: 3, regionId: "vn-da-nang", personalScore: 84 },
    { key: "col2", title: "Chiang Mai", subtitle: "TH · North · Mar", month: 3, regionId: "th-chiang-mai", personalScore: 71 },
  ],
  rows: [
    {
      key: "personal",
      label: "Personal Score",
      group: "seasons",
      cells: [
        { key: "c1", label: "Excellent", valueText: "", severity: "excellent", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "", confidenceText: "high confidence" },
        { key: "c2", label: "Good", valueText: "", severity: "good", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
      ],
    },
    {
      key: "temperatureC",
      label: "Temp (°C)",
      group: "comfort",
      cells: [
        { key: "c3", label: "Comfortable", valueText: "22 / 27 / 33", severity: "excellent", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
        { key: "c4", label: "Warm", valueText: "20 / 29 / 36", severity: "good", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
      ],
    },
  ],
};

describe("toTableExportMatrix", () => {
  it("returns header row + one row per metric", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix).toHaveLength(3); // 1 header + 2 rows
  });

  it("header row starts with 'Metric' then column titles with subtitles", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[0]).toEqual(["Metric", "Da Nang · VN · Central · Mar", "Chiang Mai · TH · North · Mar"]);
  });

  it("metric row starts with row label", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[1][0]).toBe("Personal Score");
    expect(matrix[2][0]).toBe("Temp (°C)");
  });

  it("formats cell as 'label · valueText' when valueText is present", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[2][1]).toBe("Comfortable · 22 / 27 / 33");
  });

  it("formats cell as just label when no valueText", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[1][1]).toBe("Excellent");
  });

  it("returns — for missing severity", () => {
    const vm: MatrixViewModel = {
      ...mockViewModel,
      rows: [
        {
          key: "temperatureC",
          label: "Temp (°C)",
          group: "comfort",
          cells: [
            { key: "c1", label: "—", valueText: "", severity: "missing", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
            { key: "c2", label: "Warm", valueText: "25", severity: "good", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
          ],
        },
      ],
    };
    const matrix = toTableExportMatrix(vm);
    expect(matrix[1][1]).toBe("—");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd "/Users/amg/02_dev/01_Apps/Nomad Weather Map"
npm run test:run -- src/features/export/toTableExportMatrix.test.ts
```

Expected: FAIL — "Cannot find module './toTableExportMatrix'"

**Step 3: Write the implementation**

```typescript
// src/features/export/toTableExportMatrix.ts
import type { MatrixViewModel } from "../../types/presentation";

/**
 * Converts a MatrixViewModel into a 2D array suitable for Papa.unparse().
 * Row 0 = header (Metric, col1-title, col2-title, ...)
 * Rows 1..N = one row per metric
 * Cells = "label · valueText" or "label" or "—" for missing
 */
export function toTableExportMatrix(viewModel: MatrixViewModel): string[][] {
  const { columns, rows } = viewModel;

  const header: string[] = [
    "Metric",
    ...columns.map((col) => `${col.title} · ${col.subtitle}`),
  ];

  const dataRows: string[][] = rows.map((row) => {
    const cells = columns.map((col, colIndex) => {
      const cell = row.cells[colIndex];
      if (!cell || cell.severity === "missing") {
        return "—";
      }
      if (cell.valueText) {
        return `${cell.label} · ${cell.valueText}`;
      }
      return cell.label;
    });
    return [row.label, ...cells];
  });

  return [header, ...dataRows];
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/features/export/toTableExportMatrix.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/features/export/toTableExportMatrix.ts src/features/export/toTableExportMatrix.test.ts
git commit -m "feat(export): add toTableExportMatrix — converts MatrixViewModel to 2D CSV array"
```

---

### Task 2: Add `downloadTableCsvExport` to `exportCsv.ts`

**Files:**
- Modify: `src/features/export/exportCsv.ts`

**Step 1: Add the function** (append to the file after the existing `downloadCsvExport`):

```typescript
import type { MatrixMode, MatrixViewModel } from "../../types/presentation";
import { toTableExportMatrix } from "./toTableExportMatrix";

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
```

The full updated file:

```typescript
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
```

**Step 2: Run lint + typecheck**

```bash
npm run lint
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/features/export/exportCsv.ts
git commit -m "feat(export): add downloadTableCsvExport function"
```

---

### Task 3: Update `ExportButtons.tsx` — add MatrixViewModel prop + CSV dropdown

**Context:** `ExportButtons.tsx` currently has a single "Export CSV" button. We need to:
1. Accept `matrixViewModel` and `matrixMode` as new optional props
2. Replace "Export CSV" with a dropdown: "Table CSV" / "Raw Data CSV"

**Files:**
- Modify: `src/features/export/ExportButtons.tsx`

**Step 1: Update the component**

Replace the entire file with:

```typescript
import { useRef, useState } from "react";
import type { MatrixMode, MatrixViewModel, UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { Region, RegionMonthRecord } from "../../types/weather";
import { evaluateDealbreakers } from "../matrix/dealbreakers";
import { downloadCsvExport, downloadTableCsvExport } from "./exportCsv";
import { downloadJsonExport } from "./exportJson";
import { exportMonthlyPlan } from "./exportMonthlyPlan";
import { exportShortlist } from "./exportShortlist";
import { useMemo } from "react";

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
          onClick={() => { void handleMonthlyPlanExport(); }}
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
```

**Step 2: Run typecheck**

```bash
npm run lint
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/features/export/ExportButtons.tsx
git commit -m "feat(export): replace CSV button with Table CSV / Raw Data CSV dropdown"
```

---

### Task 4: Pass MatrixViewModel from App to ExportButtons

**Context:** `ExportButtons` now accepts `matrixViewModel`, `matrixMode`, `matrixContextLabel`. These need to come from the parent component that renders both the matrix and the export panel.

**Files:**
- Read first: `src/app/App.tsx` — find where `<ExportButtons>` is rendered and what `MatrixViewModel` data is available
- Modify: `src/app/App.tsx` (or wherever ExportButtons is used)

**Step 1: Find the ExportButtons usage**

```bash
grep -n "ExportButtons" src/app/App.tsx
```

**Step 2: Find where matrixViewModel is computed**

```bash
grep -n "MatrixViewModel\|matrixViewModel\|buildMatrix\|useRegionMonth" src/app/App.tsx | head -30
```

**Step 3: Pass the new props**

Locate the `<ExportButtons ...>` JSX in `App.tsx` and add the three new props:

```typescript
<ExportButtons
  // ... existing props unchanged ...
  matrixViewModel={matrixViewModel}          // the MatrixViewModel already used by ClimateMatrix
  matrixMode={matrixMode}                    // "monthCompare" | "timeline"
  matrixContextLabel={matrixContextLabel}    // e.g. "March 2026" or "Da Nang"
/>
```

For `matrixContextLabel`, derive it from context:
- In monthCompare mode: use the month name, e.g. `MONTH_NAMES[month - 1]` (check `src/utils/months.ts` for the utility)
- In timeline mode: use the city name from the selected region

**Step 4: Run the app and verify**

```bash
npm run dev
```

Open browser → click "Export CSV ▾" → dropdown shows "Table CSV" and "Raw Data CSV" → click "Table CSV" → file downloads with the matrix content.

**Step 5: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(export): wire matrixViewModel into ExportButtons for Table CSV"
```

---

### Task 5: Add dropdown CSS

**Files:**
- Modify: whichever CSS file styles the export panel (check `src/app/App.css` or `src/features/export/`)

**Step 1: Find the export CSS**

```bash
grep -rn "export-row\|export-" src/ --include="*.css" | head -10
```

**Step 2: Add dropdown styles**

Add to the relevant CSS file:

```css
.export-dropdown {
  position: relative;
  display: inline-block;
}

.export-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  min-width: 160px;
  background: var(--color-surface, #1e1e2e);
  border: 1px solid var(--color-border, #444);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.export-dropdown-menu button {
  padding: 0.5rem 1rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  white-space: nowrap;
}

.export-dropdown-menu button:hover:not(:disabled) {
  background: var(--color-surface-hover, #2e2e3e);
}

.export-dropdown-menu button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

**Step 3: Run the app visually**

```bash
npm run dev
```

Check: dropdown looks correct, closes on selection.

**Step 4: Commit**

```bash
git add src/
git commit -m "feat(export): style CSV export dropdown menu"
```

---

### Task 6: Close dropdown on outside click

**Files:**
- Modify: `src/features/export/ExportButtons.tsx`

**Step 1: Add useEffect for outside click** (add inside the component, after existing state):

```typescript
import { useEffect, useRef, useState } from "react";

// inside component, after dropdownRef declaration:
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
```

**Step 2: Run lint**

```bash
npm run lint
```

**Step 3: Commit**

```bash
git add src/features/export/ExportButtons.tsx
git commit -m "fix(export): close CSV dropdown on outside click"
```

---

### Task 7: Final check — lint + tests + build

**Step 1: Run full check**

```bash
npm run check
```

Expected: All lint, tests, and build pass with no errors.

**Step 2: If any errors**, fix them before proceeding.

**Step 3: Push branch and open PR**

```bash
git push -u origin feat/table-csv-export
```

Then use the `commit-push-pr` skill or `gh pr create`.
