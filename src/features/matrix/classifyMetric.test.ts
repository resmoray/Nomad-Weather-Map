import { describe, expect, it } from "vitest";
import type { MetricValue } from "../../types/weather";
import { classifyMetric, seasonLabelText, seasonToSeverity } from "./classifyMetric";

function metric(value: number | null): MetricValue {
  return {
    value,
    unit: "x",
    status: value === null ? "missing" : "ok",
    sourceName: "test",
    sourceUrl: "https://example.com",
    lastUpdated: "2026-01-01T00:00:00.000Z",
  };
}

describe("classifyMetric", () => {
  it("maps temperature to human label", () => {
    expect(classifyMetric("temperatureC", metric(23)).label).toBe("Comfortable");
    expect(classifyMetric("temperatureC", metric(38)).label).toBe("Scorching");
  });

  it("handles missing data", () => {
    const result = classifyMetric("floodRisk", metric(null));
    expect(result.label).toBe("No data");
    expect(result.severity).toBe("missing");
  });

  it("maps season labels to severity", () => {
    expect(seasonToSeverity("high")).toBe("bad");
    expect(seasonToSeverity("shoulder")).toBe("good");
    expect(seasonLabelText("off")).toBe("Market off season");
  });
});
