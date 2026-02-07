import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AmadeusClient } from "./amadeusClient.ts";
import { getFixedSeasonProfile } from "../src/services/season/fixedSeasonProfiles.ts";

export type SeasonLabel = "high" | "shoulder" | "off";
export type SeasonConfidence = "high" | "medium" | "low";

interface RegionMeta {
  id: string;
  regionName: string;
  cityIata: string;
  destinationIata: string;
  lat: number;
}

interface SeasonSource {
  name: string;
  url: string;
  lastUpdated: string;
}

interface SeasonSignal {
  month: number;
  seasonLabel: SeasonLabel;
  crowdIndex: number | null;
  priceIndex: number | null;
  weatherIndex: number;
  confidence: SeasonConfidence;
  marketConfidenceSource: "live" | "mixed" | "fallback" | "fixed";
  isPriceFallback: boolean;
  isCrowdFallback: boolean;
  sources: SeasonSource[];
  reasonText: string;
}

interface PriceOrCrowdResult {
  byMonth: Record<number, number | null>;
  sourceName: string;
  sourceUrl: string;
  lastUpdated: string;
  isFallback: boolean;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const MISSING_PROFILE_SOURCE: SeasonSource = {
  name: "Nomad Weather Map fixed season catalog",
  url: "",
  lastUpdated: new Date().toISOString(),
};

const regionCache = (() => {
  const filePath = resolve(process.cwd(), "src/data/regions.json");
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as RegionMeta[];
  return new Map(parsed.map((region) => [region.id, region]));
})();

const amadeusClient = new AmadeusClient();

function monthTemplate(): Record<number, number | null> {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
    7: null,
    8: null,
    9: null,
    10: null,
    11: null,
    12: null,
  };
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function seededOffset(seed: string): number {
  return seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 17;
}

function fallbackPriceIndex(destinationIata: string): PriceOrCrowdResult {
  const offset = seededOffset(destinationIata);
  const byMonth = monthTemplate();

  for (const month of MONTHS) {
    const winterPeak = 28 * (1 + Math.cos(((month - 1) / 12) * Math.PI * 2));
    const summerPeak = 15 * (1 + Math.cos(((month - 7) / 12) * Math.PI * 2));
    byMonth[month] = normalizeScore(18 + winterPeak + summerPeak + offset);
  }

  return {
    byMonth,
    sourceName: "Nomad fallback season proxy (price)",
    sourceUrl: "https://www.unwto.org/tourism-data",
    lastUpdated: new Date().toISOString(),
    isFallback: true,
  };
}

function fallbackCrowdIndex(cityIata: string, latitude: number): PriceOrCrowdResult {
  const byMonth = monthTemplate();
  const offset = seededOffset(cityIata);
  const hemisphereShift = latitude < 0 ? 6 : 0;

  for (const month of MONTHS) {
    const shifted = ((month + hemisphereShift - 1) % 12) + 1;
    const highSeasonWave = 35 * (1 + Math.cos(((shifted - 1) / 12) * Math.PI * 2));
    const festivalWave = 8 * (1 + Math.cos(((shifted - 2) / 12) * Math.PI * 4));
    byMonth[month] = normalizeScore(14 + highSeasonWave + festivalWave + offset);
  }

  return {
    byMonth,
    sourceName: "Nomad fallback season proxy (crowd)",
    sourceUrl: "https://www.unwto.org/tourism-data",
    lastUpdated: new Date().toISOString(),
    isFallback: true,
  };
}

function parseWeatherByMonth(rawValue: string | null): Record<number, number> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;

    return Object.entries(parsed).reduce<Record<number, number>>((acc, [monthKey, value]) => {
      const month = Number(monthKey);
      if (!MONTHS.includes(month as (typeof MONTHS)[number])) {
        return acc;
      }

      if (typeof value === "number" && !Number.isNaN(value)) {
        acc[month] = normalizeScore(value);
      }

      return acc;
    }, {});
  } catch {
    return {};
  }
}

async function getPriceSignal(
  originIata: string,
  destinationIata: string,
  year: number,
): Promise<PriceOrCrowdResult> {
  const live = await amadeusClient.getMonthlyPriceIndex(originIata, destinationIata, year);
  return live ? { ...live, isFallback: false } : fallbackPriceIndex(destinationIata);
}

async function getCrowdSignal(cityIata: string, year: number, latitude: number): Promise<PriceOrCrowdResult> {
  const live = await amadeusClient.getMonthlyCrowdIndex(cityIata, year);
  return live ? { ...live, isFallback: false } : fallbackCrowdIndex(cityIata, latitude);
}

export async function getPriceIndexByMonth(
  originIata: string,
  destinationIata: string,
  year: number,
): Promise<PriceOrCrowdResult> {
  return getPriceSignal(originIata, destinationIata, year);
}

export async function getCrowdIndexByMonth(cityIata: string, year: number): Promise<PriceOrCrowdResult> {
  // Latitude is unknown for this direct endpoint, so we use zero for fallback shape.
  return getCrowdSignal(cityIata, year, 0);
}

export async function buildSeasonSummary(input: {
  regionId: string;
  year: number;
  month?: number;
  weatherByMonthRaw: string | null;
}): Promise<{
  regionId: string;
  year: number;
  signals: SeasonSignal[];
}> {
  const region = regionCache.get(input.regionId);
  if (!region) {
    throw new Error(`Unknown regionId: ${input.regionId}`);
  }

  const fixedProfile = getFixedSeasonProfile(input.regionId);
  const weatherByMonth = parseWeatherByMonth(input.weatherByMonthRaw);

  const monthFilter =
    typeof input.month === "number" && MONTHS.includes(input.month as (typeof MONTHS)[number])
      ? input.month
      : null;

  const targetMonths: (typeof MONTHS)[number][] = monthFilter
    ? [monthFilter as (typeof MONTHS)[number]]
    : [...MONTHS];

  const signals: SeasonSignal[] = targetMonths.map((month) => {
    const weatherIndex = weatherByMonth[month] ?? 60;

    if (fixedProfile) {
      const seasonLabel = fixedProfile.marketByMonth[month] ?? "shoulder";
      const sources: SeasonSource[] = fixedProfile.sources.map((source) => ({
        name: source.name,
        url: source.url,
        lastUpdated: `${fixedProfile.lastReviewed}T00:00:00.000Z`,
      }));

      return {
        month,
        seasonLabel,
        crowdIndex: null,
        priceIndex: null,
        weatherIndex,
        confidence: "high",
        marketConfidenceSource: "fixed",
        isPriceFallback: false,
        isCrowdFallback: false,
        sources,
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
      sources: [MISSING_PROFILE_SOURCE],
      reasonText: "No fixed market season profile configured for this city yet.",
    };
  });

  return {
    regionId: input.regionId,
    year: input.year,
    signals,
  };
}
