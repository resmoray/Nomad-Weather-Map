import { describe, expect, it } from "vitest";
import { COMFORT_PROFILES, getComfortProfileLabel } from "./comfortProfiles";

describe("comfort profiles", () => {
  it("exposes four comfort profiles", () => {
    expect(Object.keys(COMFORT_PROFILES)).toEqual([
      "tropicalLover",
      "warmTraveler",
      "perfectTemp",
      "coolLover",
    ]);
  });

  it("returns readable labels", () => {
    expect(getComfortProfileLabel("perfectTemp")).toBe("Perfect Temp");
  });
});
