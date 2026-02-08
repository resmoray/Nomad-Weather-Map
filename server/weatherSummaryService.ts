import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

interface RegionMeta {
  id: string;
  lat: number;
  lon: number;
  isCoastal: boolean;
}

interface ClimateDailyData {
  time?: string[];
  temperature_2m_mean?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  relative_humidity_2m_mean?: Array<number | null>;
  relativehumidity_2m_mean?: Array<number | null>;
  wind_speed_10m_mean?: Array<number | null>;
  windspeed_10m_mean?: Array<number | null>;
}

interface AirHourlyData {
  time?: string[];
  pm2_5?: Array<number | null>;
  us_aqi?: Array<number | null>;
  uv_index?: Array<number | null>;
}

interface MarineHourlyData {
  time?: string[];
  wave_height?: Array<number | null>;
  wave_direction?: Array<number | null>;
  wave_period?: Array<number | null>;
}

export interface OpenMeteoMonthlySummary {
  temperatureC: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  rainfallMm: number | null;
  humidityPct: number | null;
  windKph: number | null;
  uvIndex: number | null;
  pm25: number | null;
  aqi: number | null;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
  climateLastUpdated: string;
  airQualityLastUpdated: string;
  marineLastUpdated: string;
}

interface CachedSummaryEntry {
  keyInput: string;
  summary: OpenMeteoMonthlySummary;
  storedAt: string;
}

interface SnapshotMonthEntry {
  month: number;
  includesMarine: boolean;
  baselineYears: number[];
  fetchedAt: string;
  source: "open-meteo";
  summary: OpenMeteoMonthlySummary;
}

interface RegionSnapshotFile {
  version: number;
  regionId: string;
  months: Record<string, SnapshotMonthEntry>;
}

interface ManualRawMonthData {
  temp_min_c?: number | null;
  temp_avg_c?: number | null;
  temp_max_c?: number | null;
  rain_mm?: number | null;
  humidity_pct?: number | null;
  wind_avg_kph?: number | null;
  uv_index_avg?: number | null;
  pm25_ug_m3?: number | null;
  aqi_avg?: number | null;
  wave_height_avg_m?: number | null;
  wave_interval_avg_s?: number | null;
}

interface ManualMonthRow {
  month?: number;
  raw?: ManualRawMonthData;
  climate_last_updated?: string;
  air_last_updated?: string;
  marine_last_updated?: string;
}

interface ManualSourceInfo {
  last_updated?: string;
}

interface ManualCityMonthFile {
  region_id?: string;
  sources?: {
    climate?: ManualSourceInfo;
    air?: ManualSourceInfo;
    marine?: ManualSourceInfo;
  };
  months?: ManualMonthRow[];
}

export type WeatherSummaryResolveSource =
  | "snapshot_fresh"
  | "snapshot_stale"
  | "refreshed";

export interface WeatherSummaryResolveResult {
  summary: OpenMeteoMonthlySummary;
  source: WeatherSummaryResolveSource;
}

type WeatherSummaryResolveMode = "verified_only" | "refresh_if_stale" | "force_refresh";

const DEFAULT_CLIMATE_FALLBACK_BASE_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const DEFAULT_CLIMATE_ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive";
const DEFAULT_AIR_BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const DEFAULT_MARINE_BASE_URL = "https://marine-api.open-meteo.com/v1/marine";
const DEFAULT_BASELINE_YEARS = 3;
const MIN_OPEN_METEO_YEAR = 2022;
const DEFAULT_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_FETCH_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 900;
const DEFAULT_UPSTREAM_REQUEST_SPACING_MS = 350;
const DEFAULT_RATE_LIMIT_MIN_BACKOFF_MS = 45000;
const DEFAULT_YEAR_CACHE_MAX_ENTRIES = 6;
const SUMMARY_CACHE_SCHEMA_VERSION = 2;
const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_CLIMATE_MAX_AGE_DAYS = 365;
const DEFAULT_AIR_MAX_AGE_DAYS = 90;
const DEFAULT_MARINE_MAX_AGE_DAYS = 365;

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_NAMES = new Set(["AbortError", "TypeError"]);
const CLIMATE_DAILY_FIELDS_PRIMARY =
  "temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_mean";
const CLIMATE_DAILY_FIELDS_LEGACY =
  "temperature_2m_mean,precipitation_sum,relativehumidity_2m_mean,windspeed_10m_mean";
const CLIMATE_DAILY_FIELDS_MINIMAL = "temperature_2m_mean,precipitation_sum";

const WEATHER_SUMMARY_CACHE_DIR = resolve(process.cwd(), ".cache", "weather-summary");
const WEATHER_SNAPSHOT_DIR = resolve(process.cwd(), ".cache", "weather-snapshot");
const MANUAL_WEATHER_DATA_DIR_RAW = (process.env.WEATHER_MANUAL_DATA_DIR ?? "data/manual-city-month").trim();
const MANUAL_WEATHER_DATA_DIR = MANUAL_WEATHER_DATA_DIR_RAW
  ? resolve(process.cwd(), MANUAL_WEATHER_DATA_DIR_RAW)
  : "";
const WEATHER_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.WEATHER_SUMMARY_TIMEOUT_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
);
const WEATHER_FETCH_ATTEMPTS = parsePositiveInt(
  process.env.WEATHER_SUMMARY_ATTEMPTS,
  DEFAULT_FETCH_ATTEMPTS,
);
const WEATHER_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.WEATHER_SUMMARY_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_BASE_DELAY_MS,
);
const RATE_LIMIT_MIN_BACKOFF_MS = parsePositiveInt(
  process.env.WEATHER_RATE_LIMIT_MIN_BACKOFF_MS,
  DEFAULT_RATE_LIMIT_MIN_BACKOFF_MS,
);
const UPSTREAM_REQUEST_SPACING_MS = parsePositiveInt(
  process.env.WEATHER_UPSTREAM_REQUEST_SPACING_MS,
  DEFAULT_UPSTREAM_REQUEST_SPACING_MS,
);
const YEAR_CACHE_MAX_ENTRIES = parsePositiveInt(
  process.env.WEATHER_YEAR_CACHE_MAX_ENTRIES,
  DEFAULT_YEAR_CACHE_MAX_ENTRIES,
);
const CLIMATE_MAX_AGE_MS =
  parsePositiveInt(process.env.WEATHER_SNAPSHOT_CLIMATE_MAX_AGE_DAYS, DEFAULT_CLIMATE_MAX_AGE_DAYS) *
  24 *
  60 *
  60 *
  1000;
const AIR_MAX_AGE_MS =
  parsePositiveInt(process.env.WEATHER_SNAPSHOT_AIR_MAX_AGE_DAYS, DEFAULT_AIR_MAX_AGE_DAYS) *
  24 *
  60 *
  60 *
  1000;
const MARINE_MAX_AGE_MS =
  parsePositiveInt(process.env.WEATHER_SNAPSHOT_MARINE_MAX_AGE_DAYS, DEFAULT_MARINE_MAX_AGE_DAYS) *
  24 *
  60 *
  60 *
  1000;
const AUTO_UPDATE_ENABLED = parseBooleanEnv(process.env.WEATHER_SNAPSHOT_AUTO_UPDATE_ENABLED, true);
const AUTO_UPDATE_INTERVAL_MS =
  parsePositiveInt(process.env.WEATHER_SNAPSHOT_AUTO_INTERVAL_MINUTES, 360) * 60 * 1000;
const AUTO_UPDATE_BATCH_SIZE = parsePositiveInt(process.env.WEATHER_SNAPSHOT_AUTO_BATCH_SIZE, 24);

const regionMap = (() => {
  const filePath = resolve(process.cwd(), "src/data/regions.json");
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Array<RegionMeta & { isCoastal?: boolean }>;
  return new Map(
    parsed.map((region) => [
      region.id,
      {
        id: region.id,
        lat: region.lat,
        lon: region.lon,
        isCoastal: region.isCoastal === true,
      },
    ]),
  );
})();

const memorySummaryCache = new Map<string, OpenMeteoMonthlySummary>();
const inFlightSummaryCache = new Map<string, Promise<OpenMeteoMonthlySummary>>();
let upstreamRequestQueue: Promise<void> = Promise.resolve();
let upstreamCooldownUntil = 0;

const climateYearCache = new Map<string, ClimateDailyData>();
const airYearCache = new Map<string, AirHourlyData>();
const marineYearCache = new Map<string, MarineHourlyData>();
let yearCacheRegionId: string | null = null;

const manualSummaryCache = new Map<string, OpenMeteoMonthlySummary>();
let manualSummaryCacheLoaded = false;

export function listWeatherRegionIds(): string[] {
  return [...regionMap.keys()].sort();
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseBooleanEnv(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return fallback;
}

function parseIsoDateOrFallback(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function manualSummaryCacheKey(regionId: string, month: number): string {
  return `${regionId}:${month}`;
}

function hasAnyManualMetric(summary: OpenMeteoMonthlySummary): boolean {
  return (
    summary.temperatureC !== null ||
    summary.temperatureMinC !== null ||
    summary.temperatureMaxC !== null ||
    summary.rainfallMm !== null ||
    summary.humidityPct !== null ||
    summary.windKph !== null ||
    summary.uvIndex !== null ||
    summary.pm25 !== null ||
    summary.aqi !== null ||
    summary.waveHeightM !== null ||
    summary.wavePeriodS !== null
  );
}

function loadManualSummaryCache(): void {
  if (manualSummaryCacheLoaded) {
    return;
  }

  manualSummaryCacheLoaded = true;

  if (!MANUAL_WEATHER_DATA_DIR || !existsSync(MANUAL_WEATHER_DATA_DIR)) {
    return;
  }

  const loadedAt = new Date().toISOString();
  const files = readdirSync(MANUAL_WEATHER_DATA_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();

  for (const fileName of files) {
    try {
      const filePath = resolve(MANUAL_WEATHER_DATA_DIR, fileName);
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as ManualCityMonthFile;
      const regionId = typeof parsed.region_id === "string" ? parsed.region_id.trim() : "";
      if (!regionId) {
        continue;
      }

      const months = Array.isArray(parsed.months) ? parsed.months : [];
      for (const monthRow of months) {
        if (!monthRow || typeof monthRow.month !== "number" || monthRow.month < 1 || monthRow.month > 12) {
          continue;
        }

        const rawMonth = monthRow.raw ?? {};
        const summary: OpenMeteoMonthlySummary = {
          temperatureC: toNumberOrNull(rawMonth.temp_avg_c),
          temperatureMinC: toNumberOrNull(rawMonth.temp_min_c),
          temperatureMaxC: toNumberOrNull(rawMonth.temp_max_c),
          rainfallMm: toNumberOrNull(rawMonth.rain_mm),
          humidityPct: toNumberOrNull(rawMonth.humidity_pct),
          windKph: toNumberOrNull(rawMonth.wind_avg_kph),
          uvIndex: toNumberOrNull(rawMonth.uv_index_avg),
          pm25: toNumberOrNull(rawMonth.pm25_ug_m3),
          aqi: toNumberOrNull(rawMonth.aqi_avg),
          waveHeightM: toNumberOrNull(rawMonth.wave_height_avg_m),
          wavePeriodS: toNumberOrNull(rawMonth.wave_interval_avg_s),
          waveDirectionDeg: null,
          climateLastUpdated: parseIsoDateOrFallback(
            monthRow.climate_last_updated ?? parsed.sources?.climate?.last_updated,
            loadedAt,
          ),
          airQualityLastUpdated: parseIsoDateOrFallback(
            monthRow.air_last_updated ?? parsed.sources?.air?.last_updated,
            loadedAt,
          ),
          marineLastUpdated: parseIsoDateOrFallback(
            monthRow.marine_last_updated ?? parsed.sources?.marine?.last_updated,
            loadedAt,
          ),
        };

        if (!hasAnyManualMetric(summary)) {
          continue;
        }

        manualSummaryCache.set(manualSummaryCacheKey(regionId, monthRow.month), summary);
      }
    } catch {
      // Skip invalid manual files; runtime weather requests should remain resilient.
    }
  }
}

function getManualSummaryForRegionMonth(regionId: string, month: number): OpenMeteoMonthlySummary | null {
  loadManualSummaryCache();
  return manualSummaryCache.get(manualSummaryCacheKey(regionId, month)) ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const asSeconds = Number.parseInt(value, 10);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, asDate - Date.now());
}

function getRetryDelayMs(attempt: number, retryAfterMs?: number | null): number {
  const exponentialDelay = WEATHER_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * WEATHER_RETRY_BASE_DELAY_MS);
  return Math.max(retryAfterMs ?? 0, exponentialDelay + jitter);
}

function isRetryableError(error: unknown): boolean {
  return error instanceof Error && RETRYABLE_ERROR_NAMES.has(error.name);
}

function extendUpstreamCooldown(ms: number): void {
  if (ms <= 0) {
    return;
  }

  const until = Date.now() + ms;
  upstreamCooldownUntil = Math.max(upstreamCooldownUntil, until);
}

async function waitForUpstreamCooldown(): Promise<void> {
  const waitMs = upstreamCooldownUntil - Date.now();
  if (waitMs > 0) {
    await sleep(waitMs);
  }
}

function runUpstreamTask<T>(task: () => Promise<T>): Promise<T> {
  const previous = upstreamRequestQueue.catch(() => {
    // Keep queue flow alive after previous failures.
  });
  let release: () => void = () => {
    // noop
  };
  upstreamRequestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  return previous
    .then(async () => {
      await waitForUpstreamCooldown();
      return task();
    })
    .finally(() => {
      setTimeout(release, UPSTREAM_REQUEST_SPACING_MS);
    });
}

function isHttpStatusError(error: unknown, statusCode: number): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(`status ${statusCode}`);
}

function isRateLimitError(error: unknown): boolean {
  return isHttpStatusError(error, 429);
}

async function fetchJsonWithRetry(url: string, label: string): Promise<unknown> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= WEATHER_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), WEATHER_FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await runUpstreamTask(() => fetch(url, { signal: controller.signal }));
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < WEATHER_FETCH_ATTEMPTS) {
          lastError = new Error(`${label} failed with status ${response.status}`);
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          const minBackoffMs = response.status === 429 ? RATE_LIMIT_MIN_BACKOFF_MS : 0;
          const effectiveRetryAfterMs =
            retryAfterMs === null ? minBackoffMs : Math.max(retryAfterMs, minBackoffMs);
          if (response.status === 429) {
            extendUpstreamCooldown(effectiveRetryAfterMs);
          }
          await sleep(getRetryDelayMs(attempt, effectiveRetryAfterMs));
          continue;
        }

        if (response.status === 429) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          const effectiveRetryAfterMs =
            retryAfterMs === null ? RATE_LIMIT_MIN_BACKOFF_MS : Math.max(retryAfterMs, RATE_LIMIT_MIN_BACKOFF_MS);
          extendUpstreamCooldown(effectiveRetryAfterMs);
        }

        throw new Error(`${label} failed with status ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (isRateLimitError(error)) {
        extendUpstreamCooldown(RATE_LIMIT_MIN_BACKOFF_MS);
      }

      if (isRetryableError(error) && attempt < WEATHER_FETCH_ATTEMPTS) {
        lastError = error;
        await sleep(getRetryDelayMs(attempt));
        continue;
      }

      if (error instanceof Error) {
        throw new Error(`${label} request failed (${error.message})`);
      }

      throw new Error(`${label} request failed`);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(`${label} failed after retries`));
}

function toNumberArray(input: unknown): Array<number | null> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.map((value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    return null;
  });
}

function asClimateDailyData(payload: unknown): ClimateDailyData | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const daily = (payload as { daily?: unknown }).daily;
  if (!daily || typeof daily !== "object") {
    return null;
  }

  const typed = daily as Record<string, unknown>;

  return {
    time: Array.isArray(typed.time) ? typed.time.filter((value): value is string => typeof value === "string") : [],
    temperature_2m_mean: toNumberArray(typed.temperature_2m_mean),
    precipitation_sum: toNumberArray(typed.precipitation_sum),
    relative_humidity_2m_mean: toNumberArray(typed.relative_humidity_2m_mean),
    relativehumidity_2m_mean: toNumberArray(typed.relativehumidity_2m_mean),
    wind_speed_10m_mean: toNumberArray(typed.wind_speed_10m_mean),
    windspeed_10m_mean: toNumberArray(typed.windspeed_10m_mean),
  };
}

function asAirHourlyData(payload: unknown): AirHourlyData | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const hourly = (payload as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") {
    return null;
  }

  const typed = hourly as Record<string, unknown>;

  return {
    time: Array.isArray(typed.time) ? typed.time.filter((value): value is string => typeof value === "string") : [],
    pm2_5: toNumberArray(typed.pm2_5),
    us_aqi: toNumberArray(typed.us_aqi),
    uv_index: toNumberArray(typed.uv_index),
  };
}

function asMarineHourlyData(payload: unknown): MarineHourlyData | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const hourly = (payload as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") {
    return null;
  }

  const typed = hourly as Record<string, unknown>;

  return {
    time: Array.isArray(typed.time) ? typed.time.filter((value): value is string => typeof value === "string") : [],
    wave_height: toNumberArray(typed.wave_height),
    wave_direction: toNumberArray(typed.wave_direction),
    wave_period: toNumberArray(typed.wave_period),
  };
}

function getMonthDateRange(year: number, month: number): { startDate: string; endDate: string } {
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${year}-${paddedMonth}-01`;
  const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

function getYearDateRange(year: number): { startDate: string; endDate: string } {
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function createClimateUrlForRange(
  region: RegionMeta,
  startDate: string,
  endDate: string,
  baseUrl: string,
  dailyFields: string,
): string {
  const params = new URLSearchParams({
    latitude: String(region.lat),
    longitude: String(region.lon),
    start_date: startDate,
    end_date: endDate,
    timezone: "UTC",
    daily: dailyFields,
  });

  return `${baseUrl}?${params.toString()}`;
}

function createAirUrlForRange(region: RegionMeta, startDate: string, endDate: string): string {
  const baseUrl = (process.env.VITE_OPEN_METEO_AIR_BASE_URL ?? DEFAULT_AIR_BASE_URL).trim();
  const params = new URLSearchParams({
    latitude: String(region.lat),
    longitude: String(region.lon),
    start_date: startDate,
    end_date: endDate,
    timezone: "UTC",
    hourly: "pm2_5,us_aqi,uv_index",
  });

  return `${baseUrl}?${params.toString()}`;
}

function createMarineUrlForRange(region: RegionMeta, startDate: string, endDate: string): string {
  const baseUrl = (process.env.VITE_OPEN_METEO_MARINE_BASE_URL ?? DEFAULT_MARINE_BASE_URL).trim();
  const params = new URLSearchParams({
    latitude: String(region.lat),
    longitude: String(region.lon),
    start_date: startDate,
    end_date: endDate,
    timezone: "UTC",
    hourly: "wave_height,wave_direction,wave_period",
  });

  return `${baseUrl}?${params.toString()}`;
}

function getClimateBaseUrls(): string[] {
  const configuredPrimary = (process.env.VITE_OPEN_METEO_CLIMATE_BASE_URL ?? "").trim();
  const configuredFallback = (process.env.VITE_OPEN_METEO_CLIMATE_FALLBACK_BASE_URL ?? "").trim();
  const configuredArchive = (process.env.VITE_OPEN_METEO_CLIMATE_ARCHIVE_BASE_URL ?? "").trim();

  if (configuredPrimary || configuredFallback || configuredArchive) {
    const configuredCandidates = [configuredPrimary, configuredFallback, configuredArchive].filter(Boolean);
    return [...new Set(configuredCandidates)];
  }

  // Default to historical endpoints. The climate endpoint can trigger stricter throttling.
  const candidates = [DEFAULT_CLIMATE_FALLBACK_BASE_URL, DEFAULT_CLIMATE_ARCHIVE_BASE_URL];

  return [...new Set(candidates)];
}

function boundedCacheSet<T>(cache: Map<string, T>, key: string, value: T): void {
  if (!cache.has(key) && cache.size >= YEAR_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value as string | undefined;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  cache.set(key, value);
}

function monthFromIsoString(value: string): number | null {
  if (value.length < 7) {
    return null;
  }

  const month = Number.parseInt(value.slice(5, 7), 10);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return month;
}

function indexesForMonth(times: string[], month: number): number[] {
  const indexes: number[] = [];

  for (let index = 0; index < times.length; index += 1) {
    const parsedMonth = monthFromIsoString(times[index] ?? "");
    if (parsedMonth === month) {
      indexes.push(index);
    }
  }

  return indexes;
}

function pickValuesByIndexes(values: Array<number | null> | undefined, indexes: number[]): Array<number | null> {
  if (!values || indexes.length === 0) {
    return [];
  }

  return indexes.map((index) => values[index] ?? null);
}

function sliceClimateDataByMonth(data: ClimateDailyData, month: number): ClimateDailyData | null {
  const times = data.time ?? [];
  if (times.length === 0) {
    return null;
  }

  const indexes = indexesForMonth(times, month);
  if (indexes.length === 0) {
    return null;
  }

  return {
    time: indexes.map((index) => times[index] ?? ""),
    temperature_2m_mean: pickValuesByIndexes(data.temperature_2m_mean, indexes),
    precipitation_sum: pickValuesByIndexes(data.precipitation_sum, indexes),
    relative_humidity_2m_mean: pickValuesByIndexes(data.relative_humidity_2m_mean, indexes),
    relativehumidity_2m_mean: pickValuesByIndexes(data.relativehumidity_2m_mean, indexes),
    wind_speed_10m_mean: pickValuesByIndexes(data.wind_speed_10m_mean, indexes),
    windspeed_10m_mean: pickValuesByIndexes(data.windspeed_10m_mean, indexes),
  };
}

function sliceAirDataByMonth(data: AirHourlyData, month: number): AirHourlyData | null {
  const times = data.time ?? [];
  if (times.length === 0) {
    return null;
  }

  const indexes = indexesForMonth(times, month);
  if (indexes.length === 0) {
    return null;
  }

  return {
    time: indexes.map((index) => times[index] ?? ""),
    pm2_5: pickValuesByIndexes(data.pm2_5, indexes),
    us_aqi: pickValuesByIndexes(data.us_aqi, indexes),
    uv_index: pickValuesByIndexes(data.uv_index, indexes),
  };
}

function sliceMarineDataByMonth(data: MarineHourlyData, month: number): MarineHourlyData | null {
  const times = data.time ?? [];
  if (times.length === 0) {
    return null;
  }

  const indexes = indexesForMonth(times, month);
  if (indexes.length === 0) {
    return null;
  }

  return {
    time: indexes.map((index) => times[index] ?? ""),
    wave_height: pickValuesByIndexes(data.wave_height, indexes),
    wave_direction: pickValuesByIndexes(data.wave_direction, indexes),
    wave_period: pickValuesByIndexes(data.wave_period, indexes),
  };
}

function climateYearKey(region: RegionMeta, year: number): string {
  return `${region.id}:${year}`;
}

function airYearKey(region: RegionMeta, year: number): string {
  return `${region.id}:${year}`;
}

function marineYearKey(region: RegionMeta, year: number): string {
  return `${region.id}:${year}`;
}

function resetYearCachesIfRegionChanged(regionId: string): void {
  if (yearCacheRegionId === regionId) {
    return;
  }

  yearCacheRegionId = regionId;
  climateYearCache.clear();
  airYearCache.clear();
  marineYearCache.clear();
}

async function fetchClimateForRange(
  region: RegionMeta,
  startDate: string,
  endDate: string,
  yearLabel: string,
): Promise<ClimateDailyData> {
  const baseUrls = getClimateBaseUrls();
  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    const primaryUrl = createClimateUrlForRange(region, startDate, endDate, baseUrl, CLIMATE_DAILY_FIELDS_PRIMARY);

    try {
      const payload = await fetchJsonWithRetry(primaryUrl, `Climate API (${yearLabel})`);
      const parsed = asClimateDailyData(payload);
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      lastError = error;

      // Legacy field names are only useful for bad-request shape mismatches.
      if (!isHttpStatusError(error, 400)) {
        continue;
      }
    }

    const fallbackFieldSets = [CLIMATE_DAILY_FIELDS_LEGACY, CLIMATE_DAILY_FIELDS_MINIMAL];
    for (const dailyFields of fallbackFieldSets) {
      const fallbackUrl = createClimateUrlForRange(region, startDate, endDate, baseUrl, dailyFields);

      try {
        const payload = await fetchJsonWithRetry(fallbackUrl, `Climate API (${yearLabel})`);
        const parsed = asClimateDailyData(payload);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(`Climate API (${yearLabel}) failed`));
}

async function fetchClimateMonthDirect(region: RegionMeta, year: number, month: number): Promise<ClimateDailyData> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  return fetchClimateForRange(region, startDate, endDate, `${year}-${String(month).padStart(2, "0")}`);
}

async function fetchClimateYear(region: RegionMeta, year: number): Promise<ClimateDailyData> {
  const cacheKey = climateYearKey(region, year);
  const cached = climateYearCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { startDate, endDate } = getYearDateRange(year);
  const parsed = await fetchClimateForRange(region, startDate, endDate, `${year}`);
  boundedCacheSet(climateYearCache, cacheKey, parsed);
  return parsed;
}

async function fetchClimateMonth(region: RegionMeta, year: number, month: number): Promise<ClimateDailyData> {
  const yearData = await fetchClimateYear(region, year);
  const sliced = sliceClimateDataByMonth(yearData, month);
  if (sliced) {
    return sliced;
  }

  return fetchClimateMonthDirect(region, year, month);
}

async function fetchAirForRange(region: RegionMeta, startDate: string, endDate: string, yearLabel: string): Promise<AirHourlyData> {
  const url = createAirUrlForRange(region, startDate, endDate);
  const payload = await fetchJsonWithRetry(url, `Air API (${yearLabel})`);
  const parsed = asAirHourlyData(payload);
  if (!parsed) {
    throw new Error(`Air API (${yearLabel}) returned unexpected data`);
  }

  return parsed;
}

async function fetchAirMonthDirect(region: RegionMeta, year: number, month: number): Promise<AirHourlyData> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  return fetchAirForRange(region, startDate, endDate, `${year}-${String(month).padStart(2, "0")}`);
}

async function fetchAirYear(region: RegionMeta, year: number): Promise<AirHourlyData> {
  const cacheKey = airYearKey(region, year);
  const cached = airYearCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { startDate, endDate } = getYearDateRange(year);
  const parsed = await fetchAirForRange(region, startDate, endDate, `${year}`);
  boundedCacheSet(airYearCache, cacheKey, parsed);
  return parsed;
}

async function fetchAirMonth(region: RegionMeta, year: number, month: number): Promise<AirHourlyData> {
  const yearData = await fetchAirYear(region, year);
  const sliced = sliceAirDataByMonth(yearData, month);
  if (sliced) {
    return sliced;
  }

  return fetchAirMonthDirect(region, year, month);
}

async function fetchMarineForRange(
  region: RegionMeta,
  startDate: string,
  endDate: string,
  yearLabel: string,
): Promise<MarineHourlyData> {
  const url = createMarineUrlForRange(region, startDate, endDate);
  const payload = await fetchJsonWithRetry(url, `Marine API (${yearLabel})`);
  const parsed = asMarineHourlyData(payload);
  if (!parsed) {
    throw new Error(`Marine API (${yearLabel}) returned unexpected data`);
  }

  return parsed;
}

async function fetchMarineMonthDirect(region: RegionMeta, year: number, month: number): Promise<MarineHourlyData> {
  const { startDate, endDate } = getMonthDateRange(year, month);
  return fetchMarineForRange(region, startDate, endDate, `${year}-${String(month).padStart(2, "0")}`);
}

async function fetchMarineYear(region: RegionMeta, year: number): Promise<MarineHourlyData> {
  const cacheKey = marineYearKey(region, year);
  const cached = marineYearCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { startDate, endDate } = getYearDateRange(year);
  const parsed = await fetchMarineForRange(region, startDate, endDate, `${year}`);
  boundedCacheSet(marineYearCache, cacheKey, parsed);
  return parsed;
}

async function fetchMarineMonth(region: RegionMeta, year: number, month: number): Promise<MarineHourlyData> {
  const yearData = await fetchMarineYear(region, year);
  const sliced = sliceMarineDataByMonth(yearData, month);
  if (sliced) {
    return sliced;
  }

  return fetchMarineMonthDirect(region, year, month);
}

function cleanValues(values: Array<number | null> | undefined): number[] {
  if (!values) {
    return [];
  }

  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function toNumberOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

function minimum(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number(Math.min(...values).toFixed(2));
}

function maximum(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number(Math.max(...values).toFixed(2));
}

function sum(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Number(values.reduce((acc, value) => acc + value, 0).toFixed(2));
}

function averageDailyMaxUv(data: AirHourlyData[]): number | null {
  const dailyMaxValues: number[] = [];

  for (const monthData of data) {
    const times = monthData.time ?? [];
    const uvValues = monthData.uv_index ?? [];
    const byDay = new Map<string, number>();

    for (let index = 0; index < uvValues.length; index += 1) {
      const uvValue = uvValues[index];
      const timeValue = times[index];

      if (typeof uvValue !== "number" || Number.isNaN(uvValue) || typeof timeValue !== "string") {
        continue;
      }

      const dayKey = timeValue.slice(0, 10);
      const currentMax = byDay.get(dayKey);
      if (currentMax === undefined || uvValue > currentMax) {
        byDay.set(dayKey, uvValue);
      }
    }

    dailyMaxValues.push(...byDay.values());
  }

  return average(dailyMaxValues);
}

function aggregateClimate(data: ClimateDailyData[]): {
  temperatureC: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  rainfallMm: number | null;
  humidityPct: number | null;
  windKph: number | null;
} {
  const temperatures = data.flatMap((monthData) => cleanValues(monthData.temperature_2m_mean));
  const humidity = data.flatMap((monthData) =>
    cleanValues(monthData.relative_humidity_2m_mean ?? monthData.relativehumidity_2m_mean),
  );
  const wind = data.flatMap((monthData) =>
    cleanValues(monthData.wind_speed_10m_mean ?? monthData.windspeed_10m_mean),
  );
  const rainfallPerYear = data
    .map((monthData) => sum(cleanValues(monthData.precipitation_sum)))
    .map(toNumberOrNull)
    .filter((value): value is number => value !== null);

  return {
    temperatureC: average(temperatures),
    temperatureMinC: minimum(temperatures),
    temperatureMaxC: maximum(temperatures),
    rainfallMm: average(rainfallPerYear),
    humidityPct: average(humidity),
    windKph: average(wind),
  };
}

function aggregateAir(data: AirHourlyData[]): {
  uvIndex: number | null;
  pm25: number | null;
  aqi: number | null;
} {
  const pmValues = data.flatMap((monthData) => cleanValues(monthData.pm2_5));
  const aqiValues = data.flatMap((monthData) => cleanValues(monthData.us_aqi));

  return {
    uvIndex: averageDailyMaxUv(data),
    pm25: average(pmValues),
    aqi: average(aqiValues),
  };
}

function aggregateMarine(data: MarineHourlyData[]): {
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
} {
  const waveHeight = data.flatMap((monthData) => cleanValues(monthData.wave_height));
  const waveDirection = data.flatMap((monthData) => cleanValues(monthData.wave_direction));
  const wavePeriod = data.flatMap((monthData) => cleanValues(monthData.wave_period));

  return {
    waveHeightM: average(waveHeight),
    waveDirectionDeg: average(waveDirection),
    wavePeriodS: average(wavePeriod),
  };
}

function getBaselineYears(): number[] {
  const configuredYears = parsePositiveInt(
    process.env.WEATHER_BASELINE_YEARS ?? process.env.VITE_WEATHER_BASELINE_YEARS,
    DEFAULT_BASELINE_YEARS,
  );

  const currentYear = new Date().getUTCFullYear();
  const endYear = Math.max(MIN_OPEN_METEO_YEAR, currentYear - 1);
  const startYear = Math.max(MIN_OPEN_METEO_YEAR, endYear - configuredYears + 1);
  const years: number[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  return years;
}

function cacheKeyInput(params: {
  regionId: string;
  month: number;
  includeMarine: boolean;
  baselineYears: number[];
}): string {
  return JSON.stringify({
    version: SUMMARY_CACHE_SCHEMA_VERSION,
    regionId: params.regionId,
    month: params.month,
    includeMarine: params.includeMarine,
    baselineYears: params.baselineYears,
  });
}

function summaryCachePathForKey(keyInput: string): string {
  const keyHash = createHash("sha1").update(keyInput).digest("hex");
  return resolve(WEATHER_SUMMARY_CACHE_DIR, `${keyHash}.json`);
}

function isValidSummary(summary: unknown): summary is OpenMeteoMonthlySummary {
  if (!summary || typeof summary !== "object") {
    return false;
  }

  const requiredNumberFields: Array<keyof OpenMeteoMonthlySummary> = [
    "temperatureC",
    "temperatureMinC",
    "temperatureMaxC",
    "rainfallMm",
    "humidityPct",
    "windKph",
    "uvIndex",
    "pm25",
    "aqi",
    "waveHeightM",
    "wavePeriodS",
    "waveDirectionDeg",
  ];
  const requiredStringFields: Array<keyof OpenMeteoMonthlySummary> = [
    "climateLastUpdated",
    "airQualityLastUpdated",
    "marineLastUpdated",
  ];

  const typed = summary as Record<string, unknown>;
  const plausibleRanges: Partial<Record<keyof OpenMeteoMonthlySummary, [number, number]>> = {
    temperatureC: [-80, 60],
    temperatureMinC: [-90, 60],
    temperatureMaxC: [-90, 70],
    rainfallMm: [0, 3000],
    humidityPct: [0, 100],
    windKph: [0, 300],
    uvIndex: [0, 20],
    pm25: [0, 1000],
    aqi: [0, 500],
    waveHeightM: [0, 30],
    wavePeriodS: [0, 30],
    waveDirectionDeg: [0, 360],
  };

  const numberFieldsValid = requiredNumberFields.every((field) => {
    const value = typed[field];
    if (value === null) {
      return true;
    }

    if (typeof value !== "number" || !Number.isFinite(value)) {
      return false;
    }

    const range = plausibleRanges[field];
    if (!range) {
      return true;
    }

    return value >= range[0] && value <= range[1];
  });
  if (!numberFieldsValid) {
    return false;
  }

  return requiredStringFields.every((field) => typeof typed[field] === "string");
}

function readSummaryFromDisk(cachePath: string, keyInput: string): OpenMeteoMonthlySummary | null {
  if (!existsSync(cachePath)) {
    return null;
  }

  try {
    const raw = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as CachedSummaryEntry;
    if (!parsed || parsed.keyInput !== keyInput) {
      return null;
    }

    if (!isValidSummary(parsed.summary)) {
      return null;
    }

    return parsed.summary;
  } catch {
    return null;
  }
}

function writeSummaryToDisk(cachePath: string, keyInput: string, summary: OpenMeteoMonthlySummary): void {
  mkdirSync(WEATHER_SUMMARY_CACHE_DIR, { recursive: true });
  const payload: CachedSummaryEntry = {
    keyInput,
    summary,
    storedAt: new Date().toISOString(),
  };
  const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(payload), "utf-8");
  renameSync(tempPath, cachePath);
}

function snapshotFilePath(regionId: string): string {
  return resolve(WEATHER_SNAPSHOT_DIR, `${regionId}.json`);
}

function parseSnapshotMonthEntry(raw: unknown): SnapshotMonthEntry | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const typed = raw as Record<string, unknown>;
  const month = typeof typed.month === "number" ? typed.month : Number.NaN;
  const includesMarine = typeof typed.includesMarine === "boolean" ? typed.includesMarine : null;
  const fetchedAt = typeof typed.fetchedAt === "string" ? typed.fetchedAt : "";
  const source = typed.source === "open-meteo" ? "open-meteo" : null;
  const summary = typed.summary;
  const baselineRaw = Array.isArray(typed.baselineYears) ? typed.baselineYears : [];
  const baselineYears = baselineRaw.filter(
    (value): value is number => typeof value === "number" && Number.isInteger(value),
  );

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    includesMarine === null ||
    !fetchedAt ||
    source === null ||
    !isValidSummary(summary)
  ) {
    return null;
  }

  return {
    month,
    includesMarine,
    baselineYears,
    fetchedAt,
    source,
    summary,
  };
}

function readRegionSnapshot(regionId: string): RegionSnapshotFile {
  const filePath = snapshotFilePath(regionId);
  const empty: RegionSnapshotFile = {
    version: SNAPSHOT_SCHEMA_VERSION,
    regionId,
    months: {},
  };

  if (!existsSync(filePath)) {
    return empty;
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const version = typeof parsed.version === "number" ? parsed.version : Number.NaN;
    const parsedRegionId = typeof parsed.regionId === "string" ? parsed.regionId : "";
    const monthsRaw = parsed.months && typeof parsed.months === "object" ? parsed.months : {};

    if (version !== SNAPSHOT_SCHEMA_VERSION || parsedRegionId !== regionId) {
      return empty;
    }

    const months: Record<string, SnapshotMonthEntry> = {};
    for (const [monthKey, rawEntry] of Object.entries(monthsRaw as Record<string, unknown>)) {
      const entry = parseSnapshotMonthEntry(rawEntry);
      if (!entry) {
        continue;
      }

      months[monthKey] = entry;
    }

    return {
      version: SNAPSHOT_SCHEMA_VERSION,
      regionId,
      months,
    };
  } catch {
    return empty;
  }
}

function writeRegionSnapshot(snapshot: RegionSnapshotFile): void {
  mkdirSync(WEATHER_SNAPSHOT_DIR, { recursive: true });
  const filePath = snapshotFilePath(snapshot.regionId);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(snapshot), "utf-8");
  renameSync(tempPath, filePath);
}

function baselineYearsEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function ageExceeded(updatedAt: string, maxAgeMs: number, now: number): boolean {
  const timestamp = Date.parse(updatedAt);
  if (Number.isNaN(timestamp)) {
    return true;
  }

  return now - timestamp > maxAgeMs;
}

function snapshotStaleReason(
  entry: SnapshotMonthEntry,
  baselineYears: number[],
  includeMarine: boolean,
  now: number,
): string | null {
  if (!baselineYearsEqual(entry.baselineYears, baselineYears)) {
    return "baseline-years-changed";
  }

  if (ageExceeded(entry.summary.climateLastUpdated, CLIMATE_MAX_AGE_MS, now)) {
    return "climate-expired";
  }

  if (ageExceeded(entry.summary.airQualityLastUpdated, AIR_MAX_AGE_MS, now)) {
    return "air-expired";
  }

  if (includeMarine) {
    if (!entry.includesMarine) {
      return "marine-missing";
    }

    if (ageExceeded(entry.summary.marineLastUpdated, MARINE_MAX_AGE_MS, now)) {
      return "marine-expired";
    }
  }

  return null;
}

function findSnapshotEntry(
  regionId: string,
  month: number,
  includeMarine: boolean,
): SnapshotMonthEntry | null {
  void includeMarine;
  const snapshot = readRegionSnapshot(regionId);
  const directEntry = snapshot.months[String(month)] ?? null;
  return directEntry;
}

function upsertSnapshotEntry(input: {
  regionId: string;
  month: number;
  includeMarine: boolean;
  baselineYears: number[];
  summary: OpenMeteoMonthlySummary;
}): void {
  const snapshot = readRegionSnapshot(input.regionId);
  const previous = snapshot.months[String(input.month)] ?? null;
  const nextEntry: SnapshotMonthEntry = {
    month: input.month,
    includesMarine: previous?.includesMarine ? true : input.includeMarine,
    baselineYears: [...input.baselineYears],
    fetchedAt: new Date().toISOString(),
    source: "open-meteo",
    summary: input.summary,
  };

  snapshot.months[String(input.month)] = nextEntry;
  writeRegionSnapshot(snapshot);
}

function withMarinePreference(
  summary: OpenMeteoMonthlySummary,
  includeMarine: boolean,
): OpenMeteoMonthlySummary {
  if (includeMarine) {
    return summary;
  }

  return {
    ...summary,
    waveHeightM: null,
    waveDirectionDeg: null,
    wavePeriodS: null,
  };
}

function includeMarineForRegion(region: RegionMeta, includeMarineRequested: boolean): boolean {
  return includeMarineRequested && region.isCoastal;
}

async function buildSummary(params: {
  region: RegionMeta;
  month: number;
  includeMarine: boolean;
  baselineYears: number[];
}): Promise<OpenMeteoMonthlySummary> {
  const climateData: ClimateDailyData[] = [];
  const airData: AirHourlyData[] = [];
  const marineData: MarineHourlyData[] = [];
  const climateErrors: string[] = [];
  let sawRateLimit = false;

  for (const year of params.baselineYears) {
    try {
      climateData.push(await fetchClimateMonth(params.region, year, params.month));
    } catch (error) {
      climateErrors.push(error instanceof Error ? error.message : `Climate API (${year}) failed`);

      if (isRateLimitError(error)) {
        sawRateLimit = true;
      }
    }

    if (sawRateLimit) {
      // Stop bulk baseline loading once throttled; fallback pass below handles recovery.
      break;
    }

    try {
      airData.push(await fetchAirMonth(params.region, year, params.month));
    } catch {
      // Missing air data is tolerated for resilient output.
    }

    if (params.includeMarine) {
      try {
        marineData.push(await fetchMarineMonth(params.region, year, params.month));
      } catch {
        // Missing marine data is tolerated.
      }
    }
  }

  if (climateData.length === 0) {
    await sleep(sawRateLimit ? 2600 : 2200);
    const latestYear = params.baselineYears[params.baselineYears.length - 1];
    try {
      climateData.push(await fetchClimateMonth(params.region, latestYear, params.month));
    } catch (error) {
      climateErrors.push(error instanceof Error ? error.message : `Climate API (${latestYear}) failed`);
    }
  }

  if (climateData.length === 0) {
    const reasonSuffix = climateErrors[0] ? ` (${climateErrors[0]})` : "";
    throw new Error(`Unable to load verified climate data for selected region and month${reasonSuffix}.`);
  }

  const climateMetrics = aggregateClimate(climateData);
  const airMetrics = airData.length > 0 ? aggregateAir(airData) : { uvIndex: null, pm25: null, aqi: null };
  const marineMetrics =
    params.includeMarine && marineData.length > 0
      ? aggregateMarine(marineData)
      : {
          waveHeightM: null,
          waveDirectionDeg: null,
          wavePeriodS: null,
        };
  const now = new Date().toISOString();

  return {
    ...climateMetrics,
    ...airMetrics,
    ...marineMetrics,
    climateLastUpdated: now,
    airQualityLastUpdated: now,
    marineLastUpdated: now,
  };
}

async function loadSummaryFromUpstream(input: {
  regionId: string;
  month: number;
  includeMarine: boolean;
}): Promise<OpenMeteoMonthlySummary> {
  const region = regionMap.get(input.regionId)!;
  resetYearCachesIfRegionChanged(region.id);

  const baselineYears = getBaselineYears();
  const keyInput = cacheKeyInput({
    regionId: input.regionId,
    month: input.month,
    includeMarine: input.includeMarine,
    baselineYears,
  });
  const cachePath = summaryCachePathForKey(keyInput);

  const memoryCached = memorySummaryCache.get(keyInput);
  if (memoryCached) {
    return memoryCached;
  }

  const diskCached = readSummaryFromDisk(cachePath, keyInput);
  if (diskCached) {
    memorySummaryCache.set(keyInput, diskCached);
    return diskCached;
  }

  const inFlight = inFlightSummaryCache.get(keyInput);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = (async () => {
    const summary = await buildSummary({
      region,
      month: input.month,
      includeMarine: input.includeMarine,
      baselineYears,
    });
    writeSummaryToDisk(cachePath, keyInput, summary);
    memorySummaryCache.set(keyInput, summary);
    return summary;
  })();

  inFlightSummaryCache.set(keyInput, loadPromise);

  try {
    return await loadPromise;
  } finally {
    inFlightSummaryCache.delete(keyInput);
  }
}

export async function resolveWeatherSummaryForRegionMonth(input: {
  regionId: string;
  month: number;
  includeMarine: boolean;
  mode?: WeatherSummaryResolveMode;
  allowStaleSnapshot?: boolean;
}): Promise<WeatherSummaryResolveResult> {
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    throw new Error("month must be between 1 and 12");
  }

  const region = regionMap.get(input.regionId);
  if (!region) {
    throw new Error(`Unknown regionId: ${input.regionId}`);
  }
  const includeMarine = includeMarineForRegion(region, input.includeMarine);
  const manualSummary = getManualSummaryForRegionMonth(input.regionId, input.month);

  const mode = input.mode ?? "verified_only";
  const allowStaleSnapshot = input.allowStaleSnapshot ?? true;
  const baselineYears = getBaselineYears();
  const now = Date.now();
  const snapshotEntry = findSnapshotEntry(input.regionId, input.month, includeMarine);
  const staleReason = snapshotEntry
    ? snapshotStaleReason(snapshotEntry, baselineYears, includeMarine, now)
    : "missing";
  const snapshotFresh = snapshotEntry !== null && staleReason === null;

  if (mode !== "force_refresh" && snapshotFresh && snapshotEntry) {
    return {
      summary: withMarinePreference(snapshotEntry.summary, includeMarine),
      source: "snapshot_fresh",
    };
  }

  if (mode !== "force_refresh" && manualSummary) {
    return {
      summary: withMarinePreference(manualSummary, includeMarine),
      source: "snapshot_fresh",
    };
  }

  if (mode === "verified_only") {
    if (snapshotEntry && allowStaleSnapshot) {
      return {
        summary: withMarinePreference(snapshotEntry.summary, includeMarine),
        source: "snapshot_stale",
      };
    }

    const baseMessage = snapshotEntry
      ? `Verified weather snapshot for ${input.regionId} month ${input.month} is stale (${staleReason}).`
      : `No verified weather snapshot for ${input.regionId} month ${input.month}.`;
    throw new Error(`${baseMessage} Run "npm run weather:snapshot:update" to refresh stored data.`);
  }

  try {
    const refreshed = await loadSummaryFromUpstream({
      regionId: input.regionId,
      month: input.month,
      includeMarine,
    });
    upsertSnapshotEntry({
      regionId: input.regionId,
      month: input.month,
      includeMarine,
      baselineYears,
      summary: refreshed,
    });

    return {
      summary: withMarinePreference(refreshed, includeMarine),
      source: "refreshed",
    };
  } catch (error) {
    if (snapshotEntry && allowStaleSnapshot) {
      return {
        summary: withMarinePreference(snapshotEntry.summary, includeMarine),
        source: "snapshot_stale",
      };
    }

    if (manualSummary && allowStaleSnapshot) {
      return {
        summary: withMarinePreference(manualSummary, includeMarine),
        source: "snapshot_stale",
      };
    }

    throw error;
  }
}

export async function getWeatherSummaryForRegionMonth(input: {
  regionId: string;
  month: number;
  includeMarine: boolean;
  mode?: WeatherSummaryResolveMode;
  allowStaleSnapshot?: boolean;
}): Promise<OpenMeteoMonthlySummary> {
  const resolved = await resolveWeatherSummaryForRegionMonth(input);
  return resolved.summary;
}

let autoUpdateTimer: ReturnType<typeof setInterval> | null = null;
let autoUpdateRunning = false;

function collectRowsForAutoUpdate(limit: number): Array<{ regionId: string; month: number; includeMarine: boolean }> {
  const rows: Array<{ regionId: string; month: number; includeMarine: boolean }> = [];
  const baselineYears = getBaselineYears();
  const now = Date.now();

  for (const regionId of listWeatherRegionIds()) {
    const region = regionMap.get(regionId);
    if (!region) {
      continue;
    }
    const includeMarine = includeMarineForRegion(region, true);
    const snapshot = readRegionSnapshot(regionId);

    for (let month = 1; month <= 12; month += 1) {
      const entry = snapshot.months[String(month)] ?? null;
      if (!entry) {
        rows.push({ regionId, month, includeMarine });
      } else if (snapshotStaleReason(entry, baselineYears, includeMarine, now) !== null) {
        rows.push({ regionId, month, includeMarine });
      }

      if (rows.length >= limit) {
        return rows;
      }
    }
  }

  return rows;
}

async function runAutoUpdateBatch(): Promise<void> {
  if (autoUpdateRunning) {
    return;
  }

  autoUpdateRunning = true;

  try {
    const targets = collectRowsForAutoUpdate(AUTO_UPDATE_BATCH_SIZE);
    if (targets.length === 0) {
      return;
    }

    let refreshed = 0;
    let stale = 0;
    let errors = 0;

    for (const target of targets) {
      try {
        const result = await resolveWeatherSummaryForRegionMonth({
          regionId: target.regionId,
          month: target.month,
          includeMarine: target.includeMarine,
          mode: "refresh_if_stale",
          allowStaleSnapshot: true,
        });

        if (result.source === "refreshed") {
          refreshed += 1;
        } else {
          stale += 1;
        }
      } catch {
        errors += 1;
      }

      await sleep(UPSTREAM_REQUEST_SPACING_MS);
    }

    console.log(
      `Weather snapshot auto-update: processed=${targets.length}, refreshed=${refreshed}, stale=${stale}, errors=${errors}`,
    );
  } finally {
    autoUpdateRunning = false;
  }
}

export function startWeatherSnapshotAutoUpdater(): void {
  if (!AUTO_UPDATE_ENABLED) {
    return;
  }

  if (autoUpdateTimer) {
    return;
  }

  void runAutoUpdateBatch();
  autoUpdateTimer = setInterval(() => {
    void runAutoUpdateBatch();
  }, AUTO_UPDATE_INTERVAL_MS);
}
