import { MONTHS } from "../src/types/weather.ts";
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
import {
  resolveWeatherSummaryForRegionMonth,
  type WeatherSummaryResolveSource,
} from "../server/weatherSummaryService.ts";

interface CliOptions {
  regionIds: string[];
  months: number[];
  year: number;
  includeMarine: boolean;
  mode: "verified_only" | "refresh_if_stale" | "force_refresh";
  allowStaleSnapshot: boolean;
  limit: number | null;
  offset: number;
  all: boolean;
  pauseMs: number;
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
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

function parseNonNegativeInt(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseMonths(value: string | undefined): number[] {
  if (!value) {
    return [...MONTHS];
  }

  const months = value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);

  if (months.length === 0) {
    return [...MONTHS];
  }

  return [...new Set(months)].sort((left, right) => left - right);
}

function parseResolveMode(value: string | undefined): "verified_only" | "refresh_if_stale" | "force_refresh" {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "verified_only") {
    return "verified_only";
  }

  if (normalized === "force_refresh") {
    return "force_refresh";
  }

  return "refresh_if_stale";
}

function printUsage(): void {
  console.log(`Usage: npm run nomad:tables:sync -- [options]

Options:
  --regionIds=vn-da-nang,th-bangkok   only sync listed region ids
  --months=1,2,3                      only sync listed months
  --year=2026                          storage year partition (default: current UTC year)
  --includeMarine=1                   include marine metrics (default: 1)
  --mode=refresh_if_stale             one of verified_only, refresh_if_stale, force_refresh
  --allowStale=1                      allow stale snapshot fallback when refresh fails (default: 1)
  --limit=250                         stop after N city-month rows
  --offset=0                          skip first N rows (useful for batch runs)
  --all=1                             allow full run when --limit is omitted
  --pauseMs=250                       wait between rows (helps avoid upstream throttling)
  --help                              show this help
`);
}

function parseCliOptions(argv: string[]): CliOptions {
  const byKey = new Map<string, string>();
  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = raw.slice(2).split("=", 2);
    byKey.set(rawKey, rawValue ?? "");
  }

  if (byKey.has("help")) {
    printUsage();
    process.exit(0);
  }

  const currentYear = new Date().getUTCFullYear();
  const parsedYear = parsePositiveInt(byKey.get("year")) ?? currentYear;

  return {
    regionIds: parseList(byKey.get("regionIds")),
    months: parseMonths(byKey.get("months")),
    year: parsedYear,
    includeMarine: parseBooleanFlag(byKey.get("includeMarine"), true),
    mode: parseResolveMode(byKey.get("mode")),
    allowStaleSnapshot: parseBooleanFlag(byKey.get("allowStale"), true),
    limit: parsePositiveInt(byKey.get("limit")),
    offset: parseNonNegativeInt(byKey.get("offset")),
    all: parseBooleanFlag(byKey.get("all"), false),
    pauseMs: parsePositiveInt(byKey.get("pauseMs")) ?? 250,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const options = parseCliOptions(process.argv.slice(2));
const regions = loadRegions();
const regionMap = new Map(regions.map((region) => [region.id, region]));

const unknownRegionIds = options.regionIds.filter((regionId) => !regionMap.has(regionId));
if (unknownRegionIds.length > 0) {
  console.warn(`Skipping unknown region ids: ${unknownRegionIds.join(", ")}`);
}

const selectedRegions =
  options.regionIds.length > 0
    ? options.regionIds.map((regionId) => regionMap.get(regionId)).filter((region) => region !== undefined)
    : regions;

const targets: Array<{ regionId: string; month: number }> = [];
for (const region of selectedRegions) {
  for (const month of options.months) {
    targets.push({ regionId: region.id, month });
  }
}

const shouldUseSafeDefaultLimit = options.limit === null && !options.all && options.regionIds.length === 0;
const effectiveLimit = shouldUseSafeDefaultLimit ? 200 : options.limit;
if (shouldUseSafeDefaultLimit) {
  console.warn(
    "No --limit provided for full-catalog run; defaulting to limit=200. Use --all=1 to process everything at once.",
  );
}

const startIndex = Math.min(options.offset, targets.length);
const endIndex =
  effectiveLimit === null ? targets.length : Math.min(targets.length, startIndex + effectiveLimit);
const selectedTargets = targets.slice(startIndex, endIndex);
const targetTotal = selectedTargets.length;
const db = openNomadDataStore();

try {
  initializeNomadDataSchema(db);
  const cityCount = upsertCities(db, regions);
  console.log(`City table synced: ${cityCount} rows`);

  console.log(
    `Starting nomad table sync: rows=${targetTotal}, year=${options.year}, mode=${options.mode}, includeMarine=${options.includeMarine}`,
  );

  const sourceCounts: Record<WeatherSummaryResolveSource, number> = {
    refreshed: 0,
    snapshot_fresh: 0,
    snapshot_stale: 0,
  };
  let processed = 0;
  let stored = 0;
  let errors = 0;

  for (const target of selectedTargets) {
    processed += 1;
    const region = regionMap.get(target.regionId);
    if (!region) {
      errors += 1;
      console.error(`[${processed}/${targetTotal}] ${target.regionId} month=${target.month} -> ERROR: region missing`);
      continue;
    }

    try {
      const resolved = await resolveWeatherSummaryForRegionMonth({
        regionId: target.regionId,
        month: target.month,
        includeMarine: options.includeMarine,
        mode: options.mode,
        allowStaleSnapshot: options.allowStaleSnapshot,
      });
      sourceCounts[resolved.source] += 1;

      const raw = buildRawMonthlyRow({
        regionId: target.regionId,
        year: options.year,
        month: target.month,
        summary: resolved.summary,
      });
      const derived = deriveMonthlyRow(raw, region.isCoastal);

      upsertCityMonthRaw(db, raw);
      upsertCityMonthDerived(db, derived);
      stored += 1;

      console.log(
        `[${processed}/${targetTotal}] ${target.regionId} month=${target.month} -> ${resolved.source}, stored`,
      );
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[${processed}/${targetTotal}] ${target.regionId} month=${target.month} -> ERROR: ${message}`);
    }

    if (options.pauseMs > 0 && processed < targetTotal) {
      await sleep(options.pauseMs);
    }
  }

  console.log("Nomad table sync summary:");
  console.log(`- processed: ${processed}`);
  console.log(`- stored: ${stored}`);
  console.log(`- refreshed: ${sourceCounts.refreshed}`);
  console.log(`- snapshot_fresh: ${sourceCounts.snapshot_fresh}`);
  console.log(`- snapshot_stale: ${sourceCounts.snapshot_stale}`);
  console.log(`- errors: ${errors}`);

  if (errors > 0) {
    process.exitCode = 1;
  }
} finally {
  db.close();
}
