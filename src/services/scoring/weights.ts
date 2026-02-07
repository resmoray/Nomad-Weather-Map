import type { MetricKey } from "../../types/weather";

export const METRIC_WEIGHTS: Record<MetricKey, number> = {
  temperatureC: 20,
  rainfallMm: 15,
  humidityPct: 10,
  windKph: 10,
  uvIndex: 10,
  pm25: 12,
  aqi: 12,
  // Surf-oriented marine metrics are currently used for persona scoring only.
  waveHeightM: 0,
  wavePeriodS: 0,
  waveDirectionDeg: 0,
  // Keep at 0 until these metrics have reliable live data.
  floodRisk: 0,
  stormRisk: 0,
};

export const TOTAL_WEIGHT = Object.values(METRIC_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
);
