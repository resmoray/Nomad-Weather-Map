import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE } from "../matrix/customProfile";

const { downloadFileMock } = vi.hoisted(() => ({
  downloadFileMock: vi.fn(),
}));

vi.mock("../../utils/downloadFile", () => ({
  downloadFile: downloadFileMock,
}));

import { exportShortlist } from "./exportShortlist";
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

const record: RegionMonthRecord = {
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

describe("exportShortlist", () => {
  it("downloads shortlist JSON with expected metadata", () => {
    downloadFileMock.mockReset();

    exportShortlist([record], DEFAULT_PROFILE, {});

    expect(downloadFileMock).toHaveBeenCalledTimes(1);
    expect(downloadFileMock).toHaveBeenCalledWith(
      expect.stringContaining('"type": "shortlist"'),
      "nomad-weather-shortlist.json",
      "application/json",
    );
  });
});
