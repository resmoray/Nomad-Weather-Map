import { describe, expect, it } from "vitest";
import { TRIP_TYPES, getTripTypeLabel } from "./tripTypes";

describe("trip types", () => {
  it("defines all three trip types", () => {
    expect(Object.keys(TRIP_TYPES)).toEqual(["beachVacation", "cityTrip", "surfVacation"]);
  });

  it("surf vacation prioritizes marine metrics", () => {
    expect(TRIP_TYPES.surfVacation.weights.waveHeightM).toBe(30);
    expect(TRIP_TYPES.surfVacation.weights.wavePeriodS).toBe(25);
  });

  it("returns readable labels", () => {
    expect(getTripTypeLabel("cityTrip")).toBe("City Trip");
  });
});
