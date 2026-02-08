export const SCORING_MODEL_VERSION = "v2-custom-profile-1";
export const THRESHOLD_VERSION = "thresholds-2026-02";

export const SCORING_GUIDE = {
  title: "How personal scoring works",
  summary:
    "Each region-month gets a 0-100 score from your profile preferences. Weather metrics are normalized, weighted, then combined with coverage confidence.",
  rules: [
    "Temperature, humidity, rain, air quality and UV are tuned to your selected preference levels.",
    "When surf mode is off, wave metrics have zero impact.",
    "When surf mode is on, wave quality and wind are weighted strongly.",
    "Missing key metrics lower confidence and reduce final score reliability.",
    "Warnings are shown when a strong score hides a notable risk (air, UV, rain, wind).",
  ],
};
