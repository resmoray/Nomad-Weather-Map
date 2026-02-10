import { describe, expect, it } from "vitest";
import type { RegionMonthRecord } from "../../types/weather";
import { DEFAULT_PROFILE } from "./customProfile";
import { calculatePersonalScore } from "./presets";

const record: RegionMonthRecord = {
  region: {
    id: "vn-hanoi",
    countryCode: "VN",
    countryName: "Vietnam",
    regionName: "North",
    cityName: "Hanoi",
    lat: 21.0285,
    lon: 105.8542,
    cityIata: "HAN",
    destinationIata: "HAN",
    isCoastal: false,
  },
  month: 1,
  suitability: {
    score: 72,
    band: "Good",
    confidence: 0.9,
    breakdown: [],
  },
  metrics: {
    temperatureC: {
      value: 24,
      unit: "C",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    rainfallMm: {
      value: 55,
      unit: "mm",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    humidityPct: {
      value: 62,
      unit: "%",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    windKph: {
      value: 10,
      unit: "kph",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    uvIndex: {
      value: 5,
      unit: "index",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    pm25: {
      value: 11,
      unit: "ug/m3",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    aqi: {
      value: 35,
      unit: "index",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    waveHeightM: {
      value: 1.4,
      unit: "m",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    wavePeriodS: {
      value: 11,
      unit: "s",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    waveDirectionDeg: {
      value: 240,
      unit: "deg",
      status: "ok",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    floodRisk: {
      value: null,
      unit: "index",
      status: "missing",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
    stormRisk: {
      value: null,
      unit: "index",
      status: "missing",
      sourceName: "x",
      sourceUrl: "x",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
  },
};

describe("calculatePersonalScore", () => {
  it("returns bounded score, band and confidence", () => {
    const result = calculatePersonalScore(record, DEFAULT_PROFILE);

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(["Poor", "Fair", "Good", "Excellent"]).toContain(result.band);
    expect(["high", "medium", "low"]).toContain(result.confidence);
  });

  it("changes score across different custom profiles", () => {
    const scenarioRecord: RegionMonthRecord = {
      ...record,
      metrics: {
        ...record.metrics,
        uvIndex: { ...record.metrics.uvIndex, value: 8 },
        aqi: { ...record.metrics.aqi, value: 165 },
        pm25: { ...record.metrics.pm25, value: 78 },
      },
    };

    const airSensitive = calculatePersonalScore(scenarioRecord, {
      ...DEFAULT_PROFILE,
      airSensitivity: "sensitive",
      uvSensitivity: "sensitive",
      rainTolerance: "avoidRain",
    }).score;
    const airTolerant = calculatePersonalScore(scenarioRecord, {
      ...DEFAULT_PROFILE,
      airSensitivity: "tolerant",
      uvSensitivity: "tolerant",
      rainTolerance: "rainFlexible",
    }).score;

    expect(airSensitive).not.toBeNaN();
    expect(airTolerant).not.toBeNaN();
    expect(airSensitive).not.toBe(airTolerant);
  });

  it("forces low confidence for surf-enabled profile on inland regions", () => {
    const surf = calculatePersonalScore(record, { ...DEFAULT_PROFILE, surfEnabled: true });
    expect(surf.confidence).toBe("low");
  });

  it("applies preferred market and climate season to the personal score", () => {
    const profile = {
      ...DEFAULT_PROFILE,
      preferredMarketSeason: "high" as const,
      preferredClimateSeason: "high" as const,
    };

    const preferred = calculatePersonalScore(record, profile, {
      marketSeasonLabel: "high",
      climateSeasonLabel: "high",
    }).score;
    const mismatch = calculatePersonalScore(record, profile, {
      marketSeasonLabel: "off",
      climateSeasonLabel: "off",
    }).score;

    expect(preferred).toBeGreaterThan(mismatch);
  });
});
