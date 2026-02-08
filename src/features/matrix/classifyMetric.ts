import type { MetricKey, MetricValue, SuitabilityBand } from "../../types/weather";
import type { CellSeverity, MetricAssessment, MatrixRowGroup } from "../../types/presentation";
import type { SeasonLabel } from "../../types/season";

export const METRIC_ROW_ORDER: MetricKey[] = [
  "temperatureC",
  "humidityPct",
  "rainfallMm",
  "windKph",
  "waveHeightM",
  "wavePeriodS",
  "waveDirectionDeg",
  "uvIndex",
  "pm25",
  "aqi",
];

export const METRIC_ROW_LABELS: Record<MetricKey, string> = {
  temperatureC: "Temp (min/avg/max, C)",
  humidityPct: "Humidity (%)",
  rainfallMm: "Rain (mm)",
  windKph: "Wind (kph)",
  waveHeightM: "Wave height (m)",
  wavePeriodS: "Wave period (s)",
  waveDirectionDeg: "Wave direction (deg)",
  uvIndex: "UV (index)",
  pm25: "PM2.5 (ug/m3)",
  aqi: "Air quality (AQI)",
  floodRisk: "Flood risk",
  stormRisk: "Storm risk",
};

export const METRIC_UNIT_HINTS: Partial<Record<MetricKey, string>> = {
  temperatureC: "C",
  humidityPct: "%",
  rainfallMm: "mm",
  windKph: "kph",
  waveHeightM: "m",
  wavePeriodS: "s",
  waveDirectionDeg: "deg",
  uvIndex: "index",
  pm25: "ug/m3",
  aqi: "index",
};

export const ROW_GROUP_LABELS: Record<MatrixRowGroup, string> = {
  seasons: "Seasons & Personal",
  comfort: "Comfort",
  air: "Air & UV",
  surf: "Surf",
};

export function metricToRowGroup(metric: MetricKey): MatrixRowGroup {
  if (metric === "waveHeightM" || metric === "wavePeriodS" || metric === "waveDirectionDeg") {
    return "surf";
  }

  if (metric === "uvIndex" || metric === "pm25" || metric === "aqi") {
    return "air";
  }

  return "comfort";
}

function createAssessment(
  label: string,
  severity: CellSeverity,
  reason: string,
  icon: string,
): MetricAssessment {
  return {
    label,
    severity,
    reason,
    icon,
  };
}

function classifyTemperature(value: number): MetricAssessment {
  if (value <= 16) {
    return createAssessment("Cool", "good", "Cooler month conditions.", "snow");
  }

  if (value <= 24) {
    return createAssessment("Comfortable", "excellent", "Comfort zone for most travelers.", "leaf");
  }

  if (value <= 30) {
    return createAssessment("Warm", "good", "Warm but usually manageable.", "sun");
  }

  if (value <= 35) {
    return createAssessment("Hot", "caution", "Heat can reduce daytime comfort.", "sun");
  }

  return createAssessment("Scorching", "extreme", "Very hot month with heat stress risk.", "fire");
}

function classifyHumidity(value: number): MetricAssessment {
  if (value < 45) {
    return createAssessment("Dry", "good", "Lower moisture in the air.", "drop");
  }

  if (value <= 65) {
    return createAssessment("Comfy", "excellent", "Comfortable humidity band.", "leaf");
  }

  if (value <= 75) {
    return createAssessment("Humid", "caution", "Humidity is noticeable.", "drop");
  }

  return createAssessment("Sweaty", "bad", "Very humid conditions feel sticky.", "drop");
}

function classifyRain(value: number): MetricAssessment {
  if (value < 25) {
    return createAssessment("Not rainy", "excellent", "Mostly dry month.", "sun");
  }

  if (value <= 75) {
    return createAssessment("Light rain", "good", "Some rain, still travel friendly.", "cloud");
  }

  if (value <= 150) {
    return createAssessment("Rainy", "caution", "Frequent rain days likely.", "rain");
  }

  return createAssessment("Very rainy", "bad", "Heavy rainfall month.", "rain");
}

function classifyWind(value: number): MetricAssessment {
  if (value < 10) {
    return createAssessment("Calm", "good", "Low wind levels.", "wind");
  }

  if (value <= 20) {
    return createAssessment("Breezy", "good", "Pleasant breeze.", "wind");
  }

  if (value <= 35) {
    return createAssessment("Windy", "caution", "Can affect outdoor comfort.", "wind");
  }

  return createAssessment("Very windy", "bad", "Strong winds expected.", "wind");
}

function classifyWaveHeight(value: number): MetricAssessment {
  if (value < 0.5) {
    return createAssessment("Flat", "caution", "Small waves. Limited surf energy.", "wave");
  }

  if (value <= 1.5) {
    return createAssessment("Rideable", "good", "Moderate wave height for many surfers.", "wave");
  }

  if (value <= 3) {
    return createAssessment("Strong", "caution", "Powerful waves. Better for experienced surfers.", "wave");
  }

  return createAssessment("Heavy", "bad", "Very large waves with higher risk.", "wave");
}

function classifyWavePeriod(value: number): MetricAssessment {
  if (value < 6) {
    return createAssessment("Short", "caution", "Weaker surf period.", "wave");
  }

  if (value <= 10) {
    return createAssessment("Fair", "good", "Usable period for many sessions.", "wave");
  }

  if (value <= 14) {
    return createAssessment("Powerful", "excellent", "Longer period usually means stronger wave quality.", "wave");
  }

  return createAssessment("Long", "caution", "Long period swell can be very strong at exposed breaks.", "wave");
}

function classifyWaveDirection(value: number): MetricAssessment {
  return createAssessment(
    `${Math.round(value)}°`,
    "good",
    "Wave direction is context data. Exact quality depends on local coastline orientation.",
    "compass",
  );
}

function classifyUv(value: number): MetricAssessment {
  if (value <= 2) {
    return createAssessment("Low", "excellent", "Low UV exposure risk.", "shield");
  }

  if (value <= 5) {
    return createAssessment("Moderate", "good", "Basic sun protection recommended.", "shield");
  }

  if (value <= 7) {
    return createAssessment("High", "caution", "Sun protection is important.", "shield");
  }

  if (value <= 10) {
    return createAssessment("Very high", "bad", "Strong UV. Limit midday exposure.", "shield");
  }

  return createAssessment("Extreme", "extreme", "Extreme UV exposure risk.", "shield");
}

function classifyPm25(value: number): MetricAssessment {
  if (value <= 12) {
    return createAssessment("Clean", "excellent", "Very good fine-particle air quality.", "leaf");
  }

  if (value <= 35.4) {
    return createAssessment("Moderate", "good", "Acceptable air quality for most users.", "leaf");
  }

  if (value <= 55.4) {
    return createAssessment("Sensitive groups", "caution", "Sensitive groups may be affected.", "mask");
  }

  if (value <= 150.4) {
    return createAssessment("Unhealthy", "bad", "Air quality can affect many travelers.", "mask");
  }

  return createAssessment("Very unhealthy", "extreme", "High PM2.5 pollution risk.", "mask");
}

function classifyAqi(value: number): MetricAssessment {
  if (value <= 50) {
    return createAssessment("Good", "excellent", "Healthy AQI range.", "leaf");
  }

  if (value <= 100) {
    return createAssessment("Moderate", "good", "Generally acceptable AQI.", "leaf");
  }

  if (value <= 150) {
    return createAssessment("Sensitive groups", "caution", "Sensitive groups may notice symptoms.", "mask");
  }

  if (value <= 200) {
    return createAssessment("Unhealthy", "bad", "Unhealthy AQI level.", "mask");
  }

  return createAssessment("Very unhealthy", "extreme", "Very unhealthy AQI level.", "mask");
}

function classifyRisk(value: number): MetricAssessment {
  if (value <= 25) {
    return createAssessment("Low", "excellent", "Low risk level.", "shield");
  }

  if (value <= 50) {
    return createAssessment("Moderate", "good", "Moderate risk level.", "shield");
  }

  if (value <= 75) {
    return createAssessment("High", "caution", "High risk level.", "alert");
  }

  return createAssessment("Severe", "bad", "Severe risk level.", "alert");
}

export function classifyMetric(metricKey: MetricKey, metric: MetricValue): MetricAssessment {
  if (metric.value === null || metric.status !== "ok") {
    return createAssessment("No data", "missing", "Metric currently unavailable.", "info");
  }

  switch (metricKey) {
    case "temperatureC":
      return classifyTemperature(metric.value);
    case "humidityPct":
      return classifyHumidity(metric.value);
    case "rainfallMm":
      return classifyRain(metric.value);
    case "windKph":
      return classifyWind(metric.value);
    case "waveHeightM":
      return classifyWaveHeight(metric.value);
    case "wavePeriodS":
      return classifyWavePeriod(metric.value);
    case "waveDirectionDeg":
      return classifyWaveDirection(metric.value);
    case "uvIndex":
      return classifyUv(metric.value);
    case "pm25":
      return classifyPm25(metric.value);
    case "aqi":
      return classifyAqi(metric.value);
    case "floodRisk":
    case "stormRisk":
      return classifyRisk(metric.value);
    default:
      return createAssessment("Unknown", "missing", "Metric mapping is unavailable.", "info");
  }
}

export function bandToSeverity(band: SuitabilityBand): CellSeverity {
  switch (band) {
    case "Excellent":
      return "excellent";
    case "Good":
      return "good";
    case "Fair":
      return "caution";
    case "Poor":
      return "bad";
    default:
      return "missing";
  }
}

export function seasonToSeverity(label: SeasonLabel): CellSeverity {
  switch (label) {
    case "high":
      return "bad";
    case "shoulder":
      return "good";
    case "off":
      return "caution";
    default:
      return "missing";
  }
}

export function seasonLabelText(label: SeasonLabel): string {
  switch (label) {
    case "high":
      return "Market high season";
    case "shoulder":
      return "Market shoulder";
    case "off":
      return "Market off season";
    default:
      return "Unknown";
  }
}
