import type {
  ComfortProfileId,
  MatrixMode,
  MatrixRowViewModel,
  MatrixViewModel,
  TripTypeId,
} from "../../types/presentation";
import type { SeasonSignalByMonth } from "../../types/season";
import type { MetricKey, Month, RegionMonthRecord } from "../../types/weather";
import { formatDate, formatNumber } from "../../utils/format";
import { formatRegionLabel } from "../../utils/regionLabel";
import {
  METRIC_ROW_LABELS,
  METRIC_ROW_ORDER,
  bandToSeverity,
  classifyMetric,
  seasonToSeverity,
} from "./classifyMetric";
import { classifyClimateSeason } from "./classifyClimateSeason";
import {
  calculatePersonalScore,
  getPersonalScoreReason,
} from "./presets";

interface BuildMatrixInput {
  mode: MatrixMode;
  month: Month;
  monthRecords: RegionMonthRecord[];
  timelineRecords: RegionMonthRecord[];
  seasonByRegion: Record<string, SeasonSignalByMonth>;
  comfortProfileId: ComfortProfileId;
  tripTypeId: TripTypeId;
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
  };
}

function personalCell(
  record: RegionMonthRecord,
  comfortProfileId: ComfortProfileId,
  tripTypeId: TripTypeId,
): MatrixRowViewModel["cells"][number] {
  const personal = calculatePersonalScore(record, comfortProfileId, tripTypeId);

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
    confidenceText: `${personal.confidence} confidence`,
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
  };
}

function toRows(
  records: RegionMonthRecord[],
  seasonByRegion: Record<string, SeasonSignalByMonth>,
  comfortProfileId: ComfortProfileId,
  tripTypeId: TripTypeId,
): MatrixRowViewModel[] {
  const marketSeasonRow: MatrixRowViewModel = {
    key: "marketSeason",
    label: "Market season",
    cells: records.map((record) => seasonCell(record.region.id, record.month, seasonByRegion)),
  };

  const climateSeasonRow: MatrixRowViewModel = {
    key: "climateSeason",
    label: "Climate season",
    cells: records.map((record) => climateSeasonCell(record)),
  };

  const personalRow: MatrixRowViewModel = {
    key: "personal",
    label: "Personal",
    cells: records.map((record) => personalCell(record, comfortProfileId, tripTypeId)),
  };

  const metricRows = METRIC_ROW_ORDER.map<MatrixRowViewModel>((metric) => ({
    key: metric,
    label: METRIC_ROW_LABELS[metric],
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
    }));

    return {
      columns,
      rows: toRows(input.timelineRecords, input.seasonByRegion, input.comfortProfileId, input.tripTypeId),
    };
  }

  if (input.monthRecords.length === 0) {
    return emptyMatrix();
  }

  const sorted = [...input.monthRecords].sort((left, right) => {
    const leftPersonal = calculatePersonalScore(left, input.comfortProfileId, input.tripTypeId).score;
    const rightPersonal = calculatePersonalScore(right, input.comfortProfileId, input.tripTypeId).score;
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
  }));

  return {
    columns,
    rows: toRows(sorted, input.seasonByRegion, input.comfortProfileId, input.tripTypeId),
  };
}
