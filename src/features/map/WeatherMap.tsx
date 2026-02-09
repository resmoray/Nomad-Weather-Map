import { Fragment, useEffect, useRef } from "react";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { UserPreferenceProfile } from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { formatRegionLabel } from "../../utils/regionLabel";
import { classifyClimateSeason } from "../matrix/classifyClimateSeason";
import { evaluateDealbreakers } from "../matrix/dealbreakers";
import { calculatePersonalScore } from "../matrix/presets";

interface WeatherMapProps {
  records: RegionMonthRecord[];
  profile: UserPreferenceProfile;
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  minScore: number;
  onMinScoreChange: (score: number) => void;
  focusedRegionId: string;
  onFocusRegion: (regionId: string) => void;
  onNavigateToRegion: (regionId: string) => void;
}

const DEFAULT_CENTER: [number, number] = [12.5, 107.2];
const CLUSTER_THRESHOLD = 25;

interface ClusterMarker {
  key: string;
  lat: number;
  lon: number;
  score: number;
  count: number;
  regions: Array<{
    regionId: string;
    label: string;
  }>;
}

interface PersonalRecordEntry {
  record: RegionMonthRecord;
  personalScore: number;
}

interface FocusedRegionViewportProps {
  lat: number | null;
  lon: number | null;
}

function FocusedRegionViewport({ lat, lon }: FocusedRegionViewportProps) {
  const map = useMap();

  useEffect(() => {
    if (lat === null || lon === null) {
      return;
    }

    const current = map.getCenter();
    const distance = Math.abs(current.lat - lat) + Math.abs(current.lng - lon);
    if (distance < 0.01) {
      return;
    }

    map.flyTo([lat, lon], Math.max(map.getZoom(), 5), {
      animate: true,
      duration: 0.75,
    });
  }, [map, lat, lon]);

  return null;
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
    const sorted = [...grouped].sort((left, right) => right.personalScore - left.personalScore);
    const regions = sorted.slice(0, 5).map((entry) => ({
      regionId: entry.record.region.id,
      label: formatRegionLabel(entry.record.region),
    }));

    return {
      key,
      lat,
      lon,
      score,
      count: grouped.length,
      regions,
    };
  });
}

export function WeatherMap({
  records,
  profile,
  seasonByRegion,
  minScore,
  onMinScoreChange,
  focusedRegionId,
  onFocusRegion,
  onNavigateToRegion,
}: WeatherMapProps) {
  const markerRefs = useRef<Record<string, LeafletCircleMarker | null>>({});
  const recordsWithPersonal = records.map((record) => {
    const climateSeasonLabel = classifyClimateSeason(record).label;
    const marketSeasonLabel = seasonByRegion[record.region.id]?.[record.month]?.seasonLabel ?? climateSeasonLabel;
    const personal = calculatePersonalScore(record, profile, {
      marketSeasonLabel,
      climateSeasonLabel,
    });
    const dealbreaker = evaluateDealbreakers(record, profile);
    return { record, personal, personalScore: personal.score, dealbreaker };
  });
  const dealbreakerAllowed = recordsWithPersonal.filter((item) => item.dealbreaker.passed);
  const filteredRecords = dealbreakerAllowed.filter((item) => item.personalScore >= minScore);
  const filteredRawRecords = filteredRecords.map((item) => item.record);
  const dealbreakerExcludedCount = recordsWithPersonal.length - dealbreakerAllowed.length;
  const center = getMapCenter(filteredRawRecords);
  const focusedRegion = recordsWithPersonal.find((item) => item.record.region.id === focusedRegionId)?.record.region;
  const focusedRegionVisible = filteredRawRecords.some((record) => record.region.id === focusedRegionId);
  const shouldCluster = filteredRawRecords.length > CLUSTER_THRESHOLD && !focusedRegionVisible;
  const clusters = shouldCluster ? clusterRecords(filteredRecords) : [];
  const focusedLat = focusedRegion?.lat ?? null;
  const focusedLon = focusedRegion?.lon ?? null;
  const visibleRegionIdsSignature = filteredRawRecords.map((record) => record.region.id).join("|");

  useEffect(() => {
    if (!focusedRegionId || shouldCluster) {
      return;
    }

    markerRefs.current[focusedRegionId]?.openPopup();
  }, [focusedRegionId, shouldCluster, visibleRegionIdsSignature]);

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
          <FocusedRegionViewport lat={focusedLat} lon={focusedLon} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {!shouldCluster
            ? filteredRecords.map(({ record, personal }) => (
                <CircleMarker
                  key={record.region.id}
                  ref={(marker) => {
                    markerRefs.current[record.region.id] = marker;
                  }}
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
                    <button
                      type="button"
                      className="map-popup-link"
                      onClick={() => onNavigateToRegion(record.region.id)}
                    >
                      {formatRegionLabel(record.region)}
                    </button>
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
                    {cluster.regions.map((region) => (
                      <Fragment key={`${cluster.key}-${region.regionId}`}>
                        <button
                          type="button"
                          className="map-popup-link"
                          onClick={() => onNavigateToRegion(region.regionId)}
                        >
                          {region.label}
                        </button>
                        <br />
                      </Fragment>
                    ))}
                    {cluster.count > cluster.regions.length ? `+${cluster.count - cluster.regions.length} more` : null}
                  </Popup>
                </CircleMarker>
              ))}
        </MapContainer>
      </div>
    </section>
  );
}
