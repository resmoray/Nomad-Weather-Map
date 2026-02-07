import { z } from "zod";
import type { Month, Region } from "../../types/weather";

const DEFAULT_CLIMATE_BASE_URL = "https://climate-api.open-meteo.com/v1/climate";
const DEFAULT_AIR_BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const DEFAULT_MARINE_BASE_URL = "https://marine-api.open-meteo.com/v1/marine";
const DEFAULT_BASELINE_YEARS = 5;
const MIN_OPEN_METEO_YEAR = 2022;

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

type ClimateDailyData = z.infer<typeof climateDailySchema>;
type AirHourlyData = z.infer<typeof airHourlySchema>;
type MarineHourlyData = z.infer<typeof marineHourlySchema>;

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

function createClimateUrl(region: Region, year: number, month: Month): string {
  const baseUrl = import.meta.env.VITE_OPEN_METEO_CLIMATE_BASE_URL ?? DEFAULT_CLIMATE_BASE_URL;
  const { startDate, endDate } = getMonthDateRange(year, month);

  const params = new URLSearchParams({
    latitude: String(region.lat),
    longitude: String(region.lon),
    start_date: startDate,
    end_date: endDate,
    timezone: "UTC",
    daily:
      "temperature_2m_mean,precipitation_sum,relative_humidity_2m_mean,wind_speed_10m_mean",
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

async function fetchAndParse<T>(url: string, schema: z.ZodType<T>, label: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }

  const payload = await response.json();
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(`${label} returned unexpected data format`);
  }

  return parsed.data;
}

async function fetchClimateMonth(region: Region, year: number, month: Month): Promise<ClimateDailyData> {
  const url = createClimateUrl(region, year, month);
  const parsed = await fetchAndParse(url, climateResponseSchema, `Climate API (${year})`);
  return parsed.daily;
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
): Promise<OpenMeteoMonthlySummary> {
  const baselineYears = getBaselineYears();

  const [climateResults, airResults, marineResults] = await Promise.all([
    Promise.allSettled(baselineYears.map((year) => fetchClimateMonth(region, year, month))),
    Promise.allSettled(baselineYears.map((year) => fetchAirMonth(region, year, month))),
    Promise.allSettled(baselineYears.map((year) => fetchMarineMonth(region, year, month))),
  ]);

  const climateData = climateResults
    .filter((result): result is PromiseFulfilledResult<ClimateDailyData> => result.status === "fulfilled")
    .map((result) => result.value);

  if (climateData.length === 0) {
    throw new Error("Unable to load climate data for selected region and month.");
  }

  const airData = airResults
    .filter((result): result is PromiseFulfilledResult<AirHourlyData> => result.status === "fulfilled")
    .map((result) => result.value);

  const marineData = marineResults
    .filter((result): result is PromiseFulfilledResult<MarineHourlyData> => result.status === "fulfilled")
    .map((result) => result.value);

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
