import { z } from "zod";
import sourceCatalogRaw from "../../data/source-catalog.json";
import type { MetricKey, MetricStatus, MetricValue, MonthlyMetrics, SourceCatalog } from "../../types/weather";
import type { OpenMeteoMonthlySummary } from "./openMeteoClient";

const sourceInfoSchema = z.object({
  sourceName: z.string(),
  sourceUrl: z.string(),
  notes: z.string(),
});

const sourceCatalogSchema = z.object({
  temperatureC: sourceInfoSchema,
  rainfallMm: sourceInfoSchema,
  humidityPct: sourceInfoSchema,
  windKph: sourceInfoSchema,
  uvIndex: sourceInfoSchema,
  pm25: sourceInfoSchema,
  aqi: sourceInfoSchema,
  waveHeightM: sourceInfoSchema,
  wavePeriodS: sourceInfoSchema,
  waveDirectionDeg: sourceInfoSchema,
  floodRisk: sourceInfoSchema,
  stormRisk: sourceInfoSchema,
});

const sourceCatalog: SourceCatalog = sourceCatalogSchema.parse(sourceCatalogRaw);

function toMetricValue(
  metric: MetricKey,
  value: number | null,
  unit: string,
  lastUpdated: string,
  forcedStatus?: MetricStatus,
): MetricValue {
  const source = sourceCatalog[metric];
  const status = forcedStatus ?? (value === null ? "missing" : "ok");

  return {
    value,
    unit,
    status,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    lastUpdated,
  };
}

export function mapOpenMeteoSummaryToMetrics(summary: OpenMeteoMonthlySummary): MonthlyMetrics {
  const fallbackUpdated = new Date().toISOString();

  return {
    temperatureC: toMetricValue(
      "temperatureC",
      summary.temperatureC,
      "C",
      summary.climateLastUpdated,
    ),
    rainfallMm: toMetricValue("rainfallMm", summary.rainfallMm, "mm", summary.climateLastUpdated),
    humidityPct: toMetricValue(
      "humidityPct",
      summary.humidityPct,
      "%",
      summary.climateLastUpdated,
    ),
    windKph: toMetricValue("windKph", summary.windKph, "kph", summary.climateLastUpdated),
    uvIndex: toMetricValue("uvIndex", summary.uvIndex, "index", summary.airQualityLastUpdated),
    pm25: toMetricValue("pm25", summary.pm25, "ug/m3", summary.airQualityLastUpdated),
    aqi: toMetricValue("aqi", summary.aqi, "index", summary.airQualityLastUpdated),
    waveHeightM: toMetricValue("waveHeightM", summary.waveHeightM, "m", summary.marineLastUpdated),
    wavePeriodS: toMetricValue("wavePeriodS", summary.wavePeriodS, "s", summary.marineLastUpdated),
    waveDirectionDeg: toMetricValue(
      "waveDirectionDeg",
      summary.waveDirectionDeg,
      "deg",
      summary.marineLastUpdated,
    ),
    floodRisk: toMetricValue("floodRisk", null, "index", fallbackUpdated, "missing"),
    stormRisk: toMetricValue("stormRisk", null, "index", fallbackUpdated, "missing"),
  };
}
