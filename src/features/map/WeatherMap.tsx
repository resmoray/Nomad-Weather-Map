import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { UserPreferenceProfile } from "../../types/presentation";
import type { RegionMonthRecord } from "../../types/weather";
import { formatRegionLabel } from "../../utils/regionLabel";
import { evaluateDealbreakers } from "../matrix/dealbreakers";
import { calculatePersonalScore } from "../matrix/presets";

interface WeatherMapProps {
  records: RegionMonthRecord[];
  profile: UserPreferenceProfile;
  minScore: number;
  onMinScoreChange: (score: number) => void;
  focusedRegionId: string;
  onFocusRegion: (regionId: string) => void;
}

const DEFAULT_CENTER: [number, number] = [12.5, 107.2];
const CLUSTER_THRESHOLD = 25;

interface ClusterMarker {
  key: string;
  lat: number;
  lon: number;
  score: number;
  count: number;
  labels: string[];
}

interface PersonalRecordEntry {
  record: RegionMonthRecord;
  personalScore: number;
}

function scoreColor(score: number): string {
  if (score >= 75) {
    return "#15803d";
  }

  if (score >= 55) {
    return "#3b82f6";
  }

  if (score >= 35) {
    return "#f59e0b";
  }

  return "#dc2626";
}

function getMapCenter(records: RegionMonthRecord[]): [number, number] {
  if (records.length === 0) {
    return DEFAULT_CENTER;
  }

  const latTotal = records.reduce((sum, record) => sum + record.region.lat, 0);
  const lonTotal = records.reduce((sum, record) => sum + record.region.lon, 0);

  return [latTotal / records.length, lonTotal / records.length];
}

function clusterRecords(entries: PersonalRecordEntry[]): ClusterMarker[] {
  const clusters = new Map<string, PersonalRecordEntry[]>();

  for (const entry of entries) {
    const latBucket = Math.round(entry.record.region.lat * 2) / 2;
    const lonBucket = Math.round(entry.record.region.lon * 2) / 2;
    const key = `${latBucket}:${lonBucket}`;
    const existing = clusters.get(key) ?? [];
    existing.push(entry);
    clusters.set(key, existing);
  }

  return Array.from(clusters.entries()).map(([key, grouped]) => {
    const lat = grouped.reduce((sum, entry) => sum + entry.record.region.lat, 0) / grouped.length;
    const lon = grouped.reduce((sum, entry) => sum + entry.record.region.lon, 0) / grouped.length;
    const score = grouped.reduce((sum, entry) => sum + entry.personalScore, 0) / grouped.length;
    const labels = grouped.slice(0, 5).map((entry) => formatRegionLabel(entry.record.region));

    return {
      key,
      lat,
      lon,
      score,
      count: grouped.length,
      labels,
    };
  });
}

export function WeatherMap({
  records,
  profile,
  minScore,
  onMinScoreChange,
  focusedRegionId,
  onFocusRegion,
}: WeatherMapProps) {
  const recordsWithPersonal = records.map((record) => {
    const personal = calculatePersonalScore(record, profile);
    const dealbreaker = evaluateDealbreakers(record, profile);
    return { record, personal, personalScore: personal.score, dealbreaker };
  });
  const dealbreakerAllowed = recordsWithPersonal.filter((item) => item.dealbreaker.passed);
  const filteredRecords = dealbreakerAllowed.filter((item) => item.personalScore >= minScore);
  const filteredRawRecords = filteredRecords.map((item) => item.record);
  const dealbreakerExcludedCount = recordsWithPersonal.length - dealbreakerAllowed.length;
  const center = getMapCenter(filteredRawRecords);
  const shouldCluster = filteredRawRecords.length > CLUSTER_THRESHOLD;
  const clusters = shouldCluster ? clusterRecords(filteredRecords) : [];

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Map View</h2>
        <p>Markers are colored by personal score and linked with matrix focus.</p>
      </header>

      <label className="map-threshold">
        <span>Hide markers below score: {Math.round(minScore)}</span>
        <input
          aria-label="Map minimum score"
          type="range"
          min={0}
          max={100}
          value={Math.round(minScore)}
          onChange={(event) => onMinScoreChange(Number(event.target.value))}
        />
      </label>

      <div className="map-legend">
        <span className="legend-dot excellent-dot">75+</span>
        <span className="legend-dot good-dot">55-74</span>
        <span className="legend-dot caution-dot">35-54</span>
        <span className="legend-dot bad-dot">&lt;35</span>
      </div>
      {dealbreakerExcludedCount > 0 ? (
        <p className="hint-text warning-text">
          {dealbreakerExcludedCount} marker(s) hidden by active dealbreakers.
        </p>
      ) : null}

      <div className="map-wrap" aria-label="Weather suitability map">
        <MapContainer center={center} zoom={5} scrollWheelZoom className="map-container">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {!shouldCluster
            ? filteredRecords.map(({ record, personal }) => (
                <CircleMarker
                  key={record.region.id}
                  center={[record.region.lat, record.region.lon]}
                  color={scoreColor(personal.score)}
                  radius={record.region.id === focusedRegionId ? 12 : 9}
                  fillOpacity={0.75}
                  weight={record.region.id === focusedRegionId ? 4 : 2}
                  eventHandlers={{
                    click: () => onFocusRegion(record.region.id),
                  }}
                >
                  <Popup>
                    <strong>{formatRegionLabel(record.region)}</strong>
                    <br />
                    {record.region.countryName}
                    <br />
                    Personal score: <strong>{personal.score}</strong> ({personal.band})
                  </Popup>
                </CircleMarker>
              ))
            : clusters.map((cluster) => (
                <CircleMarker
                  key={cluster.key}
                  center={[cluster.lat, cluster.lon]}
                  color={scoreColor(cluster.score)}
                  radius={Math.max(10, Math.min(18, 8 + cluster.count / 2))}
                  fillOpacity={0.7}
                  weight={2}
                >
                  <Popup>
                    <strong>{cluster.count} regions</strong>
                    <br />
                    Avg score: <strong>{Math.round(cluster.score)}</strong>
                    <br />
                    {cluster.labels.join(", ")}
                  </Popup>
                </CircleMarker>
              ))}
        </MapContainer>
      </div>
    </section>
  );
}
