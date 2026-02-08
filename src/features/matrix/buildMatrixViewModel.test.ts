import { describe, expect, it } from "vitest";
import type { SeasonSignalByMonth } from "../../types/season";
import type { RegionMonthRecord } from "../../types/weather";
import { buildMatrixViewModel } from "./buildMatrixViewModel";
import { DEFAULT_PROFILE } from "./customProfile";

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
    score: 78,
    band: "Excellent",
    confidence: 1,
    breakdown: [],
  },
  metrics: {
    temperatureC: metric(22, "C"),
    rainfallMm: metric(90, "mm"),
    humidityPct: metric(70, "%"),
    windKph: metric(8, "kph"),
    uvIndex: metric(5, "index"),
    pm25: metric(20, "ug/m3"),
    aqi: metric(70, "index"),
    waveHeightM: metric(1.1, "m"),
    wavePeriodS: metric(9.5, "s"),
    waveDirectionDeg: metric(240, "deg"),
    floodRisk: metric(null, "index"),
    stormRisk: metric(null, "index"),
  },
};

const seasonByRegion: Record<string, SeasonSignalByMonth> = {
  "vn-hanoi": {
    1: {
      month: 1,
      seasonLabel: "high",
      crowdIndex: 80,
      priceIndex: 75,
      weatherIndex: 78,
      confidence: "medium",
      marketConfidenceSource: "mixed",
      isPriceFallback: false,
      isCrowdFallback: true,
      sources: [
        { name: "price", url: "https://example.com/price", lastUpdated: "2026-01-01T00:00:00.000Z" },
      ],
      reasonText: "Market high season test",
    },
  },
};

describe("buildMatrixViewModel", () => {
  it("renders market, climate and personal rows without a separate suitability row", () => {
    const vm = buildMatrixViewModel({
      mode: "monthCompare",
      month: 1,
      monthRecords: [record],
      timelineRecords: [],
      seasonByRegion,
      profile: DEFAULT_PROFILE,
    });

    const rowKeys = vm.rows.map((row) => row.key);

    expect(rowKeys[0]).toBe("marketSeason");
    expect(rowKeys[1]).toBe("climateSeason");
    expect(rowKeys[2]).toBe("personal");
    expect(rowKeys).not.toContain("suitability");
  });

  it("shows only short market season label in season cells", () => {
    const vm = buildMatrixViewModel({
      mode: "monthCompare",
      month: 1,
      monthRecords: [record],
      timelineRecords: [],
      seasonByRegion,
      profile: DEFAULT_PROFILE,
    });

    expect(vm.rows[0]?.cells[0]?.label).toBe("high");
    expect(vm.rows[0]?.cells[0]?.valueText).toBe("");
  });

  it("shows only short climate season label in climate season row", () => {
    const vm = buildMatrixViewModel({
      mode: "monthCompare",
      month: 1,
      monthRecords: [record],
      timelineRecords: [],
      seasonByRegion,
      profile: DEFAULT_PROFILE,
    });

    expect(vm.rows[1]?.cells[0]?.label).toBe("high");
    expect(vm.rows[1]?.cells[0]?.valueText).toBe("");
  });
});
