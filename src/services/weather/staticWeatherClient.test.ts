import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Region } from "../../types/weather";
import { clearStaticWeatherCache, fetchStaticWeatherSummary } from "./staticWeatherClient";

const REGION: Region = {
  id: "vn-da-nang",
  countryCode: "VN",
  countryName: "Vietnam",
  regionName: "Central",
  cityName: "Da Nang",
  lat: 16.0471,
  lon: 108.2068,
  cityIata: "DAD",
  destinationIata: "DAD",
  isCoastal: true,
};

const BASE_SUMMARY = {
  temperatureC: 27.1,
  temperatureMinC: 24.1,
  temperatureMaxC: 30.8,
  rainfallMm: 98.2,
  humidityPct: 72.4,
  windKph: 12.6,
  uvIndex: 6.8,
  uvIndexMax: 9.4,
  pm25: 11.2,
  aqi: 35.3,
  waveHeightM: 1.4,
  waveHeightMinM: 0.9,
  waveHeightMaxM: 2.1,
  wavePeriodS: 8.7,
  waveDirectionDeg: 205.4,
  waterTempC: 27.5,
  climateLastUpdated: "2026-02-14T00:00:00.000Z",
  airQualityLastUpdated: "2026-02-14T00:00:00.000Z",
  marineLastUpdated: "2026-02-14T00:00:00.000Z",
};

describe("staticWeatherClient", () => {
  beforeEach(() => {
    clearStaticWeatherCache();
  });

  it("loads manifest + month file and strips marine fields when includeMarine=false", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/static-weather/v1/manifest.json")) {
        return new Response(
          JSON.stringify({
            schemaVersion: "nomad-static-weather-v1",
            generatedAt: "2026-02-14T00:00:00.000Z",
            baselineYears: 5,
            layoutMode: "region-month",
            regionCount: 193,
            monthCount: 12,
            datasetVersion: "20260214000000",
            sourceCycle: {
              targetCycleDays: 180,
              dailyBudget: 3000,
              runsPerDay: 1,
            },
            regionPrefixLength: 2,
          }),
          { status: 200 },
        );
      }

      if (url.endsWith("/static-weather/v1/regions/vn/vn-da-nang/m01.json")) {
        return new Response(
          JSON.stringify({
            schemaVersion: "nomad-static-weather-v1",
            regionId: "vn-da-nang",
            month: 1,
            summary: BASE_SUMMARY,
          }),
          { status: 200 },
        );
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);
    const summary = await fetchStaticWeatherSummary({
      region: REGION,
      month: 1,
      includeMarine: false,
    });

    expect(summary.uvIndex).toBe(6.8);
    expect(summary.waveHeightM).toBeNull();
    expect(summary.waveHeightMinM).toBeNull();
    expect(summary.waveHeightMaxM).toBeNull();
    expect(summary.wavePeriodS).toBeNull();
    expect(summary.waveDirectionDeg).toBeNull();
    expect(summary.waterTempC).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
