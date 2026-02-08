import { SCORING_GUIDE, SCORING_MODEL_VERSION, THRESHOLD_VERSION } from "./scoringMetadata";

interface ScoringGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function ScoringGuideModal({ open, onClose }: ScoringGuideModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="How scoring works">
      <div className="modal-card">
        <header className="modal-header">
          <h3>{SCORING_GUIDE.title}</h3>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </header>
        <p>{SCORING_GUIDE.summary}</p>
        <ul className="modal-list">
          {SCORING_GUIDE.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <p className="hint-text">
          Scoring model: {SCORING_MODEL_VERSION} | Thresholds: {THRESHOLD_VERSION}
        </p>
      </div>
    </div>
  );
}
