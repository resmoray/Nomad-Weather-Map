import { describe, expect, it } from "vitest";
import { CONTINENT_GROUPS } from "./countryGroups";
import { regions } from "./loadRegions";
import { getFixedSeasonProfile } from "../services/season/fixedSeasonProfiles";

describe("regions integrity", () => {
  it("keeps region ids unique and coordinates in range", () => {
    const ids = new Set<string>();

    for (const region of regions) {
      expect(ids.has(region.id), `duplicate region id ${region.id}`).toBe(false);
      ids.add(region.id);

      expect(region.lat, `invalid latitude for ${region.id}`).toBeGreaterThanOrEqual(-90);
      expect(region.lat, `invalid latitude for ${region.id}`).toBeLessThanOrEqual(90);
      expect(region.lon, `invalid longitude for ${region.id}`).toBeGreaterThanOrEqual(-180);
      expect(region.lon, `invalid longitude for ${region.id}`).toBeLessThanOrEqual(180);
    }
  });

  it("keeps iata codes normalized", () => {
    for (const region of regions) {
      expect(region.cityIata).toMatch(/^[A-Z]{3}$/);
      expect(region.destinationIata).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("has consistent country names per country code", () => {
    const countryNameByCode = new Map<string, string>();

    for (const region of regions) {
      const existing = countryNameByCode.get(region.countryCode);
      if (existing && existing !== region.countryName) {
        throw new Error(
          `countryName mismatch for ${region.countryCode}: ${existing} vs ${region.countryName}`,
        );
      }
      countryNameByCode.set(region.countryCode, region.countryName);
    }
  });

  it("provides fixed season profiles for every region", () => {
    for (const region of regions) {
      const profile = getFixedSeasonProfile(region.id);
      expect(profile, `missing fixed profile for ${region.id}`).not.toBeNull();
    }
  });

  it("covers every dataset country in continent templates", () => {
    const datasetCountryCodes = new Set(regions.map((region) => region.countryCode));
    const continentCountryCodes = new Set(CONTINENT_GROUPS.flatMap((group) => group.countries));

    for (const countryCode of datasetCountryCodes) {
      expect(
        continentCountryCodes.has(countryCode),
        `missing country ${countryCode} in continent templates`,
      ).toBe(true);
    }
  });
});

