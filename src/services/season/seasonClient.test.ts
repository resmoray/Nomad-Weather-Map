import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSeasonSummary } from "./seasonClient";

describe("fetchSeasonSummary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fixed season profile when backend is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await fetchSeasonSummary({
      regionId: "vn-hanoi",
      presetId: "perfectTemp:cityTrip",
      year: 2026,
      month: 2,
      weatherByMonth: { 2: 73 },
    });

    expect(result[2]?.seasonLabel).toBe("high");
    expect(result[2]?.confidence).toBe("high");
    expect(result[2]?.marketConfidenceSource).toBe("fixed");
    expect(result[2]?.isCrowdFallback).toBe(false);
    expect(result[2]?.isPriceFallback).toBe(false);
    expect(result[2]?.weatherIndex).toBe(73);
  });

  it("fills missing backend signals with fixed profile fallback", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        regionId: "bn-bandar-seri-begawan",
        year: 2026,
        signals: [],
      }),
    } as Response);

    const result = await fetchSeasonSummary({
      regionId: "bn-bandar-seri-begawan",
      presetId: "custom-profile",
      year: 2026,
      weatherByMonth: { 1: 71, 2: 63 },
    });

    expect(result[1]?.seasonLabel).toBe("off");
    expect(result[2]?.seasonLabel).toBe("high");
    expect(result[1]?.marketConfidenceSource).toBe("fixed");
    expect(result[1]?.weatherIndex).toBe(71);
    expect(result[2]?.weatherIndex).toBe(63);
  });

  it("returns all 12 months via fixed fallback when weatherByMonth is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await fetchSeasonSummary({
      regionId: "bn-bandar-seri-begawan",
      presetId: "custom-profile",
      year: 2026,
      weatherByMonth: {},
    });

    for (let month = 1; month <= 12; month += 1) {
      expect(result[month as keyof typeof result]).toBeDefined();
    }
    expect(result[1]?.seasonLabel).toBe("off");
    expect(result[7]?.seasonLabel).toBe("high");
  });
});
