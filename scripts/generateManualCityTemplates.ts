import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface RegionRecord {
  id: string;
  countryName: string;
  cityName: string;
  lat: number;
  lon: number;
  isCoastal: boolean;
}

interface CliOptions {
  year: number;
  outDir: string;
  overwrite: boolean;
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  return fallback;
}

function parseCliOptions(argv: string[]): CliOptions {
  const byKey = new Map<string, string>();
  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      continue;
    }
    const [key, value] = raw.slice(2).split("=", 2);
    byKey.set(key, value ?? "");
  }

  const defaultYear = new Date().getUTCFullYear() - 1;
  return {
    year: parsePositiveInt(byKey.get("year")) ?? defaultYear,
    outDir: (byKey.get("outDir") ?? "data/manual-city-month-template").trim(),
    overwrite: parseBoolean(byKey.get("overwrite"), true),
  };
}

function loadRegions(): RegionRecord[] {
  const filePath = resolve(process.cwd(), "src", "data", "regions.json");
  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as RegionRecord[];
}

function emptyRawMonth(): Record<string, number | string | boolean | null> {
  return {
    temp_min_c: null,
    temp_avg_c: null,
    temp_max_c: null,
    rain_mm: null,
    humidity_pct: null,
    wind_avg_kph: null,
    sunshine_hours: null,
    pm25_ug_m3: null,
    aqi_avg: null,
    uv_index_avg: null,
    uv_index_max: null,
    fixed_internet_down_mbps: null,
    fixed_internet_up_mbps: null,
    mobile_internet_down_mbps: null,
    internet_stability_pct: null,
    power_reliability_level: null,
    cost_level: null,
    wave_height_min_m: null,
    wave_height_avg_m: null,
    wave_height_max_m: null,
    wave_interval_avg_s: null,
    water_temp_c: null,
    surf_level: null,
    beginner_friendly: null,
    thermal_comfort_score: null,
    rain_annoyance_score: null,
    humidity_discomfort_score: null,
    overall_climate_score: null,
    remote_work_score: null,
    internet_quality_label: null,
    power_risk_flag: null,
    overall_nomad_score: null,
    climate_season: null,
    market_season: null,
    best_months_flag: null,
    avoid_months_flag: null,
  };
}

function monthEntries(): Array<{ month: number; raw: Record<string, number | string | boolean | null> }> {
  const rows: Array<{ month: number; raw: Record<string, number | string | boolean | null> }> = [];
  for (let month = 1; month <= 12; month += 1) {
    rows.push({
      month,
      raw: emptyRawMonth(),
    });
  }
  return rows;
}

const options = parseCliOptions(process.argv.slice(2));
const regions = loadRegions().slice().sort((a, b) => a.id.localeCompare(b.id));
const outDir = resolve(process.cwd(), options.outDir);
mkdirSync(outDir, { recursive: true });

let written = 0;
let skipped = 0;

for (const region of regions) {
  const fileName = `${region.id}.${options.year}.json`;
  const filePath = join(outDir, fileName);
  if (existsSync(filePath) && !options.overwrite) {
    skipped += 1;
    continue;
  }

  const payload = {
    schema_version: "nomad-city-month-v1",
    region_id: region.id,
    year: options.year,
    city: {
      city_name: region.cityName,
      country: region.countryName,
      lat: region.lat,
      lon: region.lon,
      coastal: region.isCoastal,
      ocean_region: null,
    },
    sources: {
      climate: {
        source_name: "",
        source_url: "",
        last_updated: "",
      },
      air: {
        source_name: "",
        source_url: "",
        last_updated: "",
      },
      marine: {
        source_name: "",
        source_url: "",
        last_updated: "",
      },
    },
    months: monthEntries(),
  };

  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  written += 1;
}

console.log(`Manual template generation done: wrote=${written}, skipped=${skipped}, dir=${outDir}`);
