import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Month, Region, RegionMonthRecord } from "../types/weather";

const getRegionMonthRecordMock = vi.fn();
const getRegionTimelineMock = vi.fn();
const fetchSeasonSummaryMock = vi.fn();

vi.mock("../features/map/WeatherMap", () => ({
  WeatherMap: ({ records }: { records: unknown[] }) => (
    <section>
      <h2>Map View</h2>
      <p data-testid="mock-map-count">{records.length}</p>
    </section>
  ),
}));

vi.mock("../services/season/seasonClient", () => ({
  fetchSeasonSummary: (...args: unknown[]) => fetchSeasonSummaryMock(...args),
}));

vi.mock("../services/weather/provider", () => ({
  weatherProvider: {
    getRegionMonthRecord: (region: Region, month: Month) =>
      getRegionMonthRecordMock(region, month),
    getRegionTimeline: (region: Region) => getRegionTimelineMock(region),
    clearCache: vi.fn(),
  },
}));

import App from "./App";

function metric(value: number | null, unit: string) {
  return {
    value,
    unit,
    status: value === null ? ("missing" as const) : ("ok" as const),
    sourceName: "Open-Meteo",
    sourceUrl: "https://open-meteo.com",
    lastUpdated: "2026-02-06T00:00:00.000Z",
  };
}

function makeRecord(region: Region, month: Month): RegionMonthRecord {
  return {
    region,
    month,
    suitability: {
      score: 70,
      band: "Good",
      confidence: 0.8,
      breakdown: [],
    },
    metrics: {
      temperatureC: metric(26, "C"),
      rainfallMm: metric(90, "mm"),
      humidityPct: metric(60, "%"),
      windKph: metric(12, "kph"),
      uvIndex: metric(5, "index"),
      pm25: metric(18, "ug/m3"),
      aqi: metric(64, "index"),
      waveHeightM: metric(1.3, "m"),
      wavePeriodS: metric(9.5, "s"),
      waveDirectionDeg: metric(240, "deg"),
      floodRisk: metric(null, "index"),
      stormRisk: metric(null, "index"),
    },
  };
}

describe("App", () => {
  beforeEach(() => {
    getRegionMonthRecordMock.mockReset();
    getRegionTimelineMock.mockReset();
    fetchSeasonSummaryMock.mockReset();
    fetchSeasonSummaryMock.mockResolvedValue({});
  });

  it("shows loading state while requests are pending", async () => {
    getRegionMonthRecordMock.mockImplementation(() => new Promise(() => {}));

    render(<App />);

    expect(await screen.findByText("Loading weather data...")).toBeInTheDocument();
  });

  it("shows error state when provider fails", async () => {
    getRegionMonthRecordMock.mockRejectedValue(new Error("API down"));

    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("API down");
  });

  it("refetches when country filter changes", async () => {
    getRegionMonthRecordMock.mockImplementation(async (region: Region, month: Month) =>
      makeRecord(region, month),
    );

    render(<App />);

    await waitFor(() => {
      expect(getRegionMonthRecordMock).toHaveBeenCalled();
    });

    const countrySelect = screen.getByLabelText("Country");
    fireEvent.change(countrySelect, { target: { value: "TH" } });

    await waitFor(() => {
      expect(getRegionMonthRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({ countryCode: "TH" }),
        1,
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText("Thailand, Central - Bangkok").length).toBeGreaterThan(0);
    });
  });
});
