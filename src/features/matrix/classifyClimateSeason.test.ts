import { describe, expect, it } from "vitest";
import type { RegionMonthRecord } from "../../types/weather";
import { classifyClimateSeason } from "./classifyClimateSeason";

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

function makeRecord(overrides?: Partial<RegionMonthRecord>): RegionMonthRecord {
  return {
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
      score: 80,
      band: "Excellent",
      confidence: 1,
      breakdown: [],
    },
    metrics: {
      temperatureC: metric(22, "C"),
      rainfallMm: metric(90, "mm"),
      humidityPct: metric(70, "%"),
      windKph: metric(8, "kph"),
      uvIndex: metric(6, "index"),
      pm25: metric(18, "ug/m3"),
      aqi: metric(72, "index"),
      waveHeightM: metric(1.2, "m"),
      wavePeriodS: metric(10, "s"),
      waveDirectionDeg: metric(230, "deg"),
      floodRisk: metric(null, "index"),
      stormRisk: metric(null, "index"),
    },
    ...overrides,
  };
}

describe("classifyClimateSeason", () => {
  it("returns fixed climate high season for Hanoi in January", () => {
    const result = classifyClimateSeason(makeRecord());
    expect(result.label).toBe("high");
  });

  it("returns fixed climate off season for Hanoi in July", () => {
    const result = classifyClimateSeason(
      makeRecord({
        month: 7,
      }),
    );
    expect(result.label).toBe("off");
  });

  it("returns fixed climate shoulder season for Hanoi in May", () => {
    const result = classifyClimateSeason(
      makeRecord({
        month: 5,
      }),
    );
    expect(result.label).toBe("shoulder");
  });

  it("returns fixed climate off season for Bali in November", () => {
    const result = classifyClimateSeason(
      makeRecord({
        region: {
          id: "id-denpasar",
          countryCode: "ID",
          countryName: "Indonesia",
          regionName: "Bali",
          cityName: "Denpasar",
          lat: -8.65,
          lon: 115.2167,
          cityIata: "DPS",
          destinationIata: "DPS",
          isCoastal: true,
        },
        month: 11,
      }),
    );
    expect(result.label).toBe("off");
  });
});
