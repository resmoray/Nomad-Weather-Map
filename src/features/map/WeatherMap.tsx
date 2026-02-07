import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { RegionMonthRecord } from "../../types/weather";
import { formatRegionLabel } from "../../utils/regionLabel";

interface WeatherMapProps {
  records: RegionMonthRecord[];
}

const DEFAULT_CENTER: [number, number] = [12.5, 107.2];

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

export function WeatherMap({ records }: WeatherMapProps) {
  const center = getMapCenter(records);

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Map View</h2>
        <p>Markers are colored by suitability score.</p>
      </header>

      <div className="map-wrap" aria-label="Weather suitability map">
        <MapContainer center={center} zoom={5} scrollWheelZoom className="map-container">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {records.map((record) => (
            <CircleMarker
              key={record.region.id}
              center={[record.region.lat, record.region.lon]}
              color={scoreColor(record.suitability.score)}
              radius={9}
              fillOpacity={0.75}
              weight={2}
            >
              <Popup>
                <strong>{formatRegionLabel(record.region)}</strong>
                <br />
                {record.region.countryName}
                <br />
                Score: <strong>{record.suitability.score}</strong> ({record.suitability.band})
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
