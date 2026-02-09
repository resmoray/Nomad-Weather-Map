import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  buildRawMonthlyRow,
  deriveMonthlyRow,
  initializeNomadDataSchema,
  loadRegions,
  openNomadDataStore,
  upsertCities,
  upsertCityMonthDerived,
  upsertCityMonthRaw,
} from "../server/nomadDataStore.ts";

const monthlyRawSchema = z.object({
  temp_min_c: z.number().nullable(),
  temp_avg_c: z.number().nullable(),
  temp_max_c: z.number().nullable(),
  rain_mm: z.number().nullable(),
  humidity_pct: z.number().nullable(),
  wind_avg_kph: z.number().nullable(),
  sunshine_hours: z.number().nullable(),
  pm25_ug_m3: z.number().nullable(),
  aqi_avg: z.number().nullable(),
  uv_index_avg: z.number().nullable(),
  uv_index_max: z.number().nullable(),
  fixed_internet_down_mbps: z.number().nullable(),
  fixed_internet_up_mbps: z.number().nullable(),
  mobile_internet_down_mbps: z.number().nullable(),
  internet_stability_pct: z.number().nullable(),
  power_reliability_level: z.enum(["stable", "occasional", "unstable"]).nullable(),
  cost_level: z.number().int().min(1).max(5).nullable(),
  wave_height_min_m: z.number().nullable(),
  wave_height_avg_m: z.number().nullable(),
  wave_height_max_m: z.number().nullable(),
  wave_interval_avg_s: z.number().nullable(),
  water_temp_c: z.number().nullable(),
  surf_level: z.enum(["beginner", "intermediate", "pro"]).nullable(),
  beginner_friendly: z.enum(["yes", "mixed", "no"]).nullable(),
  thermal_comfort_score: z.number().nullable(),
  rain_annoyance_score: z.number().nullable(),
  humidity_discomfort_score: z.number().nullable(),
  overall_climate_score: z.number().nullable(),
  remote_work_score: z.number().nullable(),
  internet_quality_label: z.enum(["poor", "ok", "good", "excellent"]).nullable(),
  power_risk_flag: z.boolean().nullable(),
  overall_nomad_score: z.number().nullable(),
  climate_season: z.enum(["low", "shoulder", "high"]).nullable(),
  market_season: z.enum(["low", "shoulder", "high"]).nullable(),
  best_months_flag: z.boolean().nullable(),
  avoid_months_flag: z.boolean().nullable(),
});

const monthEntrySchema = z.object({
  month: z.number().int().min(1).max(12),
  raw: monthlyRawSchema,
  climate_last_updated: z.string().optional(),
  air_last_updated: z.string().optional(),
  marine_last_updated: z.string().optional(),
  is_estimated: z.boolean().optional(),
  quality_score: z.number().min(0).max(100).optional(),
});

const manualFileSchema = z.object({
  schema_version: z.literal("nomad-city-month-v1"),
  region_id: z.string().min(1),
  year: z.number().int().min(2020),
  city: z.object({
    city_name: z.string(),
    country: z.string(),
    lat: z.number(),
    lon: z.number(),
    coastal: z.boolean(),
    ocean_region: z.string().nullable(),
  }),
  sources: z.object({
    climate: z.object({
      source_name: z.string(),
      source_url: z.string(),
      last_updated: z.string(),
    }),
    air: z.object({
      source_name: z.string(),
      source_url: z.string(),
      last_updated: z.string(),
    }),
    marine: z.object({
      source_name: z.string(),
      source_url: z.string(),
      last_updated: z.string(),
    }),
  }),
  months: z.array(monthEntrySchema).length(12),
});

interface CliOptions {
  dir: string;
}

function parseCliOptions(argv: string[]): CliOptions {
  const map = new Map<string, string>();
  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      continue;
    }
    const [key, value] = raw.slice(2).split("=", 2);
    map.set(key, value ?? "");
  }

  const dir = (map.get("dir") ?? "data/manual-city-month").trim();
  return { dir };
}

function parseDateOrFallback(raw: string | undefined, fallback: string): string {
  if (!raw) {
    return fallback;
  }
  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
}

function clampOrNull(value: number | null, min: number, max: number): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

const options = parseCliOptions(process.argv.slice(2));
const manualDir = resolve(process.cwd(), options.dir);
const fileNames = readdirSync(manualDir).filter((name) => name.endsWith(".json")).sort();
const db = openNomadDataStore();
db.exec("PRAGMA busy_timeout = 5000;");
const regions = loadRegions();
const regionMap = new Map(regions.map((region) => [region.id, region]));

try {
  initializeNomadDataSchema(db);
  upsertCities(db, regions);

  let processedFiles = 0;
  let storedRows = 0;
  let errors = 0;

  for (const fileName of fileNames) {
    const fullPath = join(manualDir, fileName);
    try {
      const rawJson = readFileSync(fullPath, "utf-8");
      const parsed = manualFileSchema.parse(JSON.parse(rawJson));
      const region = regionMap.get(parsed.region_id);
      if (!region) {
        throw new Error(`Unknown region_id '${parsed.region_id}' in ${fileName}`);
      }

      for (const monthEntry of parsed.months) {
        const summary = {
          temperatureC: monthEntry.raw.temp_avg_c,
          temperatureMinC: monthEntry.raw.temp_min_c,
          temperatureMaxC: monthEntry.raw.temp_max_c,
          rainfallMm: monthEntry.raw.rain_mm,
          humidityPct: monthEntry.raw.humidity_pct,
          windKph: monthEntry.raw.wind_avg_kph,
          uvIndex: monthEntry.raw.uv_index_avg,
          pm25: monthEntry.raw.pm25_ug_m3,
          aqi: monthEntry.raw.aqi_avg,
          waveHeightM: monthEntry.raw.wave_height_avg_m,
          wavePeriodS: monthEntry.raw.wave_interval_avg_s,
          waveDirectionDeg: null,
          climateLastUpdated: parseDateOrFallback(
            monthEntry.climate_last_updated,
            parsed.sources.climate.last_updated,
          ),
          airQualityLastUpdated: parseDateOrFallback(
            monthEntry.air_last_updated,
            parsed.sources.air.last_updated,
          ),
          marineLastUpdated: parseDateOrFallback(
            monthEntry.marine_last_updated,
            parsed.sources.marine.last_updated,
          ),
        };

        const row = buildRawMonthlyRow({
          regionId: parsed.region_id,
          year: parsed.year,
          month: monthEntry.month,
          summary,
        });

        row.uvIndexMax = clampOrNull(monthEntry.raw.uv_index_max, 0, 20);
        row.waveHeightMinM = clampOrNull(monthEntry.raw.wave_height_min_m, 0, 30);
        row.waveHeightMaxM = clampOrNull(monthEntry.raw.wave_height_max_m, 0, 30);
        row.waterTempC = clampOrNull(monthEntry.raw.water_temp_c, -2, 40);
        row.climateLastUpdated = summary.climateLastUpdated;
        row.airLastUpdated = summary.airQualityLastUpdated;
        row.marineLastUpdated = summary.marineLastUpdated;
        row.sourceClimate = parsed.sources.climate.source_name;
        row.sourceAir = parsed.sources.air.source_name;
        row.sourceMarine = parsed.sources.marine.source_name;
        row.sourceClimateUrl = parsed.sources.climate.source_url;
        row.sourceAirUrl = parsed.sources.air.source_url;
        row.sourceMarineUrl = parsed.sources.marine.source_url;
        row.isEstimated = monthEntry.is_estimated ?? false;
        if (typeof monthEntry.quality_score === "number") {
          row.qualityScore = monthEntry.quality_score;
        }

        const derived = deriveMonthlyRow(row, region.isCoastal);
        upsertCityMonthRaw(db, row);
        upsertCityMonthDerived(db, derived);
        storedRows += 1;
      }

      processedFiles += 1;
      console.log(`Imported ${fileName} (${parsed.months.length} months)`);
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "Unknown parse/import error";
      console.error(`Failed ${fileName}: ${message}`);
    }
  }

  console.log("Manual import summary:");
  console.log(`- files processed: ${processedFiles}`);
  console.log(`- rows stored: ${storedRows}`);
  console.log(`- errors: ${errors}`);

  if (errors > 0) {
    process.exitCode = 1;
  }
} finally {
  db.close();
}
