import { describe, expect, it } from "vitest";
import { calculateCycleBudget, determineLayoutMode, selectRegionBatch } from "./staticRefreshLib";

describe("static refresh cycle budget", () => {
  it("matches the configured 180-day target when capacity allows", () => {
    const budget = calculateCycleBudget(36_000, {
      baselineYears: 5,
      targetCycleDays: 180,
      dailyBudget: 3000,
    });

    expect(budget.callsPerRegion).toBe(15);
    expect(budget.maxRegionsPerDay).toBe(200);
    expect(budget.desiredRegionsPerDay).toBe(200);
    expect(budget.effectiveRegionsPerDay).toBe(200);
    expect(budget.effectiveCycleDays).toBe(180);
  });

  it("automatically extends cycle length when desired throughput exceeds cap", () => {
    const budget = calculateCycleBudget(50_000, {
      baselineYears: 5,
      targetCycleDays: 180,
      dailyBudget: 3000,
    });

    expect(budget.desiredRegionsPerDay).toBeGreaterThan(budget.maxRegionsPerDay);
    expect(budget.effectiveRegionsPerDay).toBe(200);
    expect(budget.effectiveCycleDays).toBe(250);
  });
});

describe("static refresh cursor", () => {
  it("wraps across the end of the region list", () => {
    const result = selectRegionBatch(["a", "b", "c"], 2, 2);
    expect(result.regionIds).toEqual(["c", "a"]);
    expect(result.nextCursor).toBe(1);
  });
});

describe("static layout mode", () => {
  it("switches to shard mode only above threshold", () => {
    expect(determineLayoutMode(10_000)).toBe("region-month");
    expect(determineLayoutMode(10_001)).toBe("shard");
  });
});
