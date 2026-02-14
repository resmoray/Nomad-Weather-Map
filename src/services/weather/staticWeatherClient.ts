import { z } from "zod";
import type { Month, Region } from "../../types/weather";
import type { OpenMeteoMonthlySummary } from "./openMeteoClient";

const STATIC_SCHEMA_VERSION = "nomad-static-weather-v1";
const DEFAULT_STATIC_BASE_PATH = `${import.meta.env.BASE_URL}static-weather/v1`;
const STATIC_BASE_PATH = (import.meta.env.VITE_STATIC_WEATHER_BASE_PATH ?? DEFAULT_STATIC_BASE_PATH).trim();

const staticSummarySchema = z.object({
  temperatureC: z.number().nullable(),
  temperatureMinC: z.number().nullable(),
  temperatureMaxC: z.number().nullable(),
  rainfallMm: z.number().nullable(),
  humidityPct: z.number().nullable(),
  windKph: z.number().nullable(),
  uvIndex: z.number().nullable(),
  uvIndexMax: z.number().nullable(),
  pm25: z.number().nullable(),
  aqi: z.number().nullable(),
  waveHeightM: z.number().nullable(),
  waveHeightMinM: z.number().nullable(),
  waveHeightMaxM: z.number().nullable(),
  wavePeriodS: z.number().nullable(),
  waveDirectionDeg: z.number().nullable(),
  waterTempC: z.number().nullable(),
  climateLastUpdated: z.string(),
  airQualityLastUpdated: z.string(),
  marineLastUpdated: z.string(),
});

const manifestSchema = z.object({
  schemaVersion: z.literal(STATIC_SCHEMA_VERSION),
  generatedAt: z.string(),
  baselineYears: z.number().int().positive(),
  layoutMode: z.union([z.literal("region-month"), z.literal("shard")]),
  regionCount: z.number().int().nonnegative(),
  monthCount: z.number().int().positive(),
  datasetVersion: z.string(),
  sourceCycle: z.object({
    targetCycleDays: z.number().int().positive(),
    dailyBudget: z.number().int().positive(),
    runsPerDay: z.number().int().positive(),
  }),
  regionPrefixLength: z.number().int().positive().optional(),
});

const monthFileSchema = z.object({
  schemaVersion: z.literal(STATIC_SCHEMA_VERSION),
  regionId: z.string(),
  month: z.number().int().min(1).max(12),
  summary: staticSummarySchema,
});

const shardIndexSchema = z.object({
  schemaVersion: z.literal(STATIC_SCHEMA_VERSION),
  layoutMode: z.literal("shard"),
  regionToShard: z.record(z.string(), z.string()),
});

const shardFileSchema = z.object({
  schemaVersion: z.literal(STATIC_SCHEMA_VERSION),
  shardId: z.string(),
  entries: z.record(z.string(), staticSummarySchema),
});

type StaticManifest = z.infer<typeof manifestSchema>;
type ShardIndex = z.infer<typeof shardIndexSchema>;
type ShardFile = z.infer<typeof shardFileSchema>;

let manifestPromise: Promise<StaticManifest> | null = null;
let shardIndexPromise: Promise<ShardIndex> | null = null;
const shardCache = new Map<string, Promise<ShardFile>>();

function trimSlashes(value: string): string {
  return value.replace(/^\/+/, "").replace(/\/+$/, "");
}

function buildBasePath(): string {
  const normalized = trimSlashes(STATIC_BASE_PATH);
  return `${import.meta.env.BASE_URL}${normalized}`.replace(/\/{2,}/g, "/");
}

function asMonthFileName(month: Month): string {
  return `m${String(month).padStart(2, "0")}.json`;
}

function prefixForRegion(regionId: string, prefixLength: number): string {
  return regionId.slice(0, Math.max(1, prefixLength)).toLowerCase();
}

function summaryWithMarinePreference(
  summary: OpenMeteoMonthlySummary,
  includeMarine: boolean,
): OpenMeteoMonthlySummary {
  if (includeMarine) {
    return summary;
  }

  return {
    ...summary,
    waveHeightM: null,
    waveHeightMinM: null,
    waveHeightMaxM: null,
    waveDirectionDeg: null,
    wavePeriodS: null,
    waterTempC: null,
  };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Static weather request failed (${response.status}) for ${url}`);
  }

  return response.json();
}

async function loadManifest(): Promise<StaticManifest> {
  if (!manifestPromise) {
    const manifestUrl = `${buildBasePath()}/manifest.json`;
    manifestPromise = fetchJson(manifestUrl).then((payload) => manifestSchema.parse(payload));
  }

  return manifestPromise;
}

async function loadShardIndex(): Promise<ShardIndex> {
  if (!shardIndexPromise) {
    const indexUrl = `${buildBasePath()}/shards/region-index.json`;
    shardIndexPromise = fetchJson(indexUrl).then((payload) => shardIndexSchema.parse(payload));
  }

  return shardIndexPromise;
}

async function loadShard(shardId: string): Promise<ShardFile> {
  const cached = shardCache.get(shardId);
  if (cached) {
    return cached;
  }

  const shardUrl = `${buildBasePath()}/shards/${shardId}.json`;
  const loadPromise = fetchJson(shardUrl).then((payload) => shardFileSchema.parse(payload));
  shardCache.set(shardId, loadPromise);
  return loadPromise;
}

async function loadRegionMonthSummary(input: {
  manifest: StaticManifest;
  regionId: string;
  month: Month;
}): Promise<OpenMeteoMonthlySummary> {
  if (input.manifest.layoutMode === "region-month") {
    const prefixLength = input.manifest.regionPrefixLength ?? 2;
    const prefix = prefixForRegion(input.regionId, prefixLength);
    const fileName = asMonthFileName(input.month);
    const url = `${buildBasePath()}/regions/${prefix}/${input.regionId}/${fileName}`;
    const payload = await fetchJson(url);
    const parsed = monthFileSchema.parse(payload);
    return parsed.summary;
  }

  const shardIndex = await loadShardIndex();
  const shardId = shardIndex.regionToShard[input.regionId];
  if (!shardId) {
    throw new Error(`No shard mapping found for region ${input.regionId}`);
  }

  const shard = await loadShard(shardId);
  const entryKey = `${input.regionId}:${input.month}`;
  const summary = shard.entries[entryKey];
  if (!summary) {
    throw new Error(`No static summary entry for ${entryKey}`);
  }

  return summary;
}

export function clearStaticWeatherCache(): void {
  manifestPromise = null;
  shardIndexPromise = null;
  shardCache.clear();
}

export async function fetchStaticWeatherSummary(input: {
  region: Region;
  month: Month;
  includeMarine: boolean;
}): Promise<OpenMeteoMonthlySummary> {
  const manifest = await loadManifest();
  const summary = await loadRegionMonthSummary({
    manifest,
    regionId: input.region.id,
    month: input.month,
  });

  return summaryWithMarinePreference(summary, input.includeMarine);
}
