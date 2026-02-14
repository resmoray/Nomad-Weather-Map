import { resolveWeatherSummaryForRegionMonth } from "../server/weatherSummaryService.ts";
import {
  determineLayoutMode,
  exportStaticDataset,
  getCanonicalSummary,
  loadCanonicalStore,
  loadRefreshState,
  readRegionCatalog,
  saveCanonicalStore,
  saveRefreshState,
  setCanonicalSummary,
  STATIC_MONTHS,
} from "./staticRefreshLib.ts";

interface CliOptions {
  regionIds: string[];
  missingOnly: boolean;
  mode: "verified_only" | "refresh_if_stale" | "force_refresh";
  allowStale: boolean;
  runExport: boolean;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
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

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseMode(raw: string | undefined): CliOptions["mode"] {
  if (raw === "verified_only" || raw === "refresh_if_stale" || raw === "force_refresh") {
    return raw;
  }

  return "verified_only";
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
    missingOnly: parseBoolean(byKey.get("missingOnly"), true),
    mode: parseMode(byKey.get("mode")),
    allowStale: parseBoolean(byKey.get("allowStale"), true),
    runExport: parseBoolean(byKey.get("export"), true),
  };
}

function regionMissingAnyMonth(regionId: string, canonical: ReturnType<typeof loadCanonicalStore>): boolean {
  for (const month of STATIC_MONTHS) {
    if (!getCanonicalSummary(canonical, regionId, month)) {
      return true;
    }
  }

  return false;
}

const options = parseCliOptions(process.argv.slice(2));
const regions = readRegionCatalog();
const regionIds = regions.map((region) => region.id);
const regionById = new Map(regions.map((region) => [region.id, region]));
const canonical = loadCanonicalStore();
const state = loadRefreshState(regionIds);

process.env.WEATHER_BASELINE_YEARS = String(state.baselineYears);

const selectedRegionIdsFromCli = options.regionIds.filter((regionId) => regionById.has(regionId));
const selectedRegionIds =
  selectedRegionIdsFromCli.length > 0
    ? selectedRegionIdsFromCli
    : options.missingOnly
      ? regionIds.filter((regionId) => regionMissingAnyMonth(regionId, canonical))
      : regionIds;

const unknownRegionIds = options.regionIds.filter((regionId) => !regionById.has(regionId));
if (unknownRegionIds.length > 0) {
  console.warn(`Skipping unknown region ids: ${unknownRegionIds.join(", ")}`);
}

console.log(
  `Bootstrapping regions: mode=${options.mode}, missingOnly=${options.missingOnly}, selected=${selectedRegionIds.length}`,
);

let processedRegions = 0;
let updatedEntries = 0;
let errors = 0;

for (const regionId of selectedRegionIds) {
  const region = regionById.get(regionId);
  if (!region) {
    continue;
  }

  processedRegions += 1;
  for (const month of STATIC_MONTHS) {
    if (options.missingOnly && getCanonicalSummary(canonical, region.id, month)) {
      continue;
    }

    try {
      const result = await resolveWeatherSummaryForRegionMonth({
        regionId: region.id,
        month,
        includeMarine: region.isCoastal,
        mode: options.mode,
        allowStaleSnapshot: options.allowStale,
      });
      setCanonicalSummary(canonical, region.id, month, result.summary);
      updatedEntries += 1;
    } catch (error) {
      errors += 1;
      const message = error instanceof Error ? error.message : "Unknown bootstrap error";
      console.error(`[${region.id}] month=${month} -> ERROR: ${message}`);
    }
  }

  console.log(`[${processedRegions}/${selectedRegionIds.length}] ${region.id} -> done`);
}

canonical.updatedAt = new Date().toISOString();
saveCanonicalStore(canonical);

let exportMissingEntries = 0;
if (options.runExport) {
  const exportStats = exportStaticDataset({
    regions,
    canonical,
    state,
  });
  exportMissingEntries = exportStats.missingEntries;
  const nextState = {
    ...state,
    layoutMode: determineLayoutMode(regions.length),
    lastRunAt: new Date().toISOString(),
  };
  saveRefreshState(nextState);
  console.log(
    `Export finished: layout=${exportStats.layoutMode}, files=${exportStats.writtenFiles}, missingEntries=${exportStats.missingEntries}`,
  );
}

console.log("Bootstrap summary:");
console.log(`- regionsProcessed: ${processedRegions}`);
console.log(`- entriesUpdated: ${updatedEntries}`);
console.log(`- errors: ${errors}`);
console.log(`- exportMissingEntries: ${exportMissingEntries}`);

if (errors > 0 || exportMissingEntries > 0) {
  process.exitCode = 1;
}
