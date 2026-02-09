import type {
  MatrixMode,
  MatrixRowViewModel,
  MatrixViewModel,
  UserPreferenceProfile,
} from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { MetricKey, Month, RegionMonthRecord } from "../../types/weather";
import { formatDate, formatNumber } from "../../utils/format";
import { formatRegionLabel } from "../../utils/regionLabel";
import {
  METRIC_ROW_LABELS,
  METRIC_ROW_ORDER,
  METRIC_UNIT_HINTS,
  bandToSeverity,
  classifyMetric,
  metricToRowGroup,
  seasonToSeverity,
} from "./classifyMetric";
import { classifyClimateSeason } from "./classifyClimateSeason";
import { calculatePersonalScore, getPersonalScoreReason } from "./presets";

interface BuildMatrixInput {
  mode: MatrixMode;
  month: Month;
  monthRecords: RegionMonthRecord[];
  timelineRecords: RegionMonthRecord[];
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  profile: UserPreferenceProfile;
}

function personalScoreValue(
  record: RegionMonthRecord,
  profile: UserPreferenceProfile,
  seasonByRegion: Record<string, SeasonSignalByMonth>,
): number {
  const climateSeasonLabel = classifyClimateSeason(record).label;
  const marketSeasonLabel = seasonByRegion[record.region.id]?.[record.month]?.seasonLabel ?? climateSeasonLabel;

  return calculatePersonalScore(record, profile, {
    marketSeasonLabel,
    climateSeasonLabel,
  }).score;
}

function shortSeasonLabel(label: "high" | "shoulder" | "off"): "high" | "shoulder" | "low" {
  return label === "off" ? "low" : label;
}

function emptyMatrix(): MatrixViewModel {
  return {
    columns: [],
    rows: [],
  };
}

function metricValueText(record: RegionMonthRecord, metric: MetricKey): string {
  const metricValue = record.metrics[metric];
  if (metricValue.value === null) {
    return "No data";
  }

  return `${formatNumber(metricValue.value)} ${metricValue.unit}`;
}

function seasonCell(
  regionId: string,
  month: Month,
  seasonByRegion: Record<string, SeasonSignalByMonth>,
): MatrixRowViewModel["cells"][number] {
  const signal = seasonByRegion[regionId]?.[month];

  if (!signal) {
    return {
      key: `season-${regionId}-${month}`,
      label: "No data",
      valueText: "No live signal",
      severity: "missing",
      icon: "info",
      reason: "Season service unavailable. Start backend proxy to enrich this row.",
      sourceName: "Season service",
      sourceUrl: "",
      lastUpdated: "",
      confidenceText: "low confidence",
      tooltipText: "No market season signal available.",
    };
  }

  const source = signal.sources[0] ?? {
    name: "Season source",
    url: "",
    lastUpdated: new Date().toISOString(),
  };

  return {
    key: `season-${regionId}-${month}`,
    label: shortSeasonLabel(signal.seasonLabel),
    valueText: "",
    severity: seasonToSeverity(signal.seasonLabel),
    icon: signal.seasonLabel === "high" ? "arrow-up" : signal.seasonLabel === "off" ? "arrow-down" : "equal",
    reason: signal.reasonText,
    sourceName: source.name,
    sourceUrl: source.url,
    lastUpdated: source.lastUpdated,
    confidenceText: `${signal.confidence} confidence (${signal.marketConfidenceSource})`,
    seasonLabel: signal.seasonLabel,
    seasonConfidence: signal.confidence,
    marketConfidenceSource: signal.marketConfidenceSource,
    isPriceFallback: signal.isPriceFallback,
    isCrowdFallback: signal.isCrowdFallback,
    seasonSources: signal.sources,
    tooltipText: `${shortSeasonLabel(signal.seasonLabel)} season. ${signal.reasonText}`,
  };
}

function climateSeasonCell(record: RegionMonthRecord): MatrixRowViewModel["cells"][number] {
  const climate = classifyClimateSeason(record);

  return {
    key: `climate-season-${record.region.id}-${record.month}`,
    label: shortSeasonLabel(climate.label),
    valueText: "",
    severity: climate.severity,
    icon: climate.label === "high" ? "sun" : climate.label === "off" ? "rain" : "equal",
    reason: climate.reason,
    sourceName: "Nomad Weather Map fixed season catalog",
    sourceUrl: "",
    lastUpdated: new Date().toISOString(),
    tooltipText: `${shortSeasonLabel(climate.label)} climate season. ${climate.reason}`,
  };
}

function personalCell(
  record: RegionMonthRecord,
  profile: UserPreferenceProfile,
  seasonByRegion: Record<string, SeasonSignalByMonth>,
): MatrixRowViewModel["cells"][number] {
  const climateSeasonLabel = classifyClimateSeason(record).label;
  const marketSeasonLabel = seasonByRegion[record.region.id]?.[record.month]?.seasonLabel ?? climateSeasonLabel;
  const personal = calculatePersonalScore(record, profile, {
    marketSeasonLabel,
    climateSeasonLabel,
  });
  const missingMetrics = personal.confidenceDetails.missingMetrics;
  const missingDetails =
    missingMetrics.length > 0 ? ` • missing: ${missingMetrics.map((metric) => METRIC_ROW_LABELS[metric]).join(", ")}` : "";

  return {
    key: `personal-${record.region.id}-${record.month}`,
    label: personal.band,
    valueText: `${personal.score}`,
    severity: bandToSeverity(personal.band),
    icon: "user",
    reason: getPersonalScoreReason(record, personal),
    sourceName: "Nomad Weather Map persona scoring",
    sourceUrl: "",
    lastUpdated: new Date().toISOString(),
    confidenceText: `${personal.confidence} confidence${missingDetails}`,
    personalDrivers: personal.drivers,
    personalWarnings: personal.warnings,
    confidenceDetails: personal.confidenceDetails,
    tooltipText: `${personal.band} ${personal.score} (${personal.confidence} confidence)${missingDetails}`,
  };
}

function metricCell(record: RegionMonthRecord, metric: MetricKey): MatrixRowViewModel["cells"][number] {
  const metricValue = record.metrics[metric];
  const assessment = classifyMetric(metric, metricValue);
  const temperatureProfile = record.temperatureProfile;

  const valueText =
    metric === "temperatureC" &&
    temperatureProfile &&
    temperatureProfile.minC !== null &&
    temperatureProfile.avgC !== null &&
    temperatureProfile.maxC !== null
      ? `${formatNumber(temperatureProfile.minC)} / ${formatNumber(
          temperatureProfile.avgC,
        )} / ${formatNumber(temperatureProfile.maxC)} C`
      : metricValue.value === null
        ? "No data"
        : metricValueText(record, metric);

  return {
    key: `${metric}-${record.region.id}-${record.month}`,
    label: assessment.label,
    valueText,
    severity: assessment.severity,
    icon: assessment.icon,
    reason: assessment.reason,
    sourceName: metricValue.sourceName,
    sourceUrl: metricValue.sourceUrl,
    lastUpdated: formatDate(metricValue.lastUpdated),
    tooltipText: `${assessment.label}${valueText ? ` • ${valueText}` : ""} • ${assessment.reason}`,
  };
}

function toRows(
  records: RegionMonthRecord[],
  seasonByRegion: Record<string, SeasonSignalByMonth>,
  profile: UserPreferenceProfile,
): MatrixRowViewModel[] {
  const marketSeasonRow: MatrixRowViewModel = {
    key: "marketSeason",
    label: "Market season",
    group: "seasons",
    cells: records.map((record) => seasonCell(record.region.id, record.month, seasonByRegion)),
  };

  const climateSeasonRow: MatrixRowViewModel = {
    key: "climateSeason",
    label: "Climate season",
    group: "seasons",
    cells: records.map((record) => climateSeasonCell(record)),
  };

  const personalRow: MatrixRowViewModel = {
    key: "personal",
    label: "Personal",
    group: "seasons",
    cells: records.map((record) => personalCell(record, profile, seasonByRegion)),
  };

  const allowedMetrics = METRIC_ROW_ORDER;

  const metricRows = allowedMetrics.map<MatrixRowViewModel>((metric) => ({
    key: metric,
    label: METRIC_ROW_LABELS[metric],
    group: metricToRowGroup(metric),
    unitHint: METRIC_UNIT_HINTS[metric],
    cells: records.map((record) => metricCell(record, metric)),
  }));

  return [marketSeasonRow, climateSeasonRow, personalRow, ...metricRows];
}

export function buildMatrixViewModel(input: BuildMatrixInput): MatrixViewModel {
  if (input.mode === "timeline") {
    if (input.timelineRecords.length === 0) {
      return emptyMatrix();
    }

    const columns = input.timelineRecords.map((record) => ({
      key: `${record.region.id}-${record.month}`,
      title: new Date(Date.UTC(2026, record.month - 1, 1)).toLocaleString("en-US", { month: "short" }),
      subtitle: formatRegionLabel(record.region),
      month: record.month,
      regionId: record.region.id,
      personalScore: personalScoreValue(record, input.profile, input.seasonByRegion),
    }));

    return {
      columns,
      rows: toRows(input.timelineRecords, input.seasonByRegion, input.profile),
    };
  }

  if (input.monthRecords.length === 0) {
    return emptyMatrix();
  }

  const sorted = [...input.monthRecords].sort((left, right) => {
    const leftPersonal = personalScoreValue(left, input.profile, input.seasonByRegion);
    const rightPersonal = personalScoreValue(right, input.profile, input.seasonByRegion);
    return rightPersonal - leftPersonal;
  });

  const columns = sorted.map((record) => ({
    key: `${record.region.id}-${record.month}`,
    title: record.region.cityName,
    subtitle: `${record.region.countryCode} • ${record.region.regionName} • ${new Date(
      Date.UTC(2026, input.month - 1, 1),
    ).toLocaleString("en-US", { month: "short" })}`,
    month: record.month,
    regionId: record.region.id,
    personalScore: personalScoreValue(record, input.profile, input.seasonByRegion),
  }));

  return {
    columns,
    rows: toRows(sorted, input.seasonByRegion, input.profile),
  };
}
