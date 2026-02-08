import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../matrix/customProfile";
import { buildTopPicks } from "./buildTopPicks";
import type { RegionMonthRecord } from "../../types/weather";

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

const strongRecord: RegionMonthRecord = {
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
  month: 3,
  suitability: {
    score: 80,
    band: "Excellent",
    confidence: 0.9,
    breakdown: [],
  },
  metrics: {
    temperatureC: metric(27, "C"),
    rainfallMm: metric(45, "mm"),
    humidityPct: metric(58, "%"),
    windKph: metric(12, "kph"),
    uvIndex: metric(5, "index"),
    pm25: metric(12, "ug/m3"),
    aqi: metric(45, "index"),
    waveHeightM: metric(1.4, "m"),
    wavePeriodS: metric(10, "s"),
    waveDirectionDeg: metric(220, "deg"),
    floodRisk: metric(null, "index"),
    stormRisk: metric(null, "index"),
  },
};

const weakRecord: RegionMonthRecord = {
  ...strongRecord,
  region: {
    ...strongRecord.region,
    id: "vn-hanoi",
    cityName: "Hanoi",
    lat: 21.0285,
    lon: 105.8542,
    isCoastal: false,
  },
  metrics: {
    ...strongRecord.metrics,
    rainfallMm: metric(320, "mm"),
    pm25: metric(120, "ug/m3"),
    aqi: metric(190, "index"),
    uvIndex: metric(10, "index"),
  },
};

describe("buildTopPicks", () => {
  it("ranks higher-scoring records first and returns reasons", () => {
    const picks = buildTopPicks({
      records: [weakRecord, strongRecord],
      profile: DEFAULT_PROFILE,
      seasonByRegion: {},
      maxPicks: 3,
    });

    expect(picks).toHaveLength(2);
    expect(picks[0]?.regionId).toBe("vn-da-nang");
    expect(picks[0]?.displayName).toBe("Da Nang, Vietnam");
    expect(picks[0]?.score).toBeGreaterThanOrEqual(picks[1]?.score ?? 0);
    expect(picks[0]?.reasons.length).toBeGreaterThan(0);
  });

  it("excludes records that fail active dealbreakers", () => {
    const picks = buildTopPicks({
      records: [weakRecord, strongRecord],
      profile: {
        ...DEFAULT_PROFILE,
        dealbreakers: {
          ...DEFAULT_PROFILE.dealbreakers,
          avoidUnhealthyAir: true,
        },
      },
      seasonByRegion: {},
      maxPicks: 3,
    });

    expect(picks).toHaveLength(1);
    expect(picks[0]?.regionId).toBe("vn-da-nang");
  });
});
