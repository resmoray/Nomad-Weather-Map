import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE } from "../matrix/customProfile";

const { downloadFileMock } = vi.hoisted(() => ({
  downloadFileMock: vi.fn(),
}));

vi.mock("../../utils/downloadFile", () => ({
  downloadFile: downloadFileMock,
}));

import { exportMonthlyPlan } from "./exportMonthlyPlan";
import type { Region, RegionMonthRecord } from "../../types/weather";

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

const region: Region = {
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
};

const monthRecord: RegionMonthRecord = {
  region,
  month: 1,
  suitability: {
    score: 80,
    band: "Excellent",
    confidence: 0.95,
    breakdown: [],
  },
  metrics: {
    temperatureC: metric(26, "C"),
    rainfallMm: metric(45, "mm"),
    humidityPct: metric(58, "%"),
    windKph: metric(12, "kph"),
    uvIndex: metric(5, "index"),
    pm25: metric(11, "ug/m3"),
    aqi: metric(40, "index"),
    waveHeightM: metric(1.2, "m"),
    wavePeriodS: metric(9.5, "s"),
    waveDirectionDeg: metric(220, "deg"),
    floodRisk: metric(null, "index"),
    stormRisk: metric(null, "index"),
  },
};

describe("exportMonthlyPlan", () => {
  it("downloads monthly plan JSON", () => {
    downloadFileMock.mockReset();

    exportMonthlyPlan({
      regions: [region],
      monthRecords: [monthRecord],
      timelineRecords: [],
      profile: DEFAULT_PROFILE,
      seasonByRegion: {},
    });

    expect(downloadFileMock).toHaveBeenCalledTimes(1);
    const [payload, fileName, mimeType] = downloadFileMock.mock.calls[0];
    expect(fileName).toBe("nomad-weather-monthly-plan.json");
    expect(mimeType).toBe("application/json");

    const parsed = JSON.parse(String(payload)) as {
      type: string;
      coverage: { missingMonths: number[]; selectedRegionCount: number };
    };

    expect(parsed.type).toBe("monthly-plan");
    expect(parsed.coverage.selectedRegionCount).toBe(1);
    expect(parsed.coverage.missingMonths).toContain(2);
  });
});
