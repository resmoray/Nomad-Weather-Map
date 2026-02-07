import { describe, expect, it } from "vitest";
import { averageDailyMaxUv } from "./openMeteoClient";

describe("averageDailyMaxUv", () => {
  it("uses daily UV max instead of 24-hour average", () => {
    const result = averageDailyMaxUv([
      {
        time: [
          "2025-01-01T00:00",
          "2025-01-01T06:00",
          "2025-01-01T12:00",
          "2025-01-01T18:00",
          "2025-01-02T00:00",
          "2025-01-02T12:00",
          "2025-01-02T18:00",
        ],
        uv_index: [0, 1, 8, 0, 0, 6, 0],
      },
    ]);

    // Daily max values are 8 and 6 -> avg 7.
    expect(result).toBe(7);
  });

  it("returns null when no usable UV values exist", () => {
    const result = averageDailyMaxUv([{ time: ["2025-01-01T00:00"], uv_index: [null] }]);
    expect(result).toBeNull();
  });
});
