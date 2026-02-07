import type {
  MetricKey,
  MonthlyMetrics,
  SuitabilityBand,
  SuitabilityBreakdown,
  SuitabilityScore,
} from "../../types/weather";
import { METRIC_WEIGHTS, TOTAL_WEIGHT } from "./weights";

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function normalizeRange(
  value: number,
  min: number,
  idealMin: number,
  idealMax: number,
  max: number,
): number {
  if (value <= min || value >= max) {
    return 0;
  }

  if (value >= idealMin && value <= idealMax) {
    return 100;
  }

  if (value < idealMin) {
    return clampScore(((value - min) / (idealMin - min)) * 100);
  }

  return clampScore(((max - value) / (max - idealMax)) * 100);
}

function normalizeLowerBetter(value: number, goodThreshold: number, badThreshold: number): number {
  if (value <= goodThreshold) {
    return 100;
  }

  if (value >= badThreshold) {
    return 0;
  }

  return clampScore(((badThreshold - value) / (badThreshold - goodThreshold)) * 100);
}

function scoreMetric(metric: MetricKey, value: number): number {
  switch (metric) {
    case "temperatureC":
      return normalizeRange(value, 8, 22, 30, 42);
    case "rainfallMm":
      return normalizeRange(value, 0, 20, 140, 450);
    case "humidityPct":
      return normalizeRange(value, 20, 40, 70, 98);
    case "windKph":
      return normalizeRange(value, 0, 6, 24, 65);
    case "uvIndex":
      return normalizeLowerBetter(value, 5, 13);
    case "pm25":
      return normalizeLowerBetter(value, 15, 100);
    case "aqi":
      return normalizeLowerBetter(value, 50, 220);
    case "waveHeightM":
      return normalizeRange(value, 0.1, 0.8, 2.2, 5.5);
    case "wavePeriodS":
      return normalizeRange(value, 2, 8, 14, 20);
    case "waveDirectionDeg":
      return normalizeRange(value, -1, 0, 360, 361);
    case "floodRisk":
    case "stormRisk":
      return normalizeLowerBetter(value, 25, 90);
    default:
      return 0;
  }
}

function toBand(score: number): SuitabilityBand {
  if (score < 35) {
    return "Poor";
  }

  if (score < 55) {
    return "Fair";
  }

  if (score < 75) {
    return "Good";
  }

  return "Excellent";
}

export function calculateSuitability(metrics: MonthlyMetrics): SuitabilityScore {
  let weightedSum = 0;
  let availableWeight = 0;

  const breakdown: SuitabilityBreakdown[] = (Object.keys(METRIC_WEIGHTS) as MetricKey[]).map(
    (metric) => {
      const weight = METRIC_WEIGHTS[metric];
      const metricValue = metrics[metric];

      if (metricValue.value === null || metricValue.status !== "ok") {
        return {
          metric,
          weight,
          normalizedScore: null,
          weightedContribution: 0,
          status: metricValue.status,
        };
      }

      const normalizedScore = scoreMetric(metric, metricValue.value);
      weightedSum += normalizedScore * weight;
      availableWeight += weight;

      return {
        metric,
        weight,
        normalizedScore: Number(normalizedScore.toFixed(1)),
        weightedContribution: Number(((normalizedScore * weight) / TOTAL_WEIGHT).toFixed(1)),
        status: metricValue.status,
      };
    },
  );

  const confidence = TOTAL_WEIGHT === 0 ? 0 : availableWeight / TOTAL_WEIGHT;
  const baseScore = availableWeight === 0 ? 0 : weightedSum / availableWeight;
  const finalScore = Math.round(baseScore * confidence);

  return {
    score: finalScore,
    band: toBand(finalScore),
    confidence: Number(confidence.toFixed(2)),
    breakdown,
  };
}
