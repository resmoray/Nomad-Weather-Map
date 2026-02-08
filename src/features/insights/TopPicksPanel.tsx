import type { TopPick } from "./buildTopPicks";

interface TopPicksPanelProps {
  picks: TopPick[];
  isLoading: boolean;
  onPickFocus: (regionId: string) => void;
}

export function TopPicksPanel({ picks, isLoading, onPickFocus }: TopPicksPanelProps) {
  return (
    <section className="panel top-picks-panel">
      <header className="panel-header">
        <h2>Top Picks</h2>
        <p>Best regions for your current profile, with reasons and warnings.</p>
      </header>

      {isLoading ? <p className="hint-text">Analyzing top picks...</p> : null}

      {!isLoading && picks.length === 0 ? (
        <p className="hint-text">No regions currently pass active filters/dealbreakers for top picks.</p>
      ) : null}

      <div className="top-picks-grid">
        {picks.map((pick, index) => (
          <article key={pick.regionId} className="top-pick-card">
            <header>
              <p className="top-pick-rank">#{index + 1}</p>
              <h3>{pick.displayName}</h3>
            </header>
            <p className="top-pick-score">
              {pick.band} {pick.score} <span>({pick.confidence} confidence)</span>
            </p>
            <ul className="top-pick-list">
              {pick.reasons.slice(0, 2).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {pick.warnings.length > 0 ? (
              <div className="warning-badges">
                {pick.warnings.slice(0, 2).map((warning) => (
                  <span key={warning} className="warning-badge">
                    {warning}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="ghost-button"
              onClick={() => onPickFocus(pick.regionId)}
            >
              Focus on map + matrix
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
