import { describe, expect, it } from "vitest";
import type { RegionMonthRecord } from "../../types/weather";
import { DEFAULT_PROFILE } from "./customProfile";
import { evaluateDealbreakers } from "./dealbreakers";

function metric(value: number | null, unit: string) {
  return {
    value,
    unit,
    status: value === null ? ("missing" as const) : ("ok" as const),
    sourceName: "test",
    sourceUrl: "https://example.com",
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

const baseRecord: RegionMonthRecord = {
  region: {
    id: "vn-da-nang",
    countryCode: "VN",
    countryName: "Vietnam",
    regionName: "Central",
    cityName: "Da Nang",
    lat: 16.0544,
    lon: 108.2022,
    cityIata: "DAD",
    destinationIata: "DAD",
    isCoastal: true,
  },
  month: 2,
  suitability: {
    score: 80,
    band: "Excellent",
    confidence: 0.9,
    breakdown: [],
  },
  metrics: {
    temperatureC: metric(27, "C"),
    rainfallMm: metric(40, "mm"),
    humidityPct: metric(60, "%"),
    windKph: metric(15, "kph"),
    uvIndex: metric(6, "index"),
    pm25: metric(20, "ug/m3"),
    aqi: metric(60, "index"),
    waveHeightM: metric(1.1, "m"),
    wavePeriodS: metric(10, "s"),
    waveDirectionDeg: metric(220, "deg"),
    floodRisk: metric(null, "index"),
    stormRisk: metric(null, "index"),
  },
};

describe("evaluateDealbreakers", () => {
  it("passes when all active dealbreakers are satisfied", () => {
    const result = evaluateDealbreakers(baseRecord, {
      ...DEFAULT_PROFILE,
      dealbreakers: {
        avoidHeavyRain: true,
        avoidUnhealthyAir: true,
        avoidVeryHighUv: true,
        avoidStrongWind: true,
        coastalOnly: true,
      },
    });

    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("fails and reports missing metrics for active dealbreakers", () => {
    const result = evaluateDealbreakers(
      {
        ...baseRecord,
        metrics: {
          ...baseRecord.metrics,
          pm25: metric(null, "ug/m3"),
        },
      },
      {
        ...DEFAULT_PROFILE,
        dealbreakers: { ...DEFAULT_PROFILE.dealbreakers, avoidUnhealthyAir: true },
      },
    );

    expect(result.passed).toBe(false);
    expect(result.missingMetrics).toContain("pm25");
    expect(result.reasons.join(" ")).toContain("Missing PM2.5 data");
  });
});
