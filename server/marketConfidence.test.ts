import { describe, expect, it } from "vitest";
import { deriveMarketConfidence, deriveMarketConfidenceSource } from "./marketConfidence";

describe("deriveMarketConfidence", () => {
  it("returns high when both signals are live", () => {
    const confidence = deriveMarketConfidence({
      crowdIndex: 70,
      priceIndex: 66,
      isCrowdFallback: false,
      isPriceFallback: false,
    });
    expect(confidence).toBe("high");
    expect(
      deriveMarketConfidenceSource({ isCrowdFallback: false, isPriceFallback: false }),
    ).toBe("live");
  });

  it("returns medium when one signal is fallback and one live", () => {
    const confidence = deriveMarketConfidence({
      crowdIndex: 70,
      priceIndex: 66,
      isCrowdFallback: true,
      isPriceFallback: false,
    });
    expect(confidence).toBe("medium");
    expect(
      deriveMarketConfidenceSource({ isCrowdFallback: true, isPriceFallback: false }),
    ).toBe("mixed");
  });

  it("returns low when both are fallback or missing", () => {
    const fallbackConfidence = deriveMarketConfidence({
      crowdIndex: 60,
      priceIndex: 60,
      isCrowdFallback: true,
      isPriceFallback: true,
    });
    const missingConfidence = deriveMarketConfidence({
      crowdIndex: null,
      priceIndex: 60,
      isCrowdFallback: false,
      isPriceFallback: false,
    });
    expect(fallbackConfidence).toBe("low");
    expect(missingConfidence).toBe("low");
    expect(
      deriveMarketConfidenceSource({ isCrowdFallback: true, isPriceFallback: true }),
    ).toBe("fallback");
  });
});
