import type { MatrixCellViewModel } from "../../types/presentation";
import { METRIC_ROW_LABELS } from "./classifyMetric";

interface MatrixDetailPanelProps {
  rowLabel: string;
  columnLabel: string;
  cell: MatrixCellViewModel | null;
}

function getMeaningText(rowLabel: string): string {
  if (rowLabel === "Market season") {
    return "Fixed city demand/cost calendar: high means typically busier and more expensive, not automatically more comfortable.";
  }

  if (rowLabel === "Climate season") {
    return "Fixed city comfort calendar: high means historically better comfort months for this location.";
  }

  if (rowLabel === "Personal") {
    return "Custom preference score: tuned by your selected temperature, humidity, rain, air, UV and surf settings.";
  }

  return "Metric value for this region and month.";
}

export function MatrixDetailPanel({ rowLabel, columnLabel, cell }: MatrixDetailPanelProps) {
  return (
    <aside className="matrix-detail" aria-live="polite">
      <h3>Cell Details</h3>
      {!cell ? (
        <p className="hint-text">Select a matrix cell to see value context and source details.</p>
      ) : (
        <div className="matrix-detail-content">
          <p>
            <strong>{columnLabel}</strong> • {rowLabel}
          </p>
          <section>
            <h4>Meaning</h4>
            <p>
              <strong>{cell.label}</strong>
              {cell.valueText ? ` (${cell.valueText})` : ""}
            </p>
            <p>{getMeaningText(rowLabel)}</p>
          </section>
          <section>
            <h4>Why this label</h4>
            <p>{cell.reason}</p>
          </section>
          <section>
            <h4>Confidence</h4>
            <p>{cell.confidenceText ? cell.confidenceText : "No confidence metadata for this metric."}</p>
            {cell.confidenceDetails ? (
              <>
                <p>Coverage: {Math.round(cell.confidenceDetails.coverage * 100)}%</p>
                <p>{cell.confidenceDetails.reason}</p>
                {cell.confidenceDetails.missingMetrics.length > 0 ? (
                  <p>
                    Missing metrics:{" "}
                    {cell.confidenceDetails.missingMetrics
                      .map((metric) => METRIC_ROW_LABELS[metric] ?? metric)
                      .join(", ")}
                  </p>
                ) : null}
              </>
            ) : null}
            {cell.marketConfidenceSource ? (
              <p>Market signal source quality: {cell.marketConfidenceSource}</p>
            ) : null}
            {cell.isPriceFallback !== undefined || cell.isCrowdFallback !== undefined ? (
              <p>
                Fallback usage: price {cell.isPriceFallback ? "yes" : "no"}, crowd{" "}
                {cell.isCrowdFallback ? "yes" : "no"}
              </p>
            ) : null}
          </section>
          <section>
            <h4>Sources</h4>
            <p>
              {cell.sourceName}
              {cell.sourceUrl ? (
                <>
                  {" "}
                  <a href={cell.sourceUrl} target="_blank" rel="noreferrer">
                    open
                  </a>
                </>
              ) : null}
            </p>
            <p>Last updated: {cell.lastUpdated || "Unknown"}</p>
            {cell.seasonSources && cell.seasonSources.length > 0 ? (
              <ul className="matrix-source-list">
                {cell.seasonSources.map((source) => (
                  <li key={`${source.name}-${source.lastUpdated}`}>
                    {source.name} ({source.lastUpdated})
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          {cell.personalDrivers && cell.personalDrivers.length > 0 ? (
            <section>
              <h4>Score drivers</h4>
              <ul className="matrix-source-list">
                {cell.personalDrivers.map((driver) => (
                  <li key={`${driver.metric}-${driver.contribution}`}>
                    {driver.direction === "positive" ? "+" : "-"} {driver.metric}: {driver.reason} (
                    {driver.contribution.toFixed(1)})
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {cell.personalWarnings && cell.personalWarnings.length > 0 ? (
            <section>
              <h4>Warnings</h4>
              <ul className="matrix-source-list">
                {cell.personalWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </aside>
  );
}
