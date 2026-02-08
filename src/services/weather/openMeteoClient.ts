import { z } from "zod";
import type { Month, Region } from "../../types/weather";

const DEFAULT_CLIMATE_FALLBACK_BASE_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const DEFAULT_CLIMATE_ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive";
const DEFAULT_AIR_BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const DEFAULT_MARINE_BASE_URL = "https://marine-api.open-meteo.com/v1/marine";
const DEFAULT_BASELINE_YEARS = 3;
const MIN_OPEN_METEO_YEAR = 2022;
const DEFAULT_FETCH_CONCURRENCY = 6;
const DEFAULT_FETCH_MAX_ATTEMPTS = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 800;
const DEFAULT_FETCH_TIMEOUT_MS = 12000;

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_NAMES = new Set(["TypeError", "AbortError"]);
const CLIMATE_DAILY_FIELDS_PRIMARY =
  "temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_mean";
const CLIMATE_DAILY_FIELDS_LEGACY =
  "temperature_2m_mean,precipitation_sum,relativehumidity_2m_mean,windspeed_10m_mean";
const CLIMATE_DAILY_FIELDS_MINIMAL = "temperature_2m_mean,precipitation_sum";

const climateDailySchema = z.object({
  time: z.array(z.string()).optional(),
  temperature_2m_mean: z.array(z.number().nullable()).optional(),
  precipitation_sum: z.array(z.number().nullable()).optional(),
  relative_humidity_2m_mean: z.array(z.number().nullable()).optional(),
  relativehumidity_2m_mean: z.array(z.number().nullable()).optional(),
  wind_speed_10m_mean: z.array(z.number().nullable()).optional(),
  windspeed_10m_mean: z.array(z.number().nullable()).optional(),
});

const climateResponseSchema = z.object({
  daily: climateDailySchema,
});

const airHourlySchema = z.object({
  time: z.array(z.string()).optional(),
  pm2_5: z.array(z.number().nullable()).optional(),
  us_aqi: z.array(z.number().nullable()).optional(),
  uv_index: z.array(z.number().nullable()).optional(),
});

const airResponseSchema = z.object({
  hourly: airHourlySchema,
});

const marineHourlySchema = z.object({
  time: z.array(z.string()).optional(),
  wave_height: z.array(z.number().nullable()).optional(),
  wave_direction: z.array(z.number().nullable()).optional(),
  wave_period: z.array(z.number().nullable()).optional(),
});

const marineResponseSchema = z.object({
  hourly: marineHourlySchema,
});

const weatherSummaryResponseSchema = z.object({
  temperatureC: z.number().nullable(),
  temperatureMinC: z.number().nullable(),
  temperatureMaxC: z.number().nullable(),
  rainfallMm: z.number().nullable(),
  humidityPct: z.number().nullable(),
  windKph: z.number().nullable(),
  uvIndex: z.number().nullable(),
  pm25: z.number().nullable(),
  aqi: z.number().nullable(),
  waveHeightM: z.number().nullable(),
  wavePeriodS: z.number().nullable(),
  waveDirectionDeg: z.number().nullable(),
  climateLastUpdated: z.string(),
  airQualityLastUpdated: z.string(),
  marineLastUpdated: z.string(),
});

type ClimateDailyData = z.infer<typeof climateDailySchema>;
type AirHourlyData = z.infer<typeof airHourlySchema>;
type MarineHourlyData = z.infer<typeof marineHourlySchema>;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

const FETCH_CONCURRENCY_LIMIT = parsePositiveInt(
  import.meta.env.VITE_OPEN_METEO_FETCH_CONCURRENCY,
  DEFAULT_FETCH_CONCURRENCY,
);
const FETCH_MAX_ATTEMPTS = parsePositiveInt(
  import.meta.env.VITE_OPEN_METEO_FETCH_ATTEMPTS,
  DEFAULT_FETCH_MAX_ATTEMPTS,
);
const RETRY_BASE_DELAY_MS = parsePositiveInt(
  import.meta.env.VITE_OPEN_METEO_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_BASE_DELAY_MS,
);
const FETCH_TIMEOUT_MS = parsePositiveInt(
  import.meta.env.VITE_OPEN_METEO_FETCH_TIMEOUT_MS,
  DEFAULT_FETCH_TIMEOUT_MS,
);
const WEATHER_PROXY_BASE_URL = (import.meta.env.VITE_OPEN_METEO_PROXY_BASE_URL ?? "").trim();
const WEATHER_SUMMARY_BASE_URL = (
  import.meta.env.VITE_WEATHER_SUMMARY_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:8787" : "")
).trim();

let activeFetchCount = 0;
const fetchWaitQueue: Array<() => void> = [];

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

interface FetchSummaryOptions {
  includeMarine?: boolean;
}

type ServerSummaryResult =
  | { status: "success"; summary: OpenMeteoMonthlySummary }
  | { status: "skip" }
  | { status: "hard-fail"; error: Error };

async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeFetchCount >= FETCH_CONCURRENCY_LIMIT) {
    await new Promise<void>((resolve) => {
      fetchWaitQueue.push(resolve);
    });
  }

  activeFetchCount += 1;

  try {
    return await task();
  } finally {
    activeFetchCount = Math.max(0, activeFetchCount - 1);
    const next = fetchWaitQueue.shift();
    if (next) {
      next();
    }
  }
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return RETRYABLE_ERROR_NAMES.has(error.name);
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
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * RETRY_BASE_DELAY_MS);
  return Math.max(retryAfterMs ?? 0, exponentialDelay + jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toNumberOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value;
}

function cleanValues(values: Array<number | null> | undefined): number[] {
  if (!values) {
    return [];
  }

  return values.filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
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

function getMonthDateRange(year: number, month: Month): { startDate: string; endDate: string } {
  const paddedMonth = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDate = `${year}-${paddedMonth}-01`;
  const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

function getBaselineYears(): number[] {
  const envValue = Number.parseInt(import.meta.env.VITE_WEATHER_BASELINE_YEARS ?? "", 10);
  const baselineYears = Number.isNaN(envValue) ? DEFAULT_BASELINE_YEARS : Math.max(1, envValue);

  const currentYear = new Date().getUTCFullYear();
  const endYear = Math.max(MIN_OPEN_METEO_YEAR, currentYear - 1);
  const startYear = Math.max(MIN_OPEN_METEO_YEAR, endYear - baselineYears + 1);

  const years: number[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  return years;
}

function getClimateBaseUrls(): string[] {
  const configuredPrimary = (import.meta.env.VITE_OPEN_METEO_CLIMATE_BASE_URL ?? "").trim();
  const configuredFallback = (import.meta.env.VITE_OPEN_METEO_CLIMATE_FALLBACK_BASE_URL ?? "").trim();
  const configuredArchive = (import.meta.env.VITE_OPEN_METEO_CLIMATE_ARCHIVE_BASE_URL ?? "").trim();

  if (configuredPrimary || configuredFallback || configuredArchive) {
    const configuredCandidates = [configuredPrimary, configuredFallback, configuredArchive].filter(Boolean);
    return [...new Set(configuredCandidates)];
  }

  // Default to historical endpoints. The climate endpoint can trigger stricter throttling.
  const candidates = [DEFAULT_CLIMATE_FALLBACK_BASE_URL, DEFAULT_CLIMATE_ARCHIVE_BASE_URL];

  return [...new Set(candidates)];
}

function createClimateUrl(region: Region, year: number, month: Month, baseUrl: string, daily: string): string {
  const { startDate, endDate } = getMonthDateRange(year, month);

  const params = new URLSearchParams({
    latitude: String(region.lat),
    longitude: String(region.lon),
    start_date: startDate,
    end_date: endDate,
    timezone: "UTC",
    daily,
  });

  return `${baseUrl}?${params.toString()}`;
}

function createAirQualityUrl(region: Region, year: number, month: Month): string {
  const baseUrl = import.meta.env.VITE_OPEN_METEO_AIR_BASE_URL ?? DEFAULT_AIR_BASE_URL;
  const { startDate, endDate } = getMonthDateRange(year, month);

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

function createMarineUrl(region: Region, year: number, month: Month): string {
  const baseUrl = import.meta.env.VITE_OPEN_METEO_MARINE_BASE_URL ?? DEFAULT_MARINE_BASE_URL;
  const { startDate, endDate } = getMonthDateRange(year, month);

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

function createWeatherSummaryUrl(region: Region, month: Month, includeMarine: boolean): string {
  const params = new URLSearchParams({
    regionId: region.id,
    month: String(month),
    includeMarine: includeMarine ? "1" : "0",
  });
  return `${WEATHER_SUMMARY_BASE_URL}/api/weather/summary?${params.toString()}`;
}

async function fetchServerSummary(
  region: Region,
  month: Month,
  includeMarine: boolean,
): Promise<ServerSummaryResult> {
  if (!WEATHER_SUMMARY_BASE_URL) {
    return { status: "skip" };
  }

  const url = createWeatherSummaryUrl(region, month, includeMarine);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;

    try {
      response = await withFetchSlot(() => fetch(url, { signal: controller.signal }));
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return { status: "skip" };
      }

      let responseDetails = "";
      try {
        responseDetails = await response.text();
      } catch {
        // ignore response parse errors
      }
      const detailsSuffix = responseDetails ? `: ${responseDetails}` : "";
      return {
        status: "hard-fail",
        error: new Error(`Weather summary API failed with status ${response.status}${detailsSuffix}`),
      };
    }

    const payload = await response.json();
    const parsed = weatherSummaryResponseSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        status: "hard-fail",
        error: new Error("Weather summary API returned unexpected data format"),
      };
    }

    return {
      status: "success",
      summary: parsed.data,
    };
  } catch (error) {
    if (isRetryableError(error)) {
      // Backend likely unavailable in frontend-only mode.
      return { status: "skip" };
    }

    return {
      status: "hard-fail",
      error: error instanceof Error ? error : new Error("Unknown weather summary API error"),
    };
  }
}

function buildRequestUrl(url: string): string {
  if (!WEATHER_PROXY_BASE_URL) {
    return url;
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const proxyUrl = new URL(WEATHER_PROXY_BASE_URL, origin);
  proxyUrl.searchParams.set("url", url);
  return proxyUrl.toString();
}

async function fetchAndParse<T>(url: string, schema: z.ZodType<T>, label: string): Promise<T> {
  let lastError: unknown = null;
  const requestUrl = buildRequestUrl(url);

  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await withFetchSlot(() => fetch(requestUrl, { signal: controller.signal }));
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < FETCH_MAX_ATTEMPTS) {
          lastError = new Error(`${label} failed with status ${response.status}`);
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
          const minBackoffMs = response.status === 429 ? 1800 : 0;
          const effectiveRetryAfterMs =
            retryAfterMs === null ? minBackoffMs : Math.max(retryAfterMs, minBackoffMs);
          await sleep(getRetryDelayMs(attempt, effectiveRetryAfterMs));
          continue;
        }

        throw new Error(`${label} failed with status ${response.status}`);
      }

      const payload = await response.json();
      const parsed = schema.safeParse(payload);

      if (!parsed.success) {
        throw new Error(`${label} returned unexpected data format`);
      }

      return parsed.data;
    } catch (error) {
      if (isRetryableError(error) && attempt < FETCH_MAX_ATTEMPTS) {
        lastError = error;
        await sleep(getRetryDelayMs(attempt));
        continue;
      }

      throw error;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(`${label} failed after retries`));
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

async function fetchClimateMonth(region: Region, year: number, month: Month): Promise<ClimateDailyData> {
  const baseUrls = getClimateBaseUrls();
  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    const primaryUrl = createClimateUrl(region, year, month, baseUrl, CLIMATE_DAILY_FIELDS_PRIMARY);

    try {
      const parsed = await fetchAndParse(
        primaryUrl,
        climateResponseSchema,
        `Climate API (${year})`,
      );
      return parsed.daily;
    } catch (error) {
      lastError = error;

      // Variable naming changed across providers/versions; retry only for bad-request shape errors.
      if (!isHttpStatusError(error, 400)) {
        continue;
      }
    }

    const fallbackFieldSets = [CLIMATE_DAILY_FIELDS_LEGACY, CLIMATE_DAILY_FIELDS_MINIMAL];

    for (const daily of fallbackFieldSets) {
      const fallbackUrl = createClimateUrl(region, year, month, baseUrl, daily);

      try {
        const parsed = await fetchAndParse(
          fallbackUrl,
          climateResponseSchema,
          `Climate API (${year})`,
        );
        return parsed.daily;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw (lastError instanceof Error ? lastError : new Error(`Climate API (${year}) failed`));
}

async function fetchAirMonth(region: Region, year: number, month: Month): Promise<AirHourlyData> {
  const url = createAirQualityUrl(region, year, month);
  const parsed = await fetchAndParse(url, airResponseSchema, `Air Quality API (${year})`);
  return parsed.hourly;
}

async function fetchMarineMonth(region: Region, year: number, month: Month): Promise<MarineHourlyData> {
  const url = createMarineUrl(region, year, month);
  const parsed = await fetchAndParse(url, marineResponseSchema, `Marine API (${year})`);
  return parsed.hourly;
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

export function averageDailyMaxUv(
  data: Array<{ time?: string[]; uv_index?: Array<number | null> }>,
): number | null {
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

export async function fetchOpenMeteoMonthlySummary(
  region: Region,
  month: Month,
  options?: FetchSummaryOptions,
): Promise<OpenMeteoMonthlySummary> {
  const includeMarine = options?.includeMarine ?? true;
  const serverResult = await fetchServerSummary(region, month, includeMarine);

  if (serverResult.status === "success") {
    return serverResult.summary;
  }

  if (serverResult.status === "hard-fail") {
    throw serverResult.error;
  }

  const baselineYears = getBaselineYears();

  const [climateResults, airResults, marineResults] = await Promise.all([
    Promise.allSettled(baselineYears.map((year) => fetchClimateMonth(region, year, month))),
    Promise.allSettled(baselineYears.map((year) => fetchAirMonth(region, year, month))),
    includeMarine
      ? Promise.allSettled(baselineYears.map((year) => fetchMarineMonth(region, year, month)))
      : Promise.resolve([] as PromiseSettledResult<MarineHourlyData>[]),
  ]);

  let climateData = climateResults
    .filter((result): result is PromiseFulfilledResult<ClimateDailyData> => result.status === "fulfilled")
    .map((result) => result.value);

  let climateFailureReason: string | null = null;
  const sawClimateRateLimit = climateResults.some(
    (result) => result.status === "rejected" && isRateLimitError(result.reason),
  );
  if (climateData.length === 0) {
    const firstFailure = climateResults.find((result) => result.status === "rejected");
    if (firstFailure && firstFailure.status === "rejected") {
      climateFailureReason =
        firstFailure.reason instanceof Error ? firstFailure.reason.message : "Unknown climate API error";
    }

    // Fallback pass: when bulk year requests are fully throttled, retry with fewer calls.
    await sleep(sawClimateRateLimit ? 2200 : 650);
    const latestYear = baselineYears[baselineYears.length - 1];
    const previousYear = baselineYears.length > 1 ? baselineYears[baselineYears.length - 2] : latestYear;
    const fallbackYears = sawClimateRateLimit
      ? [latestYear]
      : latestYear === previousYear
        ? [latestYear]
        : [latestYear, previousYear];
    const fallbackResults = await Promise.allSettled(
      fallbackYears.map((year) => fetchClimateMonth(region, year, month)),
    );

    climateData = fallbackResults
      .filter((result): result is PromiseFulfilledResult<ClimateDailyData> => result.status === "fulfilled")
      .map((result) => result.value);

    if (climateData.length === 0) {
      const fallbackFailure = fallbackResults.find((result) => result.status === "rejected");
      if (fallbackFailure && fallbackFailure.status === "rejected") {
        climateFailureReason =
          fallbackFailure.reason instanceof Error
            ? fallbackFailure.reason.message
            : (climateFailureReason ?? "Unknown climate API error");
      }
    }
  }

  if (climateData.length === 0) {
    const reasonSuffix = climateFailureReason ? ` (${climateFailureReason})` : "";
    throw new Error(`Unable to load climate data for selected region and month${reasonSuffix}.`);
  }

  let airData = airResults
    .filter((result): result is PromiseFulfilledResult<AirHourlyData> => result.status === "fulfilled")
    .map((result) => result.value);

  if (airData.length === 0) {
    // Fallback pass: when bulk year requests are fully throttled, retry with fewer calls.
    await sleep(650);
    const latestYear = baselineYears[baselineYears.length - 1];
    const previousYear = baselineYears.length > 1 ? baselineYears[baselineYears.length - 2] : latestYear;
    const fallbackYears = latestYear === previousYear ? [latestYear] : [latestYear, previousYear];
    const fallbackResults = await Promise.allSettled(
      fallbackYears.map((year) => fetchAirMonth(region, year, month)),
    );

    airData = fallbackResults
      .filter((result): result is PromiseFulfilledResult<AirHourlyData> => result.status === "fulfilled")
      .map((result) => result.value);
  }

  const marineData =
    includeMarine
      ? marineResults
          .filter((result): result is PromiseFulfilledResult<MarineHourlyData> => result.status === "fulfilled")
          .map((result) => result.value)
      : [];

  const climateMetrics = aggregateClimate(climateData);
  const airMetrics = airData.length > 0 ? aggregateAir(airData) : { uvIndex: null, pm25: null, aqi: null };
  const marineMetrics =
    marineData.length > 0
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
