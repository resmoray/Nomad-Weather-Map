import type { MetricKey, RegionMonthRecord, SuitabilityBand } from "../../types/weather";
import type { PersonalDriver, UserPreferenceProfile, PersonalScore } from "../../types/presentation";
import type { SeasonLabel } from "../../types/season";
import { buildThresholdConfig } from "./customProfile";

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function scoreRange(
  value: number | null,
  config: { idealMin: number; idealMax: number; hardMin: number; hardMax: number },
): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  if (value <= config.hardMin || value >= config.hardMax) {
    return 0;
  }

  if (value >= config.idealMin && value <= config.idealMax) {
    return 100;
  }

  if (value < config.idealMin) {
    return clamp(((value - config.hardMin) / (config.idealMin - config.hardMin)) * 100);
  }

  return clamp(((config.hardMax - value) / (config.hardMax - config.idealMax)) * 100);
}

function scoreLowerBetter(
  value: number | null,
  config: { goodThreshold: number; badThreshold: number },
): number {
  if (value === null || Number.isNaN(value)) {
    return 0;
  }

  if (value <= config.goodThreshold) {
    return 100;
  }

  if (value >= config.badThreshold) {
    return 0;
  }

  return clamp(((config.badThreshold - value) / (config.badThreshold - config.goodThreshold)) * 100);
}

function scoreBand(score: number): SuitabilityBand {
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

function metricReason(metric: MetricKey): string {
  switch (metric) {
    case "temperatureC":
      return "Temperature comfort fit";
    case "humidityPct":
      return "Humidity comfort fit";
    case "rainfallMm":
      return "Rain tolerance fit";
    case "pm25":
      return "Fine-particle air impact";
    case "aqi":
      return "Overall air-quality impact";
    case "uvIndex":
      return "UV exposure impact";
    case "windKph":
      return "Wind impact";
    case "waveHeightM":
      return "Wave height quality";
    case "wavePeriodS":
      return "Wave period quality";
    default:
      return "Metric impact";
  }
}

function buildWarnings(
  record: RegionMonthRecord,
  weightedByMetric: Partial<Record<MetricKey, number>>,
): string[] {
  const warnings: string[] = [];

  const pm25 = weightedByMetric.pm25 ?? 50;
  const aqi = weightedByMetric.aqi ?? 50;
  const uv = weightedByMetric.uvIndex ?? 50;
  const rain = weightedByMetric.rainfallMm ?? 50;

  if (pm25 < 35 || aqi < 35) {
    warnings.push("Air quality may be unhealthy on many days.");
  }

  if (uv < 35) {
    warnings.push("UV exposure is likely strong; midday caution recommended.");
  }

  if (rain < 35) {
    warnings.push("Rainfall is high and may disrupt outdoor plans.");
  }

  if (record.metrics.windKph.value !== null && record.metrics.windKph.value > 35) {
    warnings.push("Strong winds may reduce comfort for some activities.");
  }

  return warnings;
}

function buildMetricWeights(profile: UserPreferenceProfile): Partial<Record<MetricKey, number>> {
  const base: Partial<Record<MetricKey, number>> = {
    temperatureC: 24,
    humidityPct: 14,
    rainfallMm: 18,
    pm25: 14,
    aqi: 12,
    uvIndex: 10,
    windKph: 8,
  };

  if (profile.surfEnabled) {
    base.waveHeightM = 18;
    base.wavePeriodS = 14;
    base.windKph = 10;
    base.temperatureC = 18;
    base.rainfallMm = 12;
    base.uvIndex = 8;
    base.humidityPct = 8;
    base.pm25 = 7;
    base.aqi = 5;
  }

  if (profile.tempPreference === "noPreference") {
    base.temperatureC = 0;
  }

  if (profile.humidityPreference === "noPreference") {
    base.humidityPct = 0;
  }

  if (profile.rainTolerance === "noPreference") {
    base.rainfallMm = 0;
  }

  if (profile.airSensitivity === "noPreference") {
    base.pm25 = 0;
    base.aqi = 0;
  }

  if (profile.uvSensitivity === "noPreference") {
    base.uvIndex = 0;
  }

  return base;
}

interface SeasonPreferenceInput {
  marketSeasonLabel?: SeasonLabel | null;
  climateSeasonLabel?: "high" | "shoulder" | "off" | null;
}

function normalizeSeasonLabel(
  label: SeasonLabel | "off" | null | undefined,
): "low" | "shoulder" | "high" | null {
  if (!label) {
    return null;
  }

  if (label === "off") {
    return "low";
  }

  return label;
}

function preferenceDelta(
  preference: UserPreferenceProfile["preferredMarketSeason"],
  actualLabel: "low" | "shoulder" | "high" | null,
): number {
  if (preference === "noPreference" || actualLabel === null) {
    return 0;
  }

  if (preference === actualLabel) {
    return 6;
  }

  if (preference === "shoulder" || actualLabel === "shoulder") {
    return -2;
  }

  return -4;
}

export function calculatePersonalScore(
  record: RegionMonthRecord,
  profile: UserPreferenceProfile,
  seasonInput?: SeasonPreferenceInput,
): PersonalScore {
  const threshold = buildThresholdConfig(profile);
  const weights = buildMetricWeights(profile);
  const configuredEntries = Object.entries(weights).filter(([, weight]) => (weight ?? 0) > 0) as Array<
    [MetricKey, number]
  >;

  const metricScoreByKey: Partial<Record<MetricKey, number>> = {};
  const missingMetrics: MetricKey[] = [];
  const drivers: PersonalDriver[] = [];

  let weightedSum = 0;
  let availableWeight = 0;
  let configuredWeight = 0;

  for (const [metric, weight] of configuredEntries) {
    configuredWeight += weight;

    const metricValue = record.metrics[metric];
    if (!metricValue || metricValue.status !== "ok" || metricValue.value === null) {
      missingMetrics.push(metric);
      continue;
    }

    let metricScore = 50;
    switch (metric) {
      case "temperatureC":
        metricScore = scoreRange(metricValue.value, threshold.temperature);
        break;
      case "humidityPct":
        metricScore = scoreRange(metricValue.value, threshold.humidity);
        break;
      case "rainfallMm":
        metricScore = scoreLowerBetter(metricValue.value, threshold.rainfall);
        break;
      case "pm25":
        metricScore = scoreLowerBetter(metricValue.value, threshold.pm25);
        break;
      case "aqi":
        metricScore = scoreLowerBetter(metricValue.value, threshold.aqi);
        break;
      case "uvIndex":
        metricScore = scoreLowerBetter(metricValue.value, threshold.uvIndex);
        break;
      case "windKph":
        metricScore = scoreLowerBetter(metricValue.value, { goodThreshold: 15, badThreshold: 55 });
        break;
      case "waveHeightM":
        metricScore = scoreRange(metricValue.value, {
          idealMin: 0.8,
          idealMax: 2.2,
          hardMin: 0.2,
          hardMax: 5.5,
        });
        break;
      case "wavePeriodS":
        metricScore = scoreRange(metricValue.value, {
          idealMin: 8,
          idealMax: 14,
          hardMin: 2,
          hardMax: 20,
        });
        break;
      default:
        metricScore = 50;
    }

    metricScoreByKey[metric] = metricScore;
    weightedSum += metricScore * weight;
    availableWeight += weight;

    const contribution = Number((((metricScore - 50) * weight) / 100).toFixed(2));
    if (contribution !== 0) {
      drivers.push({
        metric,
        contribution,
        direction: contribution > 0 ? "positive" : "negative",
        reason: metricReason(metric),
      });
    }
  }

  const baseScore = availableWeight > 0 ? weightedSum / availableWeight : 0;
  const coverage = configuredWeight > 0 ? availableWeight / configuredWeight : 0;
  const confidenceAdjustedScore = Math.round(baseScore * coverage);
  const marketSeasonDelta = preferenceDelta(
    profile.preferredMarketSeason,
    normalizeSeasonLabel(seasonInput?.marketSeasonLabel),
  );
  const climateSeasonDelta = preferenceDelta(
    profile.preferredClimateSeason,
    normalizeSeasonLabel(seasonInput?.climateSeasonLabel),
  );
  const seasonAdjustedScore = clamp(confidenceAdjustedScore + marketSeasonDelta + climateSeasonDelta);
  const warnings = buildWarnings(record, metricScoreByKey);
  const sortedDrivers = [...drivers].sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));

  let confidenceLevel: PersonalScore["confidence"] = "low";
  if (coverage >= 0.85) {
    confidenceLevel = "high";
  } else if (coverage >= 0.55) {
    confidenceLevel = "medium";
  }

  let confidenceReason = "Some configured metrics are missing.";
  if (confidenceLevel === "high") {
    confidenceReason = "Most configured metrics are available.";
  } else if (confidenceLevel === "medium") {
    confidenceReason = "A moderate number of configured metrics are available.";
  }

  if (profile.surfEnabled && !record.region.isCoastal) {
    confidenceLevel = "low";
    confidenceReason = "Surf mode is enabled on an inland region; wave data is not representative.";
  }

  if (marketSeasonDelta < 0) {
    warnings.push("Current month does not match your preferred market season.");
  }
  if (climateSeasonDelta < 0) {
    warnings.push("Current month does not match your preferred climate season.");
  }

  return {
    score: seasonAdjustedScore,
    band: scoreBand(seasonAdjustedScore),
    confidence: confidenceLevel,
    confidenceDetails: {
      level: confidenceLevel,
      coverage: Number(coverage.toFixed(2)),
      missingMetrics,
      reason: confidenceReason,
    },
    drivers: sortedDrivers.slice(0, 6),
    warnings,
    profile,
  };
}

export function getPersonalScoreReason(record: RegionMonthRecord, personalScore: PersonalScore): string {
  if (personalScore.profile.surfEnabled && !record.region.isCoastal) {
    return "Surf mode is on, but this is not a coastal region.";
  }

  const strongest = personalScore.drivers[0];
  if (!strongest) {
    return "Personal score based on available profile metrics.";
  }

  return `${strongest.reason} is the strongest ${strongest.direction} factor.`;
}
