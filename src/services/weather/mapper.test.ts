import { describe, expect, it } from "vitest";
import { mapOpenMeteoSummaryToMetrics } from "./mapper";

describe("mapOpenMeteoSummaryToMetrics", () => {
  it("keeps flood and storm fields as null + missing", () => {
    const metrics = mapOpenMeteoSummaryToMetrics({
      temperatureC: 27.1,
      temperatureMinC: 23.2,
      temperatureMaxC: 31.7,
      rainfallMm: 120.4,
      humidityPct: 66,
      windKph: 11.2,
      uvIndex: 5.8,
      uvIndexMax: 8.9,
      pm25: 14,
      aqi: 48,
      waveHeightM: 1.3,
      waveHeightMinM: 0.7,
      waveHeightMaxM: 2.4,
      wavePeriodS: 9.8,
      waveDirectionDeg: 240,
      waterTempC: 24.6,
      climateLastUpdated: "2026-02-06T00:00:00.000Z",
      airQualityLastUpdated: "2026-02-06T00:00:00.000Z",
      marineLastUpdated: "2026-02-06T00:00:00.000Z",
    });

    expect(metrics.floodRisk.value).toBeNull();
    expect(metrics.floodRisk.status).toBe("missing");
    expect(metrics.stormRisk.value).toBeNull();
    expect(metrics.stormRisk.status).toBe("missing");
  });

  it("maps source metadata for weather + marine metrics", () => {
    const metrics = mapOpenMeteoSummaryToMetrics({
      temperatureC: 25,
      temperatureMinC: 21,
      temperatureMaxC: 29,
      rainfallMm: 90,
      humidityPct: 58,
      windKph: 10,
      uvIndex: 6,
      uvIndexMax: 9.2,
      pm25: 22,
      aqi: 73,
      waveHeightM: 1.4,
      waveHeightMinM: 0.8,
      waveHeightMaxM: 2.1,
      wavePeriodS: 10.1,
      waveDirectionDeg: 235,
      waterTempC: 25.1,
      climateLastUpdated: "2026-02-06T00:00:00.000Z",
      airQualityLastUpdated: "2026-02-06T00:00:00.000Z",
      marineLastUpdated: "2026-02-06T00:00:00.000Z",
    });

    expect(metrics.temperatureC.sourceName).toContain("Open-Meteo");
    expect(metrics.temperatureC.lastUpdated).toBe("2026-02-06T00:00:00.000Z");
    expect(metrics.waveHeightM.sourceName).toContain("Open-Meteo");
    expect(metrics.waveHeightM.lastUpdated).toBe("2026-02-06T00:00:00.000Z");
  });
});
