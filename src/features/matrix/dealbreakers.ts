import type { UserPreferenceProfile } from "../../types/presentation";
import type { MetricKey, MetricValue, RegionMonthRecord } from "../../types/weather";

export interface DealbreakerResult {
  passed: boolean;
  reasons: string[];
  missingMetrics: MetricKey[];
}

const DEALBREAKER_THRESHOLDS = {
  maxRainMm: 180,
  maxPm25: 55.4,
  maxAqi: 150,
  maxUvIndex: 10,
  maxWindKph: 35,
} as const;

function pushMissingMetric(
  missing: Set<MetricKey>,
  reasons: string[],
  metric: MetricKey,
  label: string,
): void {
  missing.add(metric);
  reasons.push(`Missing ${label} data for active dealbreaker.`);
}

function readMetricValue(metric: MetricValue): number | null {
  if (metric.status !== "ok" || metric.value === null || Number.isNaN(metric.value)) {
    return null;
  }

  return metric.value;
}

export function evaluateDealbreakers(
  record: RegionMonthRecord,
  profile: UserPreferenceProfile,
): DealbreakerResult {
  const { dealbreakers } = profile;
  const reasons: string[] = [];
  const missing = new Set<MetricKey>();

  if (dealbreakers.coastalOnly && !record.region.isCoastal) {
    reasons.push("Region is inland but coastal-only dealbreaker is active.");
  }

  if (dealbreakers.avoidHeavyRain) {
    const rainfall = readMetricValue(record.metrics.rainfallMm);
    if (rainfall === null) {
      pushMissingMetric(missing, reasons, "rainfallMm", "rainfall");
    } else if (rainfall > DEALBREAKER_THRESHOLDS.maxRainMm) {
      reasons.push(`Rainfall ${rainfall} mm exceeds ${DEALBREAKER_THRESHOLDS.maxRainMm} mm.`);
    }
  }

  if (dealbreakers.avoidUnhealthyAir) {
    const pm25 = readMetricValue(record.metrics.pm25);
    const aqi = readMetricValue(record.metrics.aqi);

    if (pm25 === null) {
      pushMissingMetric(missing, reasons, "pm25", "PM2.5");
    } else if (pm25 > DEALBREAKER_THRESHOLDS.maxPm25) {
      reasons.push(`PM2.5 ${pm25} exceeds ${DEALBREAKER_THRESHOLDS.maxPm25}.`);
    }

    if (aqi === null) {
      pushMissingMetric(missing, reasons, "aqi", "AQI");
    } else if (aqi > DEALBREAKER_THRESHOLDS.maxAqi) {
      reasons.push(`AQI ${aqi} exceeds ${DEALBREAKER_THRESHOLDS.maxAqi}.`);
    }
  }

  if (dealbreakers.avoidVeryHighUv) {
    const uv = readMetricValue(record.metrics.uvIndex);
    if (uv === null) {
      pushMissingMetric(missing, reasons, "uvIndex", "UV");
    } else if (uv > DEALBREAKER_THRESHOLDS.maxUvIndex) {
      reasons.push(`UV index ${uv} exceeds ${DEALBREAKER_THRESHOLDS.maxUvIndex}.`);
    }
  }

  if (dealbreakers.avoidStrongWind) {
    const wind = readMetricValue(record.metrics.windKph);
    if (wind === null) {
      pushMissingMetric(missing, reasons, "windKph", "wind");
    } else if (wind > DEALBREAKER_THRESHOLDS.maxWindKph) {
      reasons.push(`Wind ${wind} kph exceeds ${DEALBREAKER_THRESHOLDS.maxWindKph} kph.`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
    missingMetrics: [...missing],
  };
}

export function passesDealbreakers(record: RegionMonthRecord, profile: UserPreferenceProfile): boolean {
  return evaluateDealbreakers(record, profile).passed;
}
