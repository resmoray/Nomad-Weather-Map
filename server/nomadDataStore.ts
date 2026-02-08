import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { OpenMeteoMonthlySummary } from "./weatherSummaryService.ts";

interface RegionRecord {
  id: string;
  countryCode: string;
  countryName: string;
  regionName: string;
  cityName: string;
  lat: number;
  lon: number;
  cityIata: string;
  destinationIata: string;
  isCoastal: boolean;
}

interface ValidRange {
  min: number;
  max: number;
}

export interface CityMonthRawRow {
  cityId: string;
  year: number;
  month: number;
  tempMinC: number | null;
  tempAvgC: number | null;
  tempMaxC: number | null;
  rainMm: number | null;
  humidityPct: number | null;
  windAvgKph: number | null;
  pm25UgM3: number | null;
  aqiAvg: number | null;
  uvIndexAvg: number | null;
  uvIndexMax: number | null;
  waveHeightMinM: number | null;
  waveHeightAvgM: number | null;
  waveHeightMaxM: number | null;
  waveIntervalAvgS: number | null;
  waterTempC: number | null;
  climateLastUpdated: string;
  airLastUpdated: string;
  marineLastUpdated: string;
  sourceClimate: string;
  sourceAir: string;
  sourceMarine: string;
  sourceClimateUrl: string;
  sourceAirUrl: string;
  sourceMarineUrl: string;
  isEstimated: boolean;
  qualityScore: number;
  ingestedAt: string;
}

export interface CityMonthDerivedRow {
  cityId: string;
  year: number;
  month: number;
  thermalComfortScore: number | null;
  rainAnnoyanceScore: number | null;
  humidityDiscomfortScore: number | null;
  overallClimateScore: number | null;
  surfLevel: "beginner" | "intermediate" | "pro" | null;
  beginnerFriendly: "yes" | "mixed" | "no" | null;
  overallNomadScore: number | null;
  climateSeason: "low" | "shoulder" | "high" | null;
  bestMonthsFlag: boolean;
  avoidMonthsFlag: boolean;
  scoreVersion: string;
  derivedAt: string;
}

export interface SyncReadyRecord {
  region: RegionRecord;
  raw: CityMonthRawRow;
  derived: CityMonthDerivedRow;
}

export const DEFAULT_NOMAD_DATA_DB_PATH = (
  process.env.NOMAD_DATA_DB_PATH ?? resolve(process.cwd(), ".cache", "nomad-hub", "nomad-data.sqlite")
).trim();

const SCORE_VERSION = "phase1-v1";
const SOURCE_CLIMATE = "Open-Meteo Climate API";
const SOURCE_AIR = "Open-Meteo Air Quality API";
const SOURCE_MARINE = "Open-Meteo Marine API";
const SOURCE_CLIMATE_URL = "https://open-meteo.com/en/docs/historical-weather-api";
const SOURCE_AIR_URL = "https://open-meteo.com/en/docs/air-quality-api";
const SOURCE_MARINE_URL = "https://open-meteo.com/en/docs/marine-weather-api";

const RAW_RANGES: Record<string, ValidRange> = {
  tempMinC: { min: -90, max: 60 },
  tempAvgC: { min: -80, max: 60 },
  tempMaxC: { min: -90, max: 70 },
  rainMm: { min: 0, max: 3000 },
  humidityPct: { min: 0, max: 100 },
  windAvgKph: { min: 0, max: 300 },
  pm25UgM3: { min: 0, max: 1000 },
  aqiAvg: { min: 0, max: 500 },
  uvIndexAvg: { min: 0, max: 20 },
  uvIndexMax: { min: 0, max: 20 },
  waveHeightMinM: { min: 0, max: 30 },
  waveHeightAvgM: { min: 0, max: 30 },
  waveHeightMaxM: { min: 0, max: 30 },
  waveIntervalAvgS: { min: 0, max: 30 },
  waterTempC: { min: -2, max: 40 },
};

function toBooleanNumber(value: boolean): number {
  return value ? 1 : 0;
}

function parseJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function asFiniteOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function sanitizeByRange(fieldName: string, value: number | null): number | null {
  if (value === null) {
    return null;
  }

  const range = RAW_RANGES[fieldName];
  if (!range) {
    return value;
  }

  if (value < range.min || value > range.max) {
    return null;
  }

  return value;
}

function roundTo(value: number, precision: number): number {
  const base = 10 ** precision;
  return Math.round(value * base) / base;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeRange(value: number, min: number, idealMin: number, idealMax: number, max: number): number {
  if (value <= min || value >= max) {
    return 0;
  }

  if (value >= idealMin && value <= idealMax) {
    return 100;
  }

  if (value < idealMin) {
    return clampScore(((value - min) / (idealMin - min)) * 100);
  }

  return clampScore(((max - value) / (max - idealMax)) * 100);
}

function normalizeLowerBetter(value: number, goodThreshold: number, badThreshold: number): number {
  if (value <= goodThreshold) {
    return 100;
  }

  if (value >= badThreshold) {
    return 0;
  }

  return clampScore(((badThreshold - value) / (badThreshold - goodThreshold)) * 100);
}

function weightedMean(items: Array<{ value: number | null; weight: number }>): number | null {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const item of items) {
    if (item.value === null) {
      continue;
    }
    weightedSum += item.value * item.weight;
    totalWeight += item.weight;
  }

  if (totalWeight === 0) {
    return null;
  }

  return roundTo(weightedSum / totalWeight, 2);
}

function scoreHumidityComfort(humidityPct: number | null): number | null {
  if (humidityPct === null) {
    return null;
  }

  const distanceFromIdeal = Math.abs(humidityPct - 55);
  return roundTo(clampScore(100 - distanceFromIdeal * 2.2), 2);
}

function scoreRainAnnoyance(rainMm: number | null): number | null {
  if (rainMm === null) {
    return null;
  }

  return roundTo(normalizeLowerBetter(rainMm, 30, 350), 2);
}

function scoreThermalComfort(input: {
  tempAvgC: number | null;
  humidityPct: number | null;
  windAvgKph: number | null;
}): number | null {
  const temperatureScore =
    input.tempAvgC === null ? null : roundTo(normalizeRange(input.tempAvgC, 4, 21, 29, 42), 2);
  const humidityScore = scoreHumidityComfort(input.humidityPct);
  const windScore =
    input.windAvgKph === null ? null : roundTo(normalizeRange(input.windAvgKph, 0, 4, 20, 65), 2);

  return weightedMean([
    { value: temperatureScore, weight: 0.62 },
    { value: humidityScore, weight: 0.23 },
    { value: windScore, weight: 0.15 },
  ]);
}

function scoreUv(uvIndexAvg: number | null): number | null {
  if (uvIndexAvg === null) {
    return null;
  }

  return roundTo(normalizeLowerBetter(uvIndexAvg, 5, 11), 2);
}

function scoreAir(aqiAvg: number | null): number | null {
  if (aqiAvg === null) {
    return null;
  }

  return roundTo(normalizeLowerBetter(aqiAvg, 50, 180), 2);
}

function detectSurfLevel(
  waveHeightAvgM: number | null,
  waveIntervalAvgS: number | null,
): "beginner" | "intermediate" | "pro" | null {
  if (waveHeightAvgM === null || waveIntervalAvgS === null) {
    return null;
  }

  if (waveHeightAvgM <= 1.2 && waveIntervalAvgS <= 9) {
    return "beginner";
  }

  if (waveHeightAvgM <= 2.2 && waveIntervalAvgS <= 13) {
    return "intermediate";
  }

  return "pro";
}

function detectBeginnerFriendly(
  surfLevel: "beginner" | "intermediate" | "pro" | null,
): "yes" | "mixed" | "no" | null {
  if (surfLevel === null) {
    return null;
  }

  if (surfLevel === "beginner") {
    return "yes";
  }

  if (surfLevel === "intermediate") {
    return "mixed";
  }

  return "no";
}

function surfScore(
  surfLevel: "beginner" | "intermediate" | "pro" | null,
  coastal: boolean,
): number | null {
  if (!coastal || surfLevel === null) {
    return null;
  }

  if (surfLevel === "beginner") {
    return 82;
  }

  if (surfLevel === "intermediate") {
    return 70;
  }

  return 56;
}

function climateSeasonFromScore(score: number | null): "low" | "shoulder" | "high" | null {
  if (score === null) {
    return null;
  }

  if (score >= 72) {
    return "high";
  }

  if (score < 50) {
    return "low";
  }

  return "shoulder";
}

function normalizeTemperatureOrder(raw: {
  tempMinC: number | null;
  tempAvgC: number | null;
  tempMaxC: number | null;
}): { tempMinC: number | null; tempAvgC: number | null; tempMaxC: number | null } {
  const numbers = [raw.tempMinC, raw.tempAvgC, raw.tempMaxC].filter(
    (value): value is number => typeof value === "number",
  );

  if (numbers.length < 2) {
    return raw;
  }

  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  let avg = raw.tempAvgC;

  if (avg !== null) {
    avg = Math.max(min, Math.min(max, avg));
  }

  return {
    tempMinC: raw.tempMinC === null ? null : min,
    tempAvgC: avg,
    tempMaxC: raw.tempMaxC === null ? null : max,
  };
}

function computeQualityScore(raw: CityMonthRawRow): number {
  const measuredFields: Array<number | null> = [
    raw.tempMinC,
    raw.tempAvgC,
    raw.tempMaxC,
    raw.rainMm,
    raw.humidityPct,
    raw.windAvgKph,
    raw.pm25UgM3,
    raw.aqiAvg,
    raw.uvIndexAvg,
    raw.waveHeightAvgM,
    raw.waveIntervalAvgS,
  ];
  const present = measuredFields.filter((value) => value !== null).length;
  return roundTo((present / measuredFields.length) * 100, 2);
}

export function openNomadDataStore(dbPath = DEFAULT_NOMAD_DATA_DB_PATH): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

export function initializeNomadDataSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS city (
      city_id TEXT PRIMARY KEY,
      city_name TEXT NOT NULL,
      country TEXT NOT NULL,
      country_code TEXT NOT NULL,
      region_name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      coastal INTEGER NOT NULL CHECK (coastal IN (0, 1)),
      ocean_region TEXT,
      city_iata TEXT NOT NULL,
      destination_iata TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS city_month_raw (
      city_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      temp_min_c REAL,
      temp_avg_c REAL,
      temp_max_c REAL,
      rain_mm REAL,
      humidity_pct REAL,
      wind_avg_kph REAL,
      pm25_ug_m3 REAL,
      aqi_avg REAL,
      uv_index_avg REAL,
      uv_index_max REAL,
      wave_height_min_m REAL,
      wave_height_avg_m REAL,
      wave_height_max_m REAL,
      wave_interval_avg_s REAL,
      water_temp_c REAL,
      climate_last_updated TEXT NOT NULL,
      air_last_updated TEXT NOT NULL,
      marine_last_updated TEXT NOT NULL,
      source_climate TEXT NOT NULL,
      source_air TEXT NOT NULL,
      source_marine TEXT NOT NULL,
      source_climate_url TEXT NOT NULL,
      source_air_url TEXT NOT NULL,
      source_marine_url TEXT NOT NULL,
      is_estimated INTEGER NOT NULL CHECK (is_estimated IN (0, 1)),
      quality_score REAL NOT NULL,
      ingested_at TEXT NOT NULL,
      PRIMARY KEY (city_id, year, month),
      FOREIGN KEY (city_id) REFERENCES city(city_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS city_month_derived (
      city_id TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      thermal_comfort_score REAL,
      rain_annoyance_score REAL,
      humidity_discomfort_score REAL,
      overall_climate_score REAL,
      surf_level TEXT CHECK (surf_level IN ('beginner', 'intermediate', 'pro')),
      beginner_friendly TEXT CHECK (beginner_friendly IN ('yes', 'mixed', 'no')),
      overall_nomad_score REAL,
      climate_season TEXT CHECK (climate_season IN ('low', 'shoulder', 'high')),
      best_months_flag INTEGER NOT NULL CHECK (best_months_flag IN (0, 1)),
      avoid_months_flag INTEGER NOT NULL CHECK (avoid_months_flag IN (0, 1)),
      score_version TEXT NOT NULL,
      derived_at TEXT NOT NULL,
      PRIMARY KEY (city_id, year, month),
      FOREIGN KEY (city_id) REFERENCES city(city_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_city_month_raw_year_month ON city_month_raw(year, month);
    CREATE INDEX IF NOT EXISTS idx_city_month_derived_year_month ON city_month_derived(year, month);
  `);
}

export function loadRegions(): RegionRecord[] {
  const filePath = resolve(process.cwd(), "src", "data", "regions.json");
  return parseJsonFile<RegionRecord[]>(filePath);
}

export function upsertCities(db: DatabaseSync, regions = loadRegions()): number {
  const now = new Date().toISOString();
  const statement = db.prepare(`
    INSERT INTO city (
      city_id, city_name, country, country_code, region_name, lat, lon, coastal, ocean_region,
      city_iata, destination_iata, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(city_id) DO UPDATE SET
      city_name = excluded.city_name,
      country = excluded.country,
      country_code = excluded.country_code,
      region_name = excluded.region_name,
      lat = excluded.lat,
      lon = excluded.lon,
      coastal = excluded.coastal,
      ocean_region = excluded.ocean_region,
      city_iata = excluded.city_iata,
      destination_iata = excluded.destination_iata,
      updated_at = excluded.updated_at
  `);

  for (const region of regions) {
    statement.run(
      region.id,
      region.cityName,
      region.countryName,
      region.countryCode,
      region.regionName,
      region.lat,
      region.lon,
      toBooleanNumber(region.isCoastal),
      null,
      region.cityIata,
      region.destinationIata,
      now,
    );
  }

  return regions.length;
}

export function buildRawMonthlyRow(input: {
  regionId: string;
  year: number;
  month: number;
  summary: OpenMeteoMonthlySummary;
}): CityMonthRawRow {
  const now = new Date().toISOString();
  const normalizedTemperatures = normalizeTemperatureOrder({
    tempMinC: sanitizeByRange("tempMinC", asFiniteOrNull(input.summary.temperatureMinC)),
    tempAvgC: sanitizeByRange("tempAvgC", asFiniteOrNull(input.summary.temperatureC)),
    tempMaxC: sanitizeByRange("tempMaxC", asFiniteOrNull(input.summary.temperatureMaxC)),
  });

  const row: CityMonthRawRow = {
    cityId: input.regionId,
    year: input.year,
    month: input.month,
    tempMinC: normalizedTemperatures.tempMinC,
    tempAvgC: normalizedTemperatures.tempAvgC,
    tempMaxC: normalizedTemperatures.tempMaxC,
    rainMm: sanitizeByRange("rainMm", asFiniteOrNull(input.summary.rainfallMm)),
    humidityPct: sanitizeByRange("humidityPct", asFiniteOrNull(input.summary.humidityPct)),
    windAvgKph: sanitizeByRange("windAvgKph", asFiniteOrNull(input.summary.windKph)),
    pm25UgM3: sanitizeByRange("pm25UgM3", asFiniteOrNull(input.summary.pm25)),
    aqiAvg: sanitizeByRange("aqiAvg", asFiniteOrNull(input.summary.aqi)),
    uvIndexAvg: sanitizeByRange("uvIndexAvg", asFiniteOrNull(input.summary.uvIndex)),
    uvIndexMax: null,
    waveHeightMinM: null,
    waveHeightAvgM: sanitizeByRange("waveHeightAvgM", asFiniteOrNull(input.summary.waveHeightM)),
    waveHeightMaxM: null,
    waveIntervalAvgS: sanitizeByRange("waveIntervalAvgS", asFiniteOrNull(input.summary.wavePeriodS)),
    waterTempC: null,
    climateLastUpdated: input.summary.climateLastUpdated,
    airLastUpdated: input.summary.airQualityLastUpdated,
    marineLastUpdated: input.summary.marineLastUpdated,
    sourceClimate: SOURCE_CLIMATE,
    sourceAir: SOURCE_AIR,
    sourceMarine: SOURCE_MARINE,
    sourceClimateUrl: SOURCE_CLIMATE_URL,
    sourceAirUrl: SOURCE_AIR_URL,
    sourceMarineUrl: SOURCE_MARINE_URL,
    isEstimated: false,
    qualityScore: 0,
    ingestedAt: now,
  };
  row.qualityScore = computeQualityScore(row);
  return row;
}

export function deriveMonthlyRow(
  raw: CityMonthRawRow,
  coastal: boolean,
  derivedAt = new Date().toISOString(),
): CityMonthDerivedRow {
  const thermalComfortScore = scoreThermalComfort({
    tempAvgC: raw.tempAvgC,
    humidityPct: raw.humidityPct,
    windAvgKph: raw.windAvgKph,
  });
  const rainAnnoyanceScore = scoreRainAnnoyance(raw.rainMm);
  const humidityDiscomfortScore = scoreHumidityComfort(raw.humidityPct);
  const uvScore = scoreUv(raw.uvIndexAvg);
  const airScore = scoreAir(raw.aqiAvg);
  const overallClimateScore = weightedMean([
    { value: thermalComfortScore, weight: 0.48 },
    { value: rainAnnoyanceScore, weight: 0.24 },
    { value: humidityDiscomfortScore, weight: 0.14 },
    { value: uvScore, weight: 0.08 },
    { value: airScore, weight: 0.06 },
  ]);

  const surfLevel = detectSurfLevel(raw.waveHeightAvgM, raw.waveIntervalAvgS);
  const beginnerFriendly = detectBeginnerFriendly(surfLevel);
  const coastalSurfScore = surfScore(surfLevel, coastal);
  const overallNomadScore = weightedMean([
    { value: overallClimateScore, weight: 0.86 },
    { value: coastalSurfScore, weight: 0.14 },
  ]);
  const climateSeason = climateSeasonFromScore(overallClimateScore);
  const bestMonthsFlag = overallNomadScore !== null && overallNomadScore >= 78;
  const avoidMonthsFlag = overallNomadScore !== null && overallNomadScore <= 42;

  return {
    cityId: raw.cityId,
    year: raw.year,
    month: raw.month,
    thermalComfortScore,
    rainAnnoyanceScore,
    humidityDiscomfortScore,
    overallClimateScore,
    surfLevel,
    beginnerFriendly,
    overallNomadScore,
    climateSeason,
    bestMonthsFlag,
    avoidMonthsFlag,
    scoreVersion: SCORE_VERSION,
    derivedAt,
  };
}

export function upsertCityMonthRaw(db: DatabaseSync, row: CityMonthRawRow): void {
  db.prepare(`
    INSERT INTO city_month_raw (
      city_id, year, month, temp_min_c, temp_avg_c, temp_max_c, rain_mm, humidity_pct, wind_avg_kph,
      pm25_ug_m3, aqi_avg, uv_index_avg, uv_index_max, wave_height_min_m, wave_height_avg_m, wave_height_max_m,
      wave_interval_avg_s, water_temp_c, climate_last_updated, air_last_updated, marine_last_updated,
      source_climate, source_air, source_marine, source_climate_url, source_air_url, source_marine_url,
      is_estimated, quality_score, ingested_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(city_id, year, month) DO UPDATE SET
      temp_min_c = excluded.temp_min_c,
      temp_avg_c = excluded.temp_avg_c,
      temp_max_c = excluded.temp_max_c,
      rain_mm = excluded.rain_mm,
      humidity_pct = excluded.humidity_pct,
      wind_avg_kph = excluded.wind_avg_kph,
      pm25_ug_m3 = excluded.pm25_ug_m3,
      aqi_avg = excluded.aqi_avg,
      uv_index_avg = excluded.uv_index_avg,
      uv_index_max = excluded.uv_index_max,
      wave_height_min_m = excluded.wave_height_min_m,
      wave_height_avg_m = excluded.wave_height_avg_m,
      wave_height_max_m = excluded.wave_height_max_m,
      wave_interval_avg_s = excluded.wave_interval_avg_s,
      water_temp_c = excluded.water_temp_c,
      climate_last_updated = excluded.climate_last_updated,
      air_last_updated = excluded.air_last_updated,
      marine_last_updated = excluded.marine_last_updated,
      source_climate = excluded.source_climate,
      source_air = excluded.source_air,
      source_marine = excluded.source_marine,
      source_climate_url = excluded.source_climate_url,
      source_air_url = excluded.source_air_url,
      source_marine_url = excluded.source_marine_url,
      is_estimated = excluded.is_estimated,
      quality_score = excluded.quality_score,
      ingested_at = excluded.ingested_at
  `).run(
    row.cityId,
    row.year,
    row.month,
    row.tempMinC,
    row.tempAvgC,
    row.tempMaxC,
    row.rainMm,
    row.humidityPct,
    row.windAvgKph,
    row.pm25UgM3,
    row.aqiAvg,
    row.uvIndexAvg,
    row.uvIndexMax,
    row.waveHeightMinM,
    row.waveHeightAvgM,
    row.waveHeightMaxM,
    row.waveIntervalAvgS,
    row.waterTempC,
    row.climateLastUpdated,
    row.airLastUpdated,
    row.marineLastUpdated,
    row.sourceClimate,
    row.sourceAir,
    row.sourceMarine,
    row.sourceClimateUrl,
    row.sourceAirUrl,
    row.sourceMarineUrl,
    toBooleanNumber(row.isEstimated),
    row.qualityScore,
    row.ingestedAt,
  );
}

export function upsertCityMonthDerived(db: DatabaseSync, row: CityMonthDerivedRow): void {
  db.prepare(`
    INSERT INTO city_month_derived (
      city_id, year, month, thermal_comfort_score, rain_annoyance_score, humidity_discomfort_score,
      overall_climate_score, surf_level, beginner_friendly, overall_nomad_score, climate_season,
      best_months_flag, avoid_months_flag, score_version, derived_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(city_id, year, month) DO UPDATE SET
      thermal_comfort_score = excluded.thermal_comfort_score,
      rain_annoyance_score = excluded.rain_annoyance_score,
      humidity_discomfort_score = excluded.humidity_discomfort_score,
      overall_climate_score = excluded.overall_climate_score,
      surf_level = excluded.surf_level,
      beginner_friendly = excluded.beginner_friendly,
      overall_nomad_score = excluded.overall_nomad_score,
      climate_season = excluded.climate_season,
      best_months_flag = excluded.best_months_flag,
      avoid_months_flag = excluded.avoid_months_flag,
      score_version = excluded.score_version,
      derived_at = excluded.derived_at
  `).run(
    row.cityId,
    row.year,
    row.month,
    row.thermalComfortScore,
    row.rainAnnoyanceScore,
    row.humidityDiscomfortScore,
    row.overallClimateScore,
    row.surfLevel,
    row.beginnerFriendly,
    row.overallNomadScore,
    row.climateSeason,
    toBooleanNumber(row.bestMonthsFlag),
    toBooleanNumber(row.avoidMonthsFlag),
    row.scoreVersion,
    row.derivedAt,
  );
}
