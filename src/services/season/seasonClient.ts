import { getFixedSeasonProfile } from "../../services/season/fixedSeasonProfiles";
import type { Month } from "../../types/weather";
import type { SeasonSignal, SeasonSignalByMonth, SeasonSummaryResponse } from "../../types/season";

const DEFAULT_API_BASE_URL = "http://localhost:8787";

function toSignalMap(signals: SeasonSignal[]): SeasonSignalByMonth {
  return signals.reduce<SeasonSignalByMonth>((acc, signal) => {
    acc[signal.month as Month] = signal;
    return acc;
  }, {});
}

function buildFallbackSignal(regionId: string, month: Month, weatherIndex: number): SeasonSignal {
  const fixedProfile = getFixedSeasonProfile(regionId);

  if (fixedProfile) {
    return {
      month,
      seasonLabel: fixedProfile.marketByMonth[month] ?? "shoulder",
      crowdIndex: null,
      priceIndex: null,
      weatherIndex,
      confidence: "high",
      marketConfidenceSource: "fixed",
      isPriceFallback: false,
      isCrowdFallback: false,
      sources: fixedProfile.sources.map((source) => ({
        name: source.name,
        url: source.url,
        lastUpdated: `${fixedProfile.lastReviewed}T00:00:00.000Z`,
      })),
      reasonText: fixedProfile.marketReason,
    };
  }

  return {
    month,
    seasonLabel: "shoulder",
    crowdIndex: null,
    priceIndex: null,
    weatherIndex,
    confidence: "low",
    marketConfidenceSource: "fixed",
    isPriceFallback: false,
    isCrowdFallback: false,
    sources: [
      {
        name: "Nomad Weather Map fixed season catalog",
        url: "",
        lastUpdated: new Date().toISOString(),
      },
    ],
    reasonText: "No fixed market season profile configured for this city yet.",
  };
}

export async function fetchSeasonSummary(input: {
  regionId: string;
  presetId: string;
  year: number;
  month?: Month;
  weatherByMonth: Partial<Record<Month, number>>;
}): Promise<SeasonSignalByMonth> {
  const baseUrl = import.meta.env.VITE_SEASON_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  const params = new URLSearchParams({
    regionId: input.regionId,
    presetId: input.presetId,
    year: String(input.year),
    weatherByMonth: JSON.stringify(input.weatherByMonth),
  });

  if (input.month) {
    params.set("month", String(input.month));
  }

  try {
    const response = await fetch(`${baseUrl}/api/season/summary?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Season summary failed with status ${response.status}`);
    }

    const payload = (await response.json()) as SeasonSummaryResponse;
    return toSignalMap(payload.signals);
  } catch {
    if (input.month) {
      const weatherIndex = input.weatherByMonth[input.month] ?? 60;
      return {
        [input.month]: buildFallbackSignal(input.regionId, input.month, weatherIndex),
      };
    }

    const fallbackEntries = Object.entries(input.weatherByMonth).map(([monthKey, weatherIndex]) => {
      const month = Number(monthKey) as Month;
      return [month, buildFallbackSignal(input.regionId, month, weatherIndex ?? 60)] as const;
    });

    return Object.fromEntries(fallbackEntries);
  }
}
