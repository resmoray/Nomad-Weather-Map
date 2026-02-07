import { describe, expect, it } from "vitest";
import type { MonthlyMetrics } from "../../types/weather";
import { calculateSuitability } from "./calculateSuitability";

function metric(value: number | null) {
  return {
    value,
    unit: "x",
    status: value === null ? ("missing" as const) : ("ok" as const),
    sourceName: "test",
    sourceUrl: "https://example.com",
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

function makeMetrics(overrides?: Partial<MonthlyMetrics>): MonthlyMetrics {
  const base: MonthlyMetrics = {
    temperatureC: metric(26),
    rainfallMm: metric(80),
    humidityPct: metric(60),
    windKph: metric(14),
    uvIndex: metric(5),
    pm25: metric(12),
    aqi: metric(42),
    waveHeightM: metric(1.2),
    wavePeriodS: metric(10),
    waveDirectionDeg: metric(230),
    floodRisk: metric(null),
    stormRisk: metric(null),
  };

  return {
    ...base,
    ...overrides,
  };
}

describe("calculateSuitability", () => {
  it("returns Good/Excellent score for favorable metrics", () => {
    const result = calculateSuitability(makeMetrics());

    expect(result.score).toBeGreaterThan(70);
    expect(["Good", "Excellent"]).toContain(result.band);
    expect(result.confidence).toBe(1);
  });

  it("returns Poor for clearly bad metrics", () => {
    const result = calculateSuitability(
      makeMetrics({
        temperatureC: metric(41),
        rainfallMm: metric(420),
        humidityPct: metric(95),
        windKph: metric(55),
        uvIndex: metric(12),
        pm25: metric(140),
        aqi: metric(260),
      }),
    );

    expect(result.score).toBeLessThan(35);
    expect(result.band).toBe("Poor");
  });

  it("reduces confidence and score when many metrics are missing", () => {
    const result = calculateSuitability(
      makeMetrics({
        temperatureC: metric(null),
        rainfallMm: metric(null),
        humidityPct: metric(null),
        windKph: metric(null),
      }),
    );

    expect(result.confidence).toBeLessThan(0.6);
    expect(result.score).toBeLessThan(55);
  });
});
