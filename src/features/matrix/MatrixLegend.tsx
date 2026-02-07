export function MatrixLegend() {
  return (
    <div className="matrix-legend" aria-label="Matrix legend">
      <span className="legend-item severity-excellent">Excellent</span>
      <span className="legend-item severity-good">Good</span>
      <span className="legend-item severity-caution">Caution</span>
      <span className="legend-item severity-bad">Bad</span>
      <span className="legend-item severity-extreme">Extreme</span>
      <span className="legend-item severity-missing">Missing</span>
      <span className="legend-note">Market season = fixed demand/price calendar</span>
      <span className="legend-note">Climate season = fixed comfort calendar</span>
      <span className="legend-note">Personal = comfort profile + trip type</span>
      <span className="legend-note">Metric rows below = live API values</span>
    </div>
  );
}
