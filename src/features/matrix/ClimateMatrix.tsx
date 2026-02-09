import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type {
  MatrixCellViewModel,
  MatrixMode,
  MatrixRowGroup,
  UserPreferenceProfile,
} from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { MetricKey, Month, RegionMonthRecord } from "../../types/weather";
import { ROW_GROUP_LABELS } from "./classifyMetric";
import { buildMatrixViewModel } from "./buildMatrixViewModel";
import { MatrixDetailPanel } from "./MatrixDetailPanel";
import { MatrixLegend } from "./MatrixLegend";

interface ClimateMatrixProps {
  mode: MatrixMode;
  month: Month;
  monthRecords: RegionMonthRecord[];
  timelineRecords: RegionMonthRecord[];
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  profile: UserPreferenceProfile;
  isLoading: boolean;
  minScore: number;
  onMinScoreChange: (score: number) => void;
  pinnedMetricKeys: MetricKey[];
  onPinnedMetricToggle: (metric: MetricKey) => void;
  focusedRegionId: string;
  onFocusRegion: (regionId: string) => void;
  onNavigateToRegion: (regionId: string) => void;
  colorBlindMode: boolean;
}

interface SelectedCellState {
  rowLabel: string;
  columnLabel: string;
  cell: MatrixCellViewModel;
}

const ROW_GROUP_ORDER: MatrixRowGroup[] = ["seasons", "comfort", "air", "surf"];
const PINNABLE_METRICS: MetricKey[] = [
  "temperatureC",
  "rainfallMm",
  "humidityPct",
  "windKph",
  "uvIndex",
  "pm25",
  "aqi",
  "waveHeightM",
  "wavePeriodS",
];

function severityMarker(severity: string): string {
  switch (severity) {
    case "excellent":
      return "A";
    case "good":
      return "B";
    case "caution":
      return "C";
    case "bad":
      return "D";
    case "extreme":
      return "E";
    default:
      return "?";
  }
}

export function ClimateMatrix({
  mode,
  month,
  monthRecords,
  timelineRecords,
  seasonByRegion,
  profile,
  isLoading,
  minScore,
  onMinScoreChange,
  pinnedMetricKeys,
  onPinnedMetricToggle,
  focusedRegionId,
  onFocusRegion,
  onNavigateToRegion,
  colorBlindMode,
}: ClimateMatrixProps) {
  const [selected, setSelected] = useState<SelectedCellState | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<MatrixRowGroup, boolean>>({
    seasons: false,
    comfort: false,
    air: false,
    surf: false,
  });
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  useEffect(() => {
    if (!profile.surfEnabled) {
      return;
    }

    setCollapsedGroups((previous) => {
      if (!previous.surf) {
        return previous;
      }

      return {
        ...previous,
        surf: false,
      };
    });
  }, [profile.surfEnabled]);

  const viewModel = useMemo(
    () =>
      buildMatrixViewModel({
        mode,
        month,
        monthRecords,
        timelineRecords,
        seasonByRegion,
        profile,
      }),
    [mode, month, monthRecords, timelineRecords, seasonByRegion, profile],
  );

  const visibleColumnIndexes = useMemo(
    () =>
      viewModel.columns
        .map((column, index) => ({ index, score: column.personalScore }))
        .filter((entry) => entry.score >= minScore)
        .map((entry) => entry.index),
    [viewModel.columns, minScore],
  );

  const visibleColumns = useMemo(
    () => visibleColumnIndexes.map((index) => viewModel.columns[index]),
    [viewModel.columns, visibleColumnIndexes],
  );

  const visibleRows = useMemo(
    () =>
      viewModel.rows.map((row) => ({
        ...row,
        cells: visibleColumnIndexes.map((index) => row.cells[index]),
      })),
    [viewModel.rows, visibleColumnIndexes],
  );

  const rowsByGroup = useMemo(() => {
    const grouped = new Map<MatrixRowGroup, typeof visibleRows>();
    for (const group of ROW_GROUP_ORDER) {
      grouped.set(group, []);
    }

    for (const row of visibleRows) {
      grouped.get(row.group)?.push(row);
    }

    for (const group of ROW_GROUP_ORDER) {
      const rows = grouped.get(group) ?? [];
      const pinned = rows.filter((row) => pinnedMetricKeys.includes(row.key as MetricKey));
      const normal = rows.filter((row) => !pinnedMetricKeys.includes(row.key as MetricKey));
      grouped.set(group, [...pinned, ...normal]);
    }

    return grouped;
  }, [visibleRows, pinnedMetricKeys]);

  const keyboardRows = useMemo(() => {
    const ordered: typeof visibleRows = [];
    for (const group of ROW_GROUP_ORDER) {
      if (collapsedGroups[group]) {
        continue;
      }

      const rows = rowsByGroup.get(group) ?? [];
      ordered.push(...rows);
    }

    return ordered;
  }, [rowsByGroup, collapsedGroups]);

  useEffect(() => {
    if (!focusedRegionId) {
      return;
    }

    const tableWrap = tableWrapRef.current;
    const headerCell = headerCellRefs.current[focusedRegionId];

    if (!tableWrap || !headerCell) {
      return;
    }

    const wrapRect = tableWrap.getBoundingClientRect();
    const cellRect = headerCell.getBoundingClientRect();
    const padding = 24;

    if (cellRect.left < wrapRect.left) {
      tableWrap.scrollBy({
        left: cellRect.left - wrapRect.left - padding,
        behavior: "smooth",
      });
      return;
    }

    if (cellRect.right > wrapRect.right) {
      tableWrap.scrollBy({
        left: cellRect.right - wrapRect.right + padding,
        behavior: "smooth",
      });
    }
  }, [focusedRegionId, visibleColumns]);

  function focusCell(rowIndex: number, columnIndex: number): void {
    const target = cellRefs.current[`${rowIndex}-${columnIndex}`];
    target?.focus();
  }

  function handleCellKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    rowIndex: number,
    columnIndex: number,
  ): void {
    const maxRow = keyboardRows.length - 1;
    const maxCol = Math.max(visibleColumns.length - 1, 0);

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusCell(rowIndex, Math.min(columnIndex + 1, maxCol));
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusCell(rowIndex, Math.max(columnIndex - 1, 0));
        break;
      case "ArrowDown":
        event.preventDefault();
        focusCell(Math.min(rowIndex + 1, maxRow), columnIndex);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusCell(Math.max(rowIndex - 1, 0), columnIndex);
        break;
      default:
        break;
    }
  }

  return (
    <section className="matrix-shell">
      <header className="matrix-header">
        <h3>Human-friendly climate matrix</h3>
        <p>
          Decision-first view with grouped rows, pinned metrics, and minimum score filtering. Click
          or use keyboard arrows to inspect cells.
        </p>
      </header>

      <div className="matrix-controls">
        <label>
          <span>Minimum acceptable score: {Math.round(minScore)}</span>
          <input
            aria-label="Minimum acceptable score"
            type="range"
            min={0}
            max={100}
            value={Math.round(minScore)}
            onChange={(event) => onMinScoreChange(Number(event.target.value))}
          />
        </label>
        <div className="pinned-rows-control">
          <span>Pinned rows</span>
          <div className="chip-row">
            {PINNABLE_METRICS.map((metric) => {
              const checked = pinnedMetricKeys.includes(metric);
              return (
                <label key={metric} className={`chip ${checked ? "chip-on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onPinnedMetricToggle(metric)}
                    aria-label={`Pin ${metric}`}
                  />
                  <span>{metric}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <MatrixLegend />

      {isLoading ? <p className="hint-text">Loading matrix data...</p> : null}

      {viewModel.columns.length === 0 ? (
        <p className="hint-text">Select at least one region to render the matrix.</p>
      ) : visibleColumns.length === 0 ? (
        <p className="hint-text">
          No columns match the minimum score filter. Lower the threshold to view more regions.
        </p>
      ) : (
        <>
          <div ref={tableWrapRef} className="matrix-table-wrap">
            <table className={`matrix-table ${colorBlindMode ? "matrix-colorblind" : ""}`}>
              <thead>
                <tr>
                  <th>Metric</th>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.key}
                      ref={(element) => {
                        headerCellRefs.current[column.regionId] = element;
                      }}
                      className={column.regionId === focusedRegionId ? "focused-column" : ""}
                    >
                      <div>
                        <button
                          type="button"
                          className={`matrix-column-link ${
                            column.regionId === focusedRegionId ? "matrix-column-link-active" : ""
                          }`}
                          onClick={() => {
                            onFocusRegion(column.regionId);
                            onNavigateToRegion(column.regionId);
                          }}
                          title={`Show ${column.title} on map`}
                        >
                          {column.title}
                        </button>
                      </div>
                      <div className="metric-meta">{column.subtitle}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROW_GROUP_ORDER.map((group) => {
                  const rows = rowsByGroup.get(group) ?? [];
                  if (rows.length === 0) {
                    return null;
                  }

                  return (
                    <Fragment key={`group-fragment-${group}`}>
                      <tr key={`group-${group}`} className="matrix-group-header">
                        <th>{ROW_GROUP_LABELS[group]}</th>
                        <td colSpan={visibleColumns.length}>
                          <button
                            type="button"
                            className="surf-toggle-button"
                            onClick={() =>
                              setCollapsedGroups((previous) => ({
                                ...previous,
                                [group]: !previous[group],
                              }))
                            }
                          >
                            {collapsedGroups[group] ? "Expand" : "Collapse"}
                          </button>
                        </td>
                      </tr>

                      {!collapsedGroups[group]
                        ? rows.map((row) => {
                            const keyboardRowIndex = keyboardRows.findIndex((candidate) => candidate.key === row.key);
                            return (
                              <tr key={row.key} className={`matrix-row-${row.key}`}>
                                <th>{row.label}</th>
                                {row.cells.map((cell, index) => {
                                  const column = visibleColumns[index];
                                  return (
                                    <td key={cell.key}>
                                      <button
                                        ref={(element) => {
                                          cellRefs.current[`${keyboardRowIndex}-${index}`] = element;
                                        }}
                                        type="button"
                                        title={cell.tooltipText ?? `${cell.label} ${cell.valueText}`}
                                        className={`matrix-cell severity-${cell.severity} ${
                                          column.regionId === focusedRegionId ? "matrix-cell-focused" : ""
                                        }`}
                                        onClick={() => {
                                          setSelected({
                                            rowLabel: row.label,
                                            columnLabel: column.title,
                                            cell: {
                                              ...cell,
                                              regionId: column.regionId,
                                              month: column.month,
                                              rowGroup: row.group,
                                            },
                                          });
                                          onFocusRegion(column.regionId);
                                        }}
                                        onKeyDown={(event) => handleCellKeyDown(event, keyboardRowIndex, index)}
                                      >
                                        {colorBlindMode ? (
                                          <span className="severity-marker">{severityMarker(cell.severity)}</span>
                                        ) : null}
                                        <span className="matrix-cell-label">{cell.label}</span>
                                        {cell.valueText ? (
                                          <span className="matrix-cell-value">{cell.valueText}</span>
                                        ) : null}
                                        {cell.confidenceText &&
                                        row.key !== "marketSeason" &&
                                        row.key !== "climateSeason" ? (
                                          <span className="matrix-cell-meta">{cell.confidenceText}</span>
                                        ) : null}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })
                        : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="matrix-cards">
            {visibleColumns.map((column, columnIndex) => (
              <article key={`card-${column.key}`} className="matrix-card">
                <header>
                  <h4>{column.title}</h4>
                  <p>{column.subtitle}</p>
                </header>
                <div className="matrix-card-rows">
                  {visibleRows.map((row) => {
                    const cell = row.cells[columnIndex];
                    return (
                      <button
                        key={`card-cell-${row.key}-${column.key}`}
                        type="button"
                        className={`matrix-card-cell severity-${cell.severity}`}
                        onClick={() => {
                          setSelected({
                            rowLabel: row.label,
                            columnLabel: column.title,
                            cell: {
                              ...cell,
                              regionId: column.regionId,
                              month: column.month,
                              rowGroup: row.group,
                            },
                          });
                          onFocusRegion(column.regionId);
                        }}
                      >
                        <span>{row.label}</span>
                        <strong>{cell.label}</strong>
                        {cell.valueText ? <small>{cell.valueText}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>

          <MatrixDetailPanel
            rowLabel={selected?.rowLabel ?? "-"}
            columnLabel={selected?.columnLabel ?? "-"}
            cell={selected?.cell ?? null}
          />
        </>
      )}
    </section>
  );
}
