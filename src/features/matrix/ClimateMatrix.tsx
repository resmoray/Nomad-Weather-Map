import { useMemo, useState } from "react";
import type {
  ComfortProfileId,
  MatrixCellViewModel,
  MatrixMode,
  TripTypeId,
} from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { Month, RegionMonthRecord } from "../../types/weather";
import { buildMatrixViewModel } from "./buildMatrixViewModel";
import { MatrixDetailPanel } from "./MatrixDetailPanel";
import { MatrixLegend } from "./MatrixLegend";

interface ClimateMatrixProps {
  mode: MatrixMode;
  month: Month;
  monthRecords: RegionMonthRecord[];
  timelineRecords: RegionMonthRecord[];
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  comfortProfileId: ComfortProfileId;
  tripTypeId: TripTypeId;
  isLoading: boolean;
}

interface SelectedCellState {
  rowLabel: string;
  columnLabel: string;
  cell: MatrixCellViewModel;
}

export function ClimateMatrix({
  mode,
  month,
  monthRecords,
  timelineRecords,
  seasonByRegion,
  comfortProfileId,
  tripTypeId,
  isLoading,
}: ClimateMatrixProps) {
  const [selected, setSelected] = useState<SelectedCellState | null>(null);
  const [isSurfSectionOpen, setIsSurfSectionOpen] = useState(false);

  const viewModel = useMemo(
    () =>
      buildMatrixViewModel({
        mode,
        month,
        monthRecords,
        timelineRecords,
        seasonByRegion,
        comfortProfileId,
        tripTypeId,
      }),
    [
      mode,
      month,
      monthRecords,
      timelineRecords,
      seasonByRegion,
      comfortProfileId,
      tripTypeId,
    ],
  );

  const surfMetricRowKeys = new Set(["waveHeightM", "wavePeriodS", "waveDirectionDeg"]);
  const regularRows = viewModel.rows.filter((row) => !surfMetricRowKeys.has(String(row.key)));
  const surfRows = viewModel.rows.filter((row) => surfMetricRowKeys.has(String(row.key)));

  return (
    <section className="matrix-shell">
      <header className="matrix-header">
        <h3>Human-friendly climate matrix</h3>
        <p>
          Colors + short labels + values. Market season and climate season are fixed city calendars
          backed by curated sources. Other metric rows remain live API data. Click any cell for
          details, confidence and source metadata.
        </p>
      </header>

      <MatrixLegend />

      {isLoading ? <p className="hint-text">Loading matrix data...</p> : null}

      {viewModel.columns.length === 0 ? (
        <p className="hint-text">Select at least one region to render the matrix.</p>
      ) : (
        <>
          <div className="matrix-table-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {viewModel.columns.map((column) => (
                    <th key={column.key}>
                      <div>{column.title}</div>
                      <div className="metric-meta">{column.subtitle}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regularRows.map((row) => (
                  <tr key={row.key} className={`matrix-row-${row.key}`}>
                    <th>{row.label}</th>
                    {row.cells.map((cell, index) => {
                      const column = viewModel.columns[index];
                      return (
                        <td key={cell.key}>
                          <button
                            type="button"
                            className={`matrix-cell severity-${cell.severity}`}
                            onClick={() => {
                              setSelected({
                                rowLabel: row.label,
                                columnLabel: column.title,
                                cell,
                              });
                            }}
                          >
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
                ))}

                {surfRows.length > 0 ? (
                  <tr className="matrix-row-surf-toggle">
                    <th>Surf</th>
                    <td colSpan={viewModel.columns.length}>
                      <button
                        type="button"
                        className="surf-toggle-button"
                        onClick={() => {
                          setIsSurfSectionOpen((previous) => !previous);
                        }}
                      >
                        {isSurfSectionOpen ? "Hide surf metrics" : "Show surf metrics"}
                      </button>
                    </td>
                  </tr>
                ) : null}

                {isSurfSectionOpen
                  ? surfRows.map((row) => (
                      <tr key={row.key} className={`matrix-row-${row.key}`}>
                        <th>{row.label}</th>
                        {row.cells.map((cell, index) => {
                          const column = viewModel.columns[index];
                          return (
                            <td key={cell.key}>
                              <button
                                type="button"
                                className={`matrix-cell severity-${cell.severity}`}
                                onClick={() => {
                                  setSelected({
                                    rowLabel: row.label,
                                    columnLabel: column.title,
                                    cell,
                                  });
                                }}
                              >
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
                    ))
                  : null}
              </tbody>
            </table>
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
