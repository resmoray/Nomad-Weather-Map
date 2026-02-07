import type { ComfortProfileId, PersonalScore, TripTypeId } from "../../types/presentation";
import type { MetricKey, RegionMonthRecord, SuitabilityBand } from "../../types/weather";
import { COMFORT_PROFILES, getComfortProfileLabel, type ScoreRange } from "./comfortProfiles";
import { TRIP_TYPES, getTripTypeLabel } from "./tripTypes";

function scoreRange(value: number | null, range: ScoreRange, lowerIsBetter = false): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  if (lowerIsBetter) {
    if (value <= range.idealMax) {
      return 100;
    }

    if (value >= range.hardMax) {
      return 0;
    }

    return Math.max(0, Math.min(100, ((range.hardMax - value) / (range.hardMax - range.idealMax)) * 100));
  }

  if (value <= range.hardMin || value >= range.hardMax) {
    return 0;
  }

  if (value >= range.idealMin && value <= range.idealMax) {
    return 100;
  }

  if (value < range.idealMin) {
    return Math.max(0, Math.min(100, ((value - range.hardMin) / (range.idealMin - range.hardMin)) * 100));
  }

  return Math.max(0, Math.min(100, ((range.hardMax - value) / (range.hardMax - range.idealMax)) * 100));
}

function scoreLowerBetter(value: number | null, goodThreshold: number, badThreshold: number): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  if (value <= goodThreshold) {
    return 100;
  }

  if (value >= badThreshold) {
    return 0;
  }

  return Math.max(0, Math.min(100, ((badThreshold - value) / (badThreshold - goodThreshold)) * 100));
}

function scoreToBand(score: number): SuitabilityBand {
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

function scoreTripMetric(metric: MetricKey, value: number | null): number {
  switch (metric) {
    case "temperatureC":
      return scoreRange(value, {
        idealMin: 22,
        idealMax: 31,
        hardMin: 12,
        hardMax: 42,
      });
    case "rainfallMm":
      return scoreLowerBetter(value, 80, 350);
    case "uvIndex":
      return scoreRange(value, {
        idealMin: 4,
        idealMax: 9,
        hardMin: 0,
        hardMax: 13,
      });
    case "windKph":
      return scoreLowerBetter(value, 18, 50);
    case "humidityPct":
      return scoreLowerBetter(value, 70, 95);
    case "aqi":
      return scoreLowerBetter(value, 60, 220);
    case "pm25":
      return scoreLowerBetter(value, 15, 120);
    case "waveHeightM":
      return scoreRange(value, {
        idealMin: 0.8,
        idealMax: 2.2,
        hardMin: 0.2,
        hardMax: 5.5,
      });
    case "wavePeriodS":
      return scoreRange(value, {
        idealMin: 8,
        idealMax: 14,
        hardMin: 2,
        hardMax: 20,
      });
    case "waveDirectionDeg":
      return scoreRange(value, {
        idealMin: 0,
        idealMax: 360,
        hardMin: -1,
        hardMax: 361,
      });
    case "floodRisk":
    case "stormRisk":
      return scoreLowerBetter(value, 25, 90);
    default:
      return 0;
  }
}

function calculateComfortScore(record: RegionMonthRecord, comfortProfileId: ComfortProfileId): number {
  const profile = COMFORT_PROFILES[comfortProfileId];
  const temperatureScore = scoreRange(record.metrics.temperatureC.value, profile.temperature);
  const humidityScore = scoreRange(record.metrics.humidityPct.value, profile.humidity);
  const rainfallScore = scoreRange(record.metrics.rainfallMm.value, profile.rainfall, true);

  return Math.round(temperatureScore * 0.45 + humidityScore * 0.35 + rainfallScore * 0.2);
}

function calculateTripScore(record: RegionMonthRecord, tripTypeId: TripTypeId): number {
  const tripType = TRIP_TYPES[tripTypeId];
  const entries = Object.entries(tripType.weights) as Array<[MetricKey, number]>;

  const configuredWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  let weightedSum = 0;
  let availableWeight = 0;

  for (const [metric, weight] of entries) {
    if (weight <= 0) {
      continue;
    }

    const metricValue = record.metrics[metric];
    if (!metricValue || metricValue.value === null || metricValue.status !== "ok") {
      continue;
    }

    const metricScore = scoreTripMetric(metric, metricValue.value);
    weightedSum += metricScore * weight;
    availableWeight += weight;
  }

  if (availableWeight === 0 || configuredWeight === 0) {
    return 0;
  }

  const baseTripScore = weightedSum / availableWeight;
  const availabilityFactor = availableWeight / configuredWeight;

  return Math.round(baseTripScore * availabilityFactor);
}

function calculateConfidence(record: RegionMonthRecord, tripTypeId: TripTypeId): PersonalScore["confidence"] {
  if (tripTypeId === "surfVacation" && !record.region.isCoastal) {
    return "low";
  }

  const keyMetrics = TRIP_TYPES[tripTypeId].keyMetrics;
  const missingCount = keyMetrics.filter((metricKey) => {
    const metric = record.metrics[metricKey];
    return !metric || metric.value === null || metric.status !== "ok";
  }).length;

  if (missingCount === 0) {
    return "high";
  }

  if (missingCount === 1) {
    return "medium";
  }

  return "low";
}

export function calculatePersonalScore(
  record: RegionMonthRecord,
  comfortProfileId: ComfortProfileId,
  tripTypeId: TripTypeId,
): PersonalScore {
  const comfortScore = calculateComfortScore(record, comfortProfileId);
  const tripScore = calculateTripScore(record, tripTypeId);
  const score = Math.round(comfortScore * 0.4 + tripScore * 0.6);

  return {
    score,
    band: scoreToBand(score),
    comfortProfileId,
    tripTypeId,
    confidence: calculateConfidence(record, tripTypeId),
  };
}

export function getPersonalScoreReason(record: RegionMonthRecord, personalScore: PersonalScore): string {
  if (personalScore.tripTypeId === "surfVacation" && !record.region.isCoastal) {
    return "Surf persona on inland city: low confidence because coastal wave signals are not representative.";
  }

  return `Personal score tuned for ${getComfortProfileLabel(personalScore.comfortProfileId)} + ${getTripTypeLabel(personalScore.tripTypeId)}.`;
}

export { getComfortProfileLabel, getTripTypeLabel };
