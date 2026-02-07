import type { ComfortProfileId, MatrixMode, TripTypeId } from "../../types/presentation";
import type { Region } from "../../types/weather";
import { formatRegionLabel } from "../../utils/regionLabel";
import { COMFORT_PROFILES } from "./comfortProfiles";
import { TRIP_TYPES } from "./tripTypes";

interface MatrixToolbarProps {
  matrixMode: MatrixMode;
  onMatrixModeChange: (mode: MatrixMode) => void;
  comfortProfileId: ComfortProfileId;
  onComfortProfileChange: (profileId: ComfortProfileId) => void;
  tripTypeId: TripTypeId;
  onTripTypeChange: (tripTypeId: TripTypeId) => void;
  timelineRegionId: string;
  timelineRegions: Region[];
  onTimelineRegionChange: (regionId: string) => void;
}

export function MatrixToolbar({
  matrixMode,
  onMatrixModeChange,
  comfortProfileId,
  onComfortProfileChange,
  tripTypeId,
  onTripTypeChange,
  timelineRegionId,
  timelineRegions,
  onTimelineRegionChange,
}: MatrixToolbarProps) {
  return (
    <div className="matrix-toolbar" role="group" aria-label="Comparison controls">
      <label>
        <span>Mode</span>
        <select
          aria-label="Matrix mode"
          value={matrixMode}
          onChange={(event) => onMatrixModeChange(event.target.value as MatrixMode)}
        >
          <option value="monthCompare">Month Compare</option>
          <option value="timeline">Region Timeline</option>
        </select>
      </label>

      <label>
        <span>Comfort profile</span>
        <select
          aria-label="Comfort profile"
          value={comfortProfileId}
          onChange={(event) => onComfortProfileChange(event.target.value as ComfortProfileId)}
        >
          {Object.values(COMFORT_PROFILES).map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Trip type</span>
        <select
          aria-label="Trip type"
          value={tripTypeId}
          onChange={(event) => onTripTypeChange(event.target.value as TripTypeId)}
        >
          {Object.values(TRIP_TYPES).map((tripType) => (
            <option key={tripType.id} value={tripType.id}>
              {tripType.label}
            </option>
          ))}
        </select>
      </label>

      {matrixMode === "timeline" ? (
        <label>
          <span>Timeline region</span>
          <select
            aria-label="Timeline region"
            value={timelineRegionId}
            onChange={(event) => onTimelineRegionChange(event.target.value)}
          >
            {timelineRegions.map((region) => (
              <option key={region.id} value={region.id}>
                {formatRegionLabel(region)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
