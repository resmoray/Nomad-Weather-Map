import { describe, expect, it } from "vitest";
import { regions } from "../../data/loadRegions";
import { getFixedSeasonProfile } from "./fixedSeasonProfiles";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const VALID_LABELS = new Set(["high", "shoulder", "off"]);

describe("fixedSeasonProfiles integrity", () => {
  it("includes complete country coverage for the current catalog scope", () => {
    const countryCounts = regions.reduce<Record<string, number>>((acc, region) => {
      acc[region.countryCode] = (acc[region.countryCode] ?? 0) + 1;
      return acc;
    }, {});

    const expectedMinimums: Record<string, number> = {
      AE: 1,
      AR: 1,
      AT: 5,
      AU: 9,
      CA: 2,
      CL: 2,
      BR: 5,
      CO: 5,
      DE: 5,
      EG: 5,
      FR: 5,
      GB: 5,
      GR: 5,
      IN: 5,
      IT: 5,
      KE: 5,
      MX: 5,
      PE: 5,
      PT: 5,
      TR: 5,
      ZA: 5,
      VN: 5,
      TH: 5,
      MY: 5,
      ID: 9,
      CN: 10,
      ES: 7,
      FI: 1,
      IS: 1,
      JP: 5,
      KR: 5,
      MA: 6,
      NZ: 6,
      NO: 1,
      PH: 5,
      SA: 1,
      SG: 1,
      BN: 1,
      KH: 3,
      LA: 2,
      MM: 3,
      TL: 1,
      LK: 5,
      TW: 5,
      US: 1,
    };

    for (const [countryCode, minCount] of Object.entries(expectedMinimums)) {
      expect(countryCounts[countryCode], `country ${countryCode} has incomplete region coverage`).toBeGreaterThanOrEqual(
        minCount,
      );
    }
  });

  it("covers every region in the region catalog", () => {
    for (const region of regions) {
      const profile = getFixedSeasonProfile(region.id);
      expect(profile, `missing fixed season profile for ${region.id}`).not.toBeNull();
    }
  });

  it("provides complete month mappings for market and climate seasons", () => {
    for (const region of regions) {
      const profile = getFixedSeasonProfile(region.id);
      expect(profile).not.toBeNull();
      if (!profile) continue;

      for (const month of MONTHS) {
        expect(
          VALID_LABELS.has(profile.marketByMonth[month]),
          `invalid market label for ${region.id} month ${month}`,
        ).toBe(true);
        expect(
          VALID_LABELS.has(profile.climateByMonth[month]),
          `invalid climate label for ${region.id} month ${month}`,
        ).toBe(true);
      }
    }
  });

  it("includes source references and review metadata for each profile", () => {
    for (const region of regions) {
      const profile = getFixedSeasonProfile(region.id);
      expect(profile).not.toBeNull();
      if (!profile) continue;

      expect(profile.sources.length, `${region.id} has insufficient source references`).toBeGreaterThanOrEqual(3);
      for (const source of profile.sources) {
        expect(source.url.startsWith("https://"), `${region.id} has non-https source URL`).toBe(true);
      }
      expect(profile.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(profile.marketReason.length).toBeGreaterThan(10);
      expect(profile.climateReason.length).toBeGreaterThan(10);
    }
  });
});
