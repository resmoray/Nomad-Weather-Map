import { resolveWeatherSummaryForRegionMonth, type WeatherSummaryResolveSource } from "../server/weatherSummaryService.ts";
import {
  calculateCycleBudget,
  type CanonicalStore,
  type OpenMeteoMonthlySummary,
  type RegionCatalogEntry,
  type StaticRefreshState,
  STATIC_MONTHS,
  STATIC_RUNS_PER_DAY,
  determineLayoutMode,
  getCanonicalSummary,
  loadCanonicalStore,
  loadRefreshState,
  readRegionCatalog,
  saveCanonicalStore,
  saveRefreshState,
  selectRegionBatch,
  setCanonicalSummary,
} from "./staticRefreshLib.ts";

interface CliOptions {
  regionIds: string[];
  targetCycleDays: number | null;
  dailyBudget: number | null;
  baselineYears: number | null;
  cursor: number | null;
}

interface RefreshCounters {
  refreshed: number;
  snapshotFresh: number;
  snapshotStale: number;
  errors: number;
}

const DEFAULT_REGION_REFRESH_TIMEOUT_MS = 180_000;

function parsePositiveInt(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

function parsePositiveIntOr(raw: string | undefined, fallback: number): number {
  return parsePositiveInt(raw) ?? fallback;
}

function parseNonNegativeInt(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

  return {
    regionIds: parseList(byKey.get("regionIds")),
    targetCycleDays: parsePositiveInt(byKey.get("targetCycleDays")),
    dailyBudget: parsePositiveInt(byKey.get("dailyBudget")),
    baselineYears: parsePositiveInt(byKey.get("baselineYears")),
    cursor: parseNonNegativeInt(byKey.get("cursor")),
  };
}

function applyOverrides(state: StaticRefreshState, options: CliOptions): StaticRefreshState {
  return {
    ...state,
    cursor: options.cursor ?? state.cursor,
    targetCycleDays: options.targetCycleDays ?? state.targetCycleDays,
    dailyBudget: options.dailyBudget ?? state.dailyBudget,
    baselineYears: options.baselineYears ?? state.baselineYears,
  };
}

function incrementSourceCounter(counters: RefreshCounters, source: WeatherSummaryResolveSource): void {
  if (source === "refreshed") {
    counters.refreshed += 1;
    return;
  }
  if (source === "snapshot_fresh") {
    counters.snapshotFresh += 1;
    return;
  }
  counters.snapshotStale += 1;
}

async function refreshRegionMonths(input: {
  region: RegionCatalogEntry;
  canonical: CanonicalStore;
  counters: RefreshCounters;
}): Promise<void> {
  for (const month of STATIC_MONTHS) {
    try {
      const result = await resolveWeatherSummaryForRegionMonth({
        regionId: input.region.id,
        month,
        includeMarine: input.region.isCoastal,
        mode: "force_refresh",
        allowStaleSnapshot: true,
      });
      setCanonicalSummary(input.canonical, input.region.id, month, result.summary as OpenMeteoMonthlySummary);
      incrementSourceCounter(input.counters, result.source);
    } catch (error) {
      input.counters.errors += 1;
      const existing = getCanonicalSummary(input.canonical, input.region.id, month);
      if (!existing) {
        throw error;
      }
    }
  }
}

function regionHasCompleteCoverage(canonical: CanonicalStore, regionId: string): boolean {
  for (const month of STATIC_MONTHS) {
    if (!getCanonicalSummary(canonical, regionId, month)) {
      return false;
    }
  }

  return true;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Region refresh timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

const options = parseCliOptions(process.argv.slice(2));
const regions = readRegionCatalog();
const regionIds = regions.map((region) => region.id);
const regionById = new Map(regions.map((region) => [region.id, region]));
const canonical = loadCanonicalStore();
const baseState = loadRefreshState(regionIds);
const state = applyOverrides(baseState, options);

process.env.WEATHER_BASELINE_YEARS = String(state.baselineYears);

const budget = calculateCycleBudget(regions.length, state);
const autoBatch = selectRegionBatch(regionIds, state.cursor, budget.regionsPerRun);
const selectedRegionIds =
  options.regionIds.length > 0
    ? options.regionIds.filter((regionId) => regionById.has(regionId))
    : autoBatch.regionIds;
const nextCursor =
  options.regionIds.length > 0
    ? state.cursor
    : autoBatch.nextCursor;

const unknownRegionIds = options.regionIds.filter((regionId) => !regionById.has(regionId));
if (unknownRegionIds.length > 0) {
  console.warn(`Skipping unknown region ids: ${unknownRegionIds.join(", ")}`);
}

const counters: RefreshCounters = {
  refreshed: 0,
  snapshotFresh: 0,
  snapshotStale: 0,
  errors: 0,
};

console.log(
  [
    "Starting static refresh batch:",
    `regionsTotal=${regions.length}`,
    `selectedRegions=${selectedRegionIds.length}`,
    `cursor=${state.cursor}`,
    `nextCursor=${nextCursor}`,
    `callsPerRegion=${budget.callsPerRegion}`,
    `desiredRegionsPerDay=${budget.desiredRegionsPerDay}`,
    `maxRegionsPerDay=${budget.maxRegionsPerDay}`,
    `effectiveRegionsPerDay=${budget.effectiveRegionsPerDay}`,
    `regionsPerRun=${budget.regionsPerRun}`,
    `effectiveCycleDays=${budget.effectiveCycleDays}`,
    `runsPerDay=${STATIC_RUNS_PER_DAY}`,
  ].join(" "),
);

let processedRegions = 0;
let fatalErrors = 0;
const regionRefreshTimeoutMs = parsePositiveIntOr(
  process.env.STATIC_REFRESH_REGION_TIMEOUT_MS,
  DEFAULT_REGION_REFRESH_TIMEOUT_MS,
);

for (const regionId of selectedRegionIds) {
  const region = regionById.get(regionId);
  if (!region) {
    continue;
  }

  processedRegions += 1;
  const regionWasComplete = regionHasCompleteCoverage(canonical, region.id);
  try {
    await withTimeout(
      refreshRegionMonths({
        region,
        canonical,
        counters,
      }),
      regionRefreshTimeoutMs,
    );
    console.log(`[${processedRegions}/${selectedRegionIds.length}] ${region.id} -> ok`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh error";
    if (regionWasComplete) {
      counters.errors += 1;
      console.warn(`[${processedRegions}/${selectedRegionIds.length}] ${region.id} -> WARN: ${message}`);
      continue;
    }

    fatalErrors += 1;
    console.error(`[${processedRegions}/${selectedRegionIds.length}] ${region.id} -> ERROR: ${message}`);
  }
}

canonical.updatedAt = new Date().toISOString();
saveCanonicalStore(canonical);

const nextState: StaticRefreshState = {
  ...state,
  cursor: nextCursor,
  lastRunAt: new Date().toISOString(),
  layoutMode: determineLayoutMode(regions.length),
};
saveRefreshState(nextState);

console.log("Static refresh batch summary:");
console.log(`- regionsProcessed: ${processedRegions}`);
console.log(`- refreshed: ${counters.refreshed}`);
console.log(`- snapshotFresh: ${counters.snapshotFresh}`);
console.log(`- snapshotStale: ${counters.snapshotStale}`);
console.log(`- recoverableErrors: ${counters.errors}`);
console.log(`- fatalErrors: ${fatalErrors}`);

if (fatalErrors > 0) {
  process.exitCode = 1;
}
