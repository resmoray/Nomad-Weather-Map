export type SeasonConfidence = "high" | "medium" | "low";
export type MarketConfidenceSource = "live" | "mixed" | "fallback";

export function deriveMarketConfidence(input: {
  crowdIndex: number | null;
  priceIndex: number | null;
  isCrowdFallback: boolean;
  isPriceFallback: boolean;
}): SeasonConfidence {
  if (input.crowdIndex === null || input.priceIndex === null) {
    return "low";
  }

  if (!input.isCrowdFallback && !input.isPriceFallback) {
    return "high";
  }

  if (input.isCrowdFallback && input.isPriceFallback) {
    return "low";
  }

  return "medium";
}

export function deriveMarketConfidenceSource(input: {
  isCrowdFallback: boolean;
  isPriceFallback: boolean;
}): MarketConfidenceSource {
  if (!input.isCrowdFallback && !input.isPriceFallback) {
    return "live";
  }

  if (input.isCrowdFallback && input.isPriceFallback) {
    return "fallback";
  }

  return "mixed";
}
