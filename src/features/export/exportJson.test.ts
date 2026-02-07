import { describe, expect, it } from "vitest";
import { buildJsonExport } from "./exportJson";
import type { RegionMonthRecord } from "../../types/weather";

const sampleRecord: RegionMonthRecord = {
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
    score: 74,
    band: "Good",
    confidence: 0.82,
    breakdown: [],
  },
  metrics: {
    temperatureC: {
      value: 23,
      unit: "C",
      status: "ok",
      sourceName: "Open-Meteo Climate API",
      sourceUrl: "https://open-meteo.com/en/docs/climate-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    rainfallMm: {
      value: 40,
      unit: "mm",
      status: "ok",
      sourceName: "Open-Meteo Climate API",
      sourceUrl: "https://open-meteo.com/en/docs/climate-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    humidityPct: {
      value: 55,
      unit: "%",
      status: "ok",
      sourceName: "Open-Meteo Climate API",
      sourceUrl: "https://open-meteo.com/en/docs/climate-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    windKph: {
      value: 12,
      unit: "kph",
      status: "ok",
      sourceName: "Open-Meteo Climate API",
      sourceUrl: "https://open-meteo.com/en/docs/climate-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    uvIndex: {
      value: 5,
      unit: "index",
      status: "ok",
      sourceName: "Open-Meteo Air Quality API",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    pm25: {
      value: 18,
      unit: "ug/m3",
      status: "ok",
      sourceName: "Open-Meteo Air Quality API",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    aqi: {
      value: 63,
      unit: "index",
      status: "ok",
      sourceName: "Open-Meteo Air Quality API",
      sourceUrl: "https://open-meteo.com/en/docs/air-quality-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    waveHeightM: {
      value: 1.1,
      unit: "m",
      status: "ok",
      sourceName: "Open-Meteo Marine API",
      sourceUrl: "https://open-meteo.com/en/docs/marine-weather-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    wavePeriodS: {
      value: 9.8,
      unit: "s",
      status: "ok",
      sourceName: "Open-Meteo Marine API",
      sourceUrl: "https://open-meteo.com/en/docs/marine-weather-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    waveDirectionDeg: {
      value: 230,
      unit: "deg",
      status: "ok",
      sourceName: "Open-Meteo Marine API",
      sourceUrl: "https://open-meteo.com/en/docs/marine-weather-api",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    floodRisk: {
      value: null,
      unit: "index",
      status: "missing",
      sourceName: "Not available in Phase 1",
      sourceUrl: "https://open-meteo.com/",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
    stormRisk: {
      value: null,
      unit: "index",
      status: "missing",
      sourceName: "Not available in Phase 1",
      sourceUrl: "https://open-meteo.com/",
      lastUpdated: "2026-02-06T00:00:00.000Z",
    },
  },
};

describe("buildJsonExport", () => {
  it("creates LLM-ready rows with value + source + date fields", () => {
    const [row] = buildJsonExport([sampleRecord]);

    expect(row.region_id).toBe("vn-hanoi");
    expect(row.display_name).toBe("Vietnam, North - Hanoi");
    expect(row.suitability_score).toBe(74);
    expect(row.temperature_c).toBe(23);
    expect(row.temperature_source).toContain("Open-Meteo");
    expect(row.temperature_last_updated).toBe("2026-02-06T00:00:00.000Z");
    expect(row.flood_risk).toBeNull();
    expect(row.flood_risk_status).toBe("missing");
    expect(row.season_label).toBeNull();
    expect(row.climate_season_label).toBe("high");
    expect(row.market_season_label).toBeNull();
    expect(typeof row.exported_at).toBe("string");
  });
});
