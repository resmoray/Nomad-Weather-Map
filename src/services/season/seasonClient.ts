import { getFixedSeasonProfile } from "../../services/season/fixedSeasonProfiles";
import type { Month } from "../../types/weather";
import type { SeasonSignal, SeasonSignalByMonth, SeasonSummaryResponse } from "../../types/season";

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? "http://localhost:8787" : "";
const ALL_MONTHS: Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const RUNTIME_MODE = (import.meta.env.VITE_RUNTIME_MODE ?? "dynamic").trim().toLowerCase();

function toSignalMap(signals: SeasonSignal[]): SeasonSignalByMonth {
  return signals.reduce<SeasonSignalByMonth>((acc, signal) => {
    acc[signal.month as Month] = signal;
    return acc;
  }, {});
}

function isValidMonth(value: number): value is Month {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function resolveTargetMonths(input: {
  month?: Month;
  weatherByMonth: Partial<Record<Month, number>>;
}): Month[] {
  if (input.month) {
    return [input.month];
  }

  const months = Object.keys(input.weatherByMonth)
    .map((monthKey) => Number(monthKey))
    .filter(isValidMonth);

  if (months.length > 0) {
    return months;
  }

  return ALL_MONTHS;
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

function withFallbackSignals(
  input: {
    regionId: string;
    month?: Month;
    weatherByMonth: Partial<Record<Month, number>>;
  },
  baseSignals: SeasonSignalByMonth,
): SeasonSignalByMonth {
  const targetMonths = resolveTargetMonths(input);
  const merged: SeasonSignalByMonth = { ...baseSignals };

  for (const month of targetMonths) {
    if (!merged[month]) {
      merged[month] = buildFallbackSignal(input.regionId, month, input.weatherByMonth[month] ?? 60);
    }
  }

  return merged;
}

export async function fetchSeasonSummary(input: {
  regionId: string;
  presetId: string;
  year: number;
  month?: Month;
  weatherByMonth: Partial<Record<Month, number>>;
}): Promise<SeasonSignalByMonth> {
  if (RUNTIME_MODE === "static") {
    return withFallbackSignals(input, {});
  }

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
    const signals = Array.isArray(payload.signals) ? payload.signals : [];
    return withFallbackSignals(input, toSignalMap(signals));
  } catch {
    return withFallbackSignals(input, {});
  }
}
