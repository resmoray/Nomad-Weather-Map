import { MONTHS } from "../src/types/weather.ts";
import {
  listWeatherRegionIds,
  resolveWeatherSummaryForRegionMonth,
  type WeatherSummaryResolveSource,
} from "../server/weatherSummaryService.ts";

interface CliOptions {
  regionIds: string[];
  months: number[];
  limit: number | null;
  offset: number;
  all: boolean;
  includeMarine: boolean;
  forceRefresh: boolean;
  allowStaleSnapshot: boolean;
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

function printUsage(): void {
  console.log(`Usage: npm run weather:snapshot:update -- [options]

Options:
  --regionIds=vn-da-nang,th-bangkok   limit to specific region ids
  --months=1,2,3                      limit to specific months (1-12)
  --limit=200                         stop after N region-month rows
  --offset=0                          skip first N rows (useful for batch runs)
  --all=1                             allow full run when --limit is omitted
  --includeMarine=1                   refresh marine metrics too (default: 1)
  --force=1                           force refresh even when snapshot is fresh
  --allowStale=1                      fall back to stale snapshot when refresh fails (default: 1)
  --pauseMs=250                       wait between rows to reduce upstream pressure
  --help                              show this message
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

  return {
    regionIds: parseList(byKey.get("regionIds")),
    months: parseMonths(byKey.get("months")),
    limit: parsePositiveInt(byKey.get("limit")),
    offset: parseNonNegativeInt(byKey.get("offset")),
    all: parseBooleanFlag(byKey.get("all"), false),
    includeMarine: parseBooleanFlag(byKey.get("includeMarine"), true),
    forceRefresh: parseBooleanFlag(byKey.get("force"), false),
    allowStaleSnapshot: parseBooleanFlag(byKey.get("allowStale"), true),
    pauseMs: parsePositiveInt(byKey.get("pauseMs")) ?? 250,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const options = parseCliOptions(process.argv.slice(2));
const allRegionIds = listWeatherRegionIds();
const availableRegions = new Set(allRegionIds);
const selectedRegionIds =
  options.regionIds.length > 0
    ? options.regionIds.filter((regionId) => availableRegions.has(regionId))
    : allRegionIds;

const unknownRegionIds = options.regionIds.filter((regionId) => !availableRegions.has(regionId));
if (unknownRegionIds.length > 0) {
  console.warn(`Skipping unknown region ids: ${unknownRegionIds.join(", ")}`);
}

const targetRows: Array<{ regionId: string; month: number }> = [];
for (const regionId of selectedRegionIds) {
  for (const month of options.months) {
    targetRows.push({ regionId, month });
  }
}

const shouldUseSafeDefaultLimit = options.limit === null && !options.all && options.regionIds.length === 0;
const effectiveLimit = shouldUseSafeDefaultLimit ? 200 : options.limit;
if (shouldUseSafeDefaultLimit) {
  console.warn(
    "No --limit provided for full-catalog run; defaulting to limit=200. Use --all=1 to process everything at once.",
  );
}

const startIndex = Math.min(options.offset, targetRows.length);
const endIndex =
  effectiveLimit === null ? targetRows.length : Math.min(targetRows.length, startIndex + effectiveLimit);
const selectedRows = targetRows.slice(startIndex, endIndex);
const totalRows = selectedRows.length;
const resolveMode = options.forceRefresh ? "force_refresh" : "refresh_if_stale";
console.log(
  `Starting weather snapshot update: rows=${totalRows}, mode=${resolveMode}, includeMarine=${options.includeMarine}`,
);

const counts: Record<WeatherSummaryResolveSource, number> = {
  snapshot_fresh: 0,
  snapshot_stale: 0,
  refreshed: 0,
};
let processed = 0;
let errors = 0;

for (const row of selectedRows) {
  processed += 1;

  try {
    const result = await resolveWeatherSummaryForRegionMonth({
      regionId: row.regionId,
      month: row.month,
      includeMarine: options.includeMarine,
      mode: resolveMode,
      allowStaleSnapshot: options.allowStaleSnapshot,
    });
    counts[result.source] += 1;

    console.log(`[${processed}/${totalRows}] ${row.regionId} month=${row.month} -> ${result.source}`);
  } catch (error) {
    errors += 1;
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${processed}/${totalRows}] ${row.regionId} month=${row.month} -> ERROR: ${message}`);
  }

  if (options.pauseMs > 0 && processed < totalRows) {
    await sleep(options.pauseMs);
  }
}

console.log("Weather snapshot update summary:");
console.log(`- refreshed: ${counts.refreshed}`);
console.log(`- snapshot_fresh: ${counts.snapshot_fresh}`);
console.log(`- snapshot_stale: ${counts.snapshot_stale}`);
console.log(`- errors: ${errors}`);

if (errors > 0) {
  process.exitCode = 1;
}
