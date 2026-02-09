import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "../features/matrix/customProfile";
import type { AppUrlState } from "./urlState";
import { buildAppUrlState, getDefaultPinnedRows, parseAppUrlState } from "./urlState";

describe("urlState", () => {
  it("round-trips core app state through query params", () => {
    const state: AppUrlState = {
      selectedCountryCodes: ["VN", "TH"],
      selectedMonth: 7,
      selectedRegionIds: ["vn-hanoi", "vn-da-nang"],
      matrixMode: "timeline",
      timelineRegionId: "vn-hanoi",
      profile: {
        tempPreference: "warm",
        humidityPreference: "humid",
        rainTolerance: "rainFlexible",
        airSensitivity: "tolerant",
        uvSensitivity: "normal",
        preferredMarketSeason: "shoulder",
        preferredClimateSeason: "high",
        surfEnabled: true,
        dealbreakers: {
          avoidHeavyRain: true,
          avoidUnhealthyAir: true,
          avoidVeryHighUv: false,
          avoidStrongWind: false,
          coastalOnly: true,
        },
      },
      minScore: 63,
      pinnedRows: ["temperatureC", "rainfallMm", "pm25"],
    };

    const query = buildAppUrlState(state);
    const parsed = parseAppUrlState(query);

    expect(parsed.selectedCountryCodes).toEqual(["VN", "TH"]);
    expect(parsed.selectedMonth).toBe(7);
    expect(parsed.selectedRegionIds).toEqual(["vn-hanoi", "vn-da-nang"]);
    expect(parsed.matrixMode).toBe("timeline");
    expect(parsed.timelineRegionId).toBe("vn-hanoi");
    expect(parsed.profile).toEqual(state.profile);
    expect(parsed.minScore).toBe(63);
    expect(parsed.pinnedRows).toEqual(["temperatureC", "rainfallMm", "pm25"]);
  });

  it("falls back safely for invalid profile and row values", () => {
    const parsed = parseAppUrlState(
      "country=ZZ&month=99&temp=bad&humidity=bad&rain=bad&air=bad&uv=bad&marketSeason=bad&climateSeason=bad&surf=0&rows=x,y&minScore=999",
    );

    expect(parsed.selectedCountryCodes).toBeUndefined();
    expect(parsed.selectedMonth).toBeUndefined();
    expect(parsed.profile).toEqual(DEFAULT_PROFILE);
    expect(parsed.pinnedRows).toEqual(getDefaultPinnedRows());
    expect(parsed.minScore).toBe(100);
  });
});
