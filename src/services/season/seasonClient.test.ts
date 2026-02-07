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
});
