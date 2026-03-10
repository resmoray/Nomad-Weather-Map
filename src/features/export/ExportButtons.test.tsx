import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserPreferenceProfile } from "../../types/presentation";
import type { Region, RegionMonthRecord } from "../../types/weather";

const downloadJsonExportMock = vi.fn();
const exportMonthlyPlanMock = vi.fn();

vi.mock("./exportJson", () => ({
  downloadJsonExport: (...args: unknown[]) => downloadJsonExportMock(...args),
}));

vi.mock("./exportMonthlyPlan", () => ({
  exportMonthlyPlan: (...args: unknown[]) => exportMonthlyPlanMock(...args),
}));

import { ExportButtons } from "./ExportButtons";

function metric(value: number | null, unit: string) {
  return {
    value,
    unit,
    status: value === null ? ("missing" as const) : ("ok" as const),
    sourceName: "Open-Meteo",
    sourceUrl: "https://open-meteo.com",
    lastUpdated: "2026-03-10T00:00:00.000Z",
  };
}

const profile: UserPreferenceProfile = {
  tempPreference: "mild",
  humidityPreference: "balanced",
  rainTolerance: "okayRain",
  airSensitivity: "normal",
  uvSensitivity: "normal",
  preferredMarketSeason: "noPreference",
  preferredClimateSeason: "noPreference",
  surfEnabled: false,
  dealbreakers: {
    avoidHeavyRain: false,
    avoidUnhealthyAir: false,
    avoidVeryHighUv: false,
    avoidStrongWind: false,
    coastalOnly: false,
  },
};

const region: Region = {
  id: "th-bangkok",
  countryCode: "TH",
  countryName: "Thailand",
  regionName: "Central",
  cityName: "Bangkok",
  lat: 13.7563,
  lon: 100.5018,
  cityIata: "BKK",
  destinationIata: "BKK",
  isCoastal: false,
};

function makeRecord(): RegionMonthRecord {
  return {
    region,
    month: 1,
    suitability: {
      score: 74,
      band: "Good",
      confidence: 0.84,
      breakdown: [],
    },
    metrics: {
      temperatureC: metric(29, "C"),
      rainfallMm: metric(28, "mm"),
      humidityPct: metric(67, "%"),
      windKph: metric(11, "kph"),
      uvIndex: metric(8, "index"),
      pm25: metric(21, "ug/m3"),
      aqi: metric(58, "index"),
      waveHeightM: metric(null, "m"),
      wavePeriodS: metric(null, "s"),
      waveDirectionDeg: metric(null, "deg"),
      floodRisk: metric(null, "index"),
      stormRisk: metric(null, "index"),
    },
  };
}

describe("ExportButtons", () => {
  beforeEach(() => {
    downloadJsonExportMock.mockReset();
    exportMonthlyPlanMock.mockReset();
  });

  it("shows all JSON export variants in a dropdown", () => {
    render(
      <ExportButtons
        records={[makeRecord()]}
        regions={[region]}
        month={1}
        seasonByRegion={{}}
        profile={profile}
        loadRegionTimeline={vi.fn().mockResolvedValue([makeRecord()])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Export JSON/i }));

    expect(screen.getByRole("button", { name: "Shortlist JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly Plan JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Raw Data JSON" })).toBeInTheDocument();
  });

  it("exports raw data JSON from the dropdown", () => {
    const record = makeRecord();

    render(
      <ExportButtons
        records={[record]}
        regions={[region]}
        month={1}
        seasonByRegion={{}}
        profile={profile}
        loadRegionTimeline={vi.fn().mockResolvedValue([record])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Export JSON/i }));
    fireEvent.click(screen.getByRole("button", { name: "Raw Data JSON" }));

    expect(downloadJsonExportMock).toHaveBeenCalledWith([record], 1, profile, {});
    expect(screen.getByText("JSON exported.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Raw Data JSON" })).not.toBeInTheDocument();
  });

  it("exports the monthly plan from the JSON dropdown", async () => {
    const record = makeRecord();
    const loadRegionTimeline = vi.fn().mockResolvedValue([record]);

    render(
      <ExportButtons
        records={[record]}
        regions={[region]}
        month={1}
        seasonByRegion={{}}
        profile={profile}
        loadRegionTimeline={loadRegionTimeline}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Export JSON/i }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly Plan JSON" }));

    await waitFor(() => {
      expect(loadRegionTimeline).toHaveBeenCalledWith(region);
    });
    await waitFor(() => {
      expect(exportMonthlyPlanMock).toHaveBeenCalledWith(
        expect.objectContaining({
          regions: [region],
          timelineRecords: [record],
          selectedRegionCount: 1,
          failedRegionIds: [],
        }),
      );
    });

    expect(screen.getByText("Monthly plan exported.")).toBeInTheDocument();
  });
});
