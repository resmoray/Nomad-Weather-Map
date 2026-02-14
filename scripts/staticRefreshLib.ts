import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type LayoutMode = "region-month" | "shard";

export interface RegionCatalogEntry {
  id: string;
  isCoastal: boolean;
}

export interface OpenMeteoMonthlySummary {
  temperatureC: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  rainfallMm: number | null;
  humidityPct: number | null;
  windKph: number | null;
  uvIndex: number | null;
  uvIndexMax: number | null;
  pm25: number | null;
  aqi: number | null;
  waveHeightM: number | null;
  waveHeightMinM: number | null;
  waveHeightMaxM: number | null;
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
  waterTempC: number | null;
  climateLastUpdated: string;
  airQualityLastUpdated: string;
  marineLastUpdated: string;
}

export interface StaticRefreshState {
  cursor: number;
  lastRunAt: string;
  regionsHash: string;
  targetCycleDays: number;
  dailyBudget: number;
  baselineYears: number;
  layoutMode: LayoutMode;
}

export interface CanonicalStore {
  schemaVersion: string;
  updatedAt: string;
  summaries: Record<string, Record<string, OpenMeteoMonthlySummary>>;
}

export interface CycleBudget {
  callsPerRegion: number;
  maxRegionsPerDay: number;
  desiredRegionsPerDay: number;
  effectiveRegionsPerDay: number;
  regionsPerRun: number;
  effectiveCycleDays: number;
}

export interface ExportStats {
  generatedAt: string;
  datasetVersion: string;
  layoutMode: LayoutMode;
  regionCount: number;
  monthCount: number;
  writtenFiles: number;
  missingEntries: number;
}

export interface ValidationReport {
  layoutMode: LayoutMode | "unknown";
  checkedRegions: number;
  checkedEntries: number;
  errors: string[];
}

const DEFAULT_BASELINE_YEARS = 5;
const DEFAULT_TARGET_CYCLE_DAYS = 180;
const DEFAULT_DAILY_BUDGET = 3000;
const DEFAULT_RUNS_PER_DAY = 1;
const DEFAULT_LAYOUT_THRESHOLD = 10_000;
const DEFAULT_REGION_PREFIX_LENGTH = 2;

export const STATIC_SCHEMA_VERSION = "nomad-static-weather-v1";
export const STATIC_MONTHS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const STATIC_RUNS_PER_DAY = parsePositiveInt(
  process.env.RUNS_PER_DAY,
  DEFAULT_RUNS_PER_DAY,
);
export const STATIC_LAYOUT_THRESHOLD = parsePositiveInt(
  process.env.STATIC_LAYOUT_SHARD_THRESHOLD,
  DEFAULT_LAYOUT_THRESHOLD,
);
export const STATIC_REGION_PREFIX_LENGTH = parsePositiveInt(
  process.env.STATIC_REGION_PREFIX_LENGTH,
  DEFAULT_REGION_PREFIX_LENGTH,
);

const ROOT_DIR = process.cwd();
export const STATIC_REFRESH_DIR = resolve(ROOT_DIR, ".github", "static-refresh");
export const STATIC_REFRESH_STATE_PATH = resolve(STATIC_REFRESH_DIR, "state.json");
export const STATIC_CANONICAL_PATH = resolve(STATIC_REFRESH_DIR, "canonical.json");
export const STATIC_PUBLIC_DIR = resolve(ROOT_DIR, "public", "static-weather", "v1");
const REGIONS_PATH = resolve(ROOT_DIR, "src", "data", "regions.json");

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function writeJsonAtomic(filePath: string, payload: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  renameSync(tempPath, filePath);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isOpenMeteoMonthlySummary(value: unknown): value is OpenMeteoMonthlySummary {
  if (!value || typeof value !== "object") {
    return false;
  }

  const typed = value as Record<string, unknown>;
  const numericFields = [
    "temperatureC",
    "temperatureMinC",
    "temperatureMaxC",
    "rainfallMm",
    "humidityPct",
    "windKph",
    "uvIndex",
    "uvIndexMax",
    "pm25",
    "aqi",
    "waveHeightM",
    "waveHeightMinM",
    "waveHeightMaxM",
    "wavePeriodS",
    "waveDirectionDeg",
    "waterTempC",
  ];
  const stringFields = ["climateLastUpdated", "airQualityLastUpdated", "marineLastUpdated"];

  return (
    numericFields.every((field) => isFiniteNumberOrNull(typed[field])) &&
    stringFields.every((field) => typeof typed[field] === "string" && typed[field].length > 0)
  );
}

function parseLayoutMode(raw: unknown, fallback: LayoutMode): LayoutMode {
  if (raw === "region-month" || raw === "shard") {
    return raw;
  }

  return fallback;
}

function datasetVersionFromIso(iso: string): string {
  return iso.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function monthFileName(month: number): string {
  return `m${String(month).padStart(2, "0")}.json`;
}

function regionPrefix(regionId: string): string {
  return regionId.slice(0, Math.max(1, STATIC_REGION_PREFIX_LENGTH)).toLowerCase();
}

function regionsHash(regionIds: string[]): string {
  return createHash("sha1").update(regionIds.join("|")).digest("hex");
}

export function resolveBaselineYears(defaultValue = DEFAULT_BASELINE_YEARS): number {
  return parsePositiveInt(
    process.env.WEATHER_BASELINE_YEARS ?? process.env.VITE_WEATHER_BASELINE_YEARS,
    defaultValue,
  );
}

export function determineLayoutMode(regionCount: number): LayoutMode {
  return regionCount > STATIC_LAYOUT_THRESHOLD ? "shard" : "region-month";
}

export function calculateCycleBudget(
  totalRegions: number,
  state: Pick<StaticRefreshState, "baselineYears" | "targetCycleDays" | "dailyBudget">,
): CycleBudget {
  if (totalRegions <= 0) {
    return {
      callsPerRegion: Math.max(1, state.baselineYears * 3),
      maxRegionsPerDay: 1,
      desiredRegionsPerDay: 1,
      effectiveRegionsPerDay: 1,
      regionsPerRun: 1,
      effectiveCycleDays: 0,
    };
  }

  const callsPerRegion = Math.max(1, state.baselineYears * 3);
  const maxRegionsPerDay = Math.max(1, Math.floor(state.dailyBudget / callsPerRegion));
  const desiredRegionsPerDay = Math.max(1, Math.ceil(totalRegions / state.targetCycleDays));
  const effectiveRegionsPerDay = Math.min(desiredRegionsPerDay, maxRegionsPerDay);
  const regionsPerRun = Math.max(1, Math.ceil(effectiveRegionsPerDay / STATIC_RUNS_PER_DAY));
  const effectiveCycleDays = Math.ceil(totalRegions / effectiveRegionsPerDay);

  return {
    callsPerRegion,
    maxRegionsPerDay,
    desiredRegionsPerDay,
    effectiveRegionsPerDay,
    regionsPerRun,
    effectiveCycleDays,
  };
}

export function selectRegionBatch(
  regionIds: string[],
  cursor: number,
  regionsPerRun: number,
): { regionIds: string[]; nextCursor: number } {
  if (regionIds.length === 0) {
    return { regionIds: [], nextCursor: 0 };
  }

  const start = ((cursor % regionIds.length) + regionIds.length) % regionIds.length;
  const count = Math.max(1, Math.min(regionsPerRun, regionIds.length));
  const selected: string[] = [];

  for (let index = 0; index < count; index += 1) {
    selected.push(regionIds[(start + index) % regionIds.length]!);
  }

  const nextCursor = (start + count) % regionIds.length;
  return { regionIds: selected, nextCursor };
}

export function readRegionCatalog(): RegionCatalogEntry[] {
  const raw = readFileSync(REGIONS_PATH, "utf-8");
  const parsed = JSON.parse(raw) as Array<{ id?: unknown; isCoastal?: unknown }>;

  if (!Array.isArray(parsed)) {
    throw new Error("src/data/regions.json must be an array");
  }

  const rows = parsed
    .map((entry) => {
      const id = typeof entry?.id === "string" ? entry.id.trim() : "";
      if (!id) {
        return null;
      }
      return {
        id,
        isCoastal: entry?.isCoastal === true,
      } satisfies RegionCatalogEntry;
    })
    .filter((entry): entry is RegionCatalogEntry => entry !== null)
    .sort((left, right) => left.id.localeCompare(right.id));

  const uniqueRows = new Map<string, RegionCatalogEntry>();
  for (const row of rows) {
    uniqueRows.set(row.id, row);
  }

  return [...uniqueRows.values()];
}

export function loadRefreshState(regionIds: string[]): StaticRefreshState {
  const baselineYears = resolveBaselineYears();
  const nextHash = regionsHash(regionIds);
  const defaultState: StaticRefreshState = {
    cursor: 0,
    lastRunAt: "",
    regionsHash: nextHash,
    targetCycleDays: parsePositiveInt(process.env.TARGET_CYCLE_DAYS, DEFAULT_TARGET_CYCLE_DAYS),
    dailyBudget: parsePositiveInt(process.env.DAILY_CALL_BUDGET, DEFAULT_DAILY_BUDGET),
    baselineYears,
    layoutMode: determineLayoutMode(regionIds.length),
  };

  if (!existsSync(STATIC_REFRESH_STATE_PATH)) {
    return defaultState;
  }

  try {
    const raw = readFileSync(STATIC_REFRESH_STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const targetCycleDays = parsePositiveInt(
      typeof parsed.targetCycleDays === "number" ? String(parsed.targetCycleDays) : process.env.TARGET_CYCLE_DAYS,
      defaultState.targetCycleDays,
    );
    const dailyBudget = parsePositiveInt(
      typeof parsed.dailyBudget === "number" ? String(parsed.dailyBudget) : process.env.DAILY_CALL_BUDGET,
      defaultState.dailyBudget,
    );
    const state: StaticRefreshState = {
      cursor:
        typeof parsed.cursor === "number" && Number.isInteger(parsed.cursor) && parsed.cursor >= 0
          ? parsed.cursor
          : 0,
      lastRunAt: typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : "",
      regionsHash: typeof parsed.regionsHash === "string" ? parsed.regionsHash : "",
      targetCycleDays,
      dailyBudget,
      baselineYears:
        typeof parsed.baselineYears === "number" && Number.isInteger(parsed.baselineYears) && parsed.baselineYears > 0
          ? parsed.baselineYears
          : baselineYears,
      layoutMode: parseLayoutMode(parsed.layoutMode, determineLayoutMode(regionIds.length)),
    };

    if (state.regionsHash !== nextHash) {
      state.cursor = 0;
      state.regionsHash = nextHash;
    }

    if (regionIds.length > 0 && state.cursor >= regionIds.length) {
      state.cursor = state.cursor % regionIds.length;
    }

    return state;
  } catch {
    return defaultState;
  }
}

export function saveRefreshState(state: StaticRefreshState): void {
  writeJsonAtomic(STATIC_REFRESH_STATE_PATH, state);
}

export function emptySummary(lastUpdated: string): OpenMeteoMonthlySummary {
  return {
    temperatureC: null,
    temperatureMinC: null,
    temperatureMaxC: null,
    rainfallMm: null,
    humidityPct: null,
    windKph: null,
    uvIndex: null,
    uvIndexMax: null,
    pm25: null,
    aqi: null,
    waveHeightM: null,
    waveHeightMinM: null,
    waveHeightMaxM: null,
    wavePeriodS: null,
    waveDirectionDeg: null,
    waterTempC: null,
    climateLastUpdated: lastUpdated,
    airQualityLastUpdated: lastUpdated,
    marineLastUpdated: lastUpdated,
  };
}

function emptyCanonicalStore(nowIso: string): CanonicalStore {
  return {
    schemaVersion: STATIC_SCHEMA_VERSION,
    updatedAt: nowIso,
    summaries: {},
  };
}

export function loadCanonicalStore(): CanonicalStore {
  const nowIso = new Date().toISOString();
  if (!existsSync(STATIC_CANONICAL_PATH)) {
    return emptyCanonicalStore(nowIso);
  }

  try {
    const raw = readFileSync(STATIC_CANONICAL_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const summaryRoot = parsed.summaries && typeof parsed.summaries === "object" ? parsed.summaries : {};
    const normalizedSummaries: CanonicalStore["summaries"] = {};

    for (const [regionId, monthsRaw] of Object.entries(summaryRoot as Record<string, unknown>)) {
      if (!monthsRaw || typeof monthsRaw !== "object") {
        continue;
      }

      const normalizedMonths: Record<string, OpenMeteoMonthlySummary> = {};
      for (const [monthKey, summaryRaw] of Object.entries(monthsRaw as Record<string, unknown>)) {
        if (!isOpenMeteoMonthlySummary(summaryRaw)) {
          continue;
        }
        normalizedMonths[monthKey] = summaryRaw;
      }

      if (Object.keys(normalizedMonths).length > 0) {
        normalizedSummaries[regionId] = normalizedMonths;
      }
    }

    return {
      schemaVersion:
        typeof parsed.schemaVersion === "string" && parsed.schemaVersion
          ? parsed.schemaVersion
          : STATIC_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === "string" && parsed.updatedAt ? parsed.updatedAt : nowIso,
      summaries: normalizedSummaries,
    };
  } catch {
    return emptyCanonicalStore(nowIso);
  }
}

export function saveCanonicalStore(store: CanonicalStore): void {
  writeJsonAtomic(STATIC_CANONICAL_PATH, store);
}

export function getCanonicalSummary(
  store: CanonicalStore,
  regionId: string,
  month: number,
): OpenMeteoMonthlySummary | null {
  return store.summaries[regionId]?.[String(month)] ?? null;
}

export function setCanonicalSummary(
  store: CanonicalStore,
  regionId: string,
  month: number,
  summary: OpenMeteoMonthlySummary,
): void {
  const monthKey = String(month);
  if (!store.summaries[regionId]) {
    store.summaries[regionId] = {};
  }

  store.summaries[regionId][monthKey] = summary;
}

function resetStaticLayoutDirs(): void {
  rmSync(resolve(STATIC_PUBLIC_DIR, "regions"), { recursive: true, force: true });
  rmSync(resolve(STATIC_PUBLIC_DIR, "shards"), { recursive: true, force: true });
  mkdirSync(STATIC_PUBLIC_DIR, { recursive: true });
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
}

export function exportStaticDataset(input: {
  regions: RegionCatalogEntry[];
  canonical: CanonicalStore;
  state: StaticRefreshState;
}): ExportStats {
  const generatedAt = new Date().toISOString();
  const datasetVersion = datasetVersionFromIso(generatedAt);
  const layoutMode = determineLayoutMode(input.regions.length);
  let writtenFiles = 0;
  let missingEntries = 0;

  resetStaticLayoutDirs();

  if (layoutMode === "region-month") {
    for (const region of input.regions) {
      const prefix = regionPrefix(region.id);

      for (const month of STATIC_MONTHS) {
        const summary = getCanonicalSummary(input.canonical, region.id, month) ?? emptySummary(generatedAt);
        if (!getCanonicalSummary(input.canonical, region.id, month)) {
          missingEntries += 1;
        }

        const payload = {
          schemaVersion: STATIC_SCHEMA_VERSION,
          regionId: region.id,
          month,
          summary,
        };
        const filePath = resolve(
          STATIC_PUBLIC_DIR,
          "regions",
          prefix,
          region.id,
          monthFileName(month),
        );
        writeJson(filePath, payload);
        writtenFiles += 1;
      }
    }
  } else {
    const regionToShard: Record<string, string> = {};
    const shardEntries = new Map<string, Record<string, OpenMeteoMonthlySummary>>();

    for (const region of input.regions) {
      const shardId = `s-${regionPrefix(region.id)}`;
      regionToShard[region.id] = shardId;
      if (!shardEntries.has(shardId)) {
        shardEntries.set(shardId, {});
      }
      const entries = shardEntries.get(shardId)!;

      for (const month of STATIC_MONTHS) {
        const summary = getCanonicalSummary(input.canonical, region.id, month) ?? emptySummary(generatedAt);
        if (!getCanonicalSummary(input.canonical, region.id, month)) {
          missingEntries += 1;
        }

        entries[`${region.id}:${month}`] = summary;
      }
    }

    const indexPayload = {
      schemaVersion: STATIC_SCHEMA_VERSION,
      layoutMode: "shard",
      regionToShard,
    };
    writeJson(resolve(STATIC_PUBLIC_DIR, "shards", "region-index.json"), indexPayload);
    writtenFiles += 1;

    const shardIds = [...shardEntries.keys()].sort((left, right) => left.localeCompare(right));
    for (const shardId of shardIds) {
      const payload = {
        schemaVersion: STATIC_SCHEMA_VERSION,
        shardId,
        entries: shardEntries.get(shardId)!,
      };
      writeJson(resolve(STATIC_PUBLIC_DIR, "shards", `${shardId}.json`), payload);
      writtenFiles += 1;
    }
  }

  const manifest = {
    schemaVersion: STATIC_SCHEMA_VERSION,
    generatedAt,
    baselineYears: input.state.baselineYears,
    layoutMode,
    regionCount: input.regions.length,
    monthCount: STATIC_MONTHS.length,
    datasetVersion,
    sourceCycle: {
      targetCycleDays: input.state.targetCycleDays,
      dailyBudget: input.state.dailyBudget,
      runsPerDay: STATIC_RUNS_PER_DAY,
    },
    regionPrefixLength: STATIC_REGION_PREFIX_LENGTH,
  };
  writeJson(resolve(STATIC_PUBLIC_DIR, "manifest.json"), manifest);
  writtenFiles += 1;

  return {
    generatedAt,
    datasetVersion,
    layoutMode,
    regionCount: input.regions.length,
    monthCount: STATIC_MONTHS.length,
    writtenFiles,
    missingEntries,
  };
}

function readJsonOrNull(filePath: string): unknown | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function validateStaticDataset(regions: RegionCatalogEntry[]): ValidationReport {
  const errors: string[] = [];
  const manifestPath = resolve(STATIC_PUBLIC_DIR, "manifest.json");
  const manifestRaw = readJsonOrNull(manifestPath);
  if (!manifestRaw || typeof manifestRaw !== "object") {
    return {
      layoutMode: "unknown",
      checkedRegions: 0,
      checkedEntries: 0,
      errors: [`missing or invalid manifest: ${manifestPath}`],
    };
  }

  const manifest = manifestRaw as Record<string, unknown>;
  const layoutMode = parseLayoutMode(manifest.layoutMode, "region-month");
  let checkedEntries = 0;

  if (manifest.schemaVersion !== STATIC_SCHEMA_VERSION) {
    errors.push(`manifest schemaVersion must be '${STATIC_SCHEMA_VERSION}'`);
  }
  if (manifest.regionCount !== regions.length) {
    errors.push(`manifest regionCount mismatch (expected ${regions.length}, got ${String(manifest.regionCount)})`);
  }
  if (manifest.monthCount !== STATIC_MONTHS.length) {
    errors.push(`manifest monthCount mismatch (expected ${STATIC_MONTHS.length}, got ${String(manifest.monthCount)})`);
  }
  if (typeof manifest.generatedAt !== "string" || !manifest.generatedAt) {
    errors.push("manifest generatedAt is missing");
  }
  if (typeof manifest.datasetVersion !== "string" || !manifest.datasetVersion) {
    errors.push("manifest datasetVersion is missing");
  }

  if (layoutMode === "region-month") {
    for (const region of regions) {
      const prefix = regionPrefix(region.id);
      for (const month of STATIC_MONTHS) {
        const filePath = resolve(
          STATIC_PUBLIC_DIR,
          "regions",
          prefix,
          region.id,
          monthFileName(month),
        );
        const raw = readJsonOrNull(filePath);
        if (!raw || typeof raw !== "object") {
          errors.push(`missing month file: ${filePath}`);
          continue;
        }

        const typed = raw as Record<string, unknown>;
        if (typed.schemaVersion !== STATIC_SCHEMA_VERSION) {
          errors.push(`invalid schemaVersion in ${filePath}`);
          continue;
        }
        if (typed.regionId !== region.id) {
          errors.push(`regionId mismatch in ${filePath}`);
          continue;
        }
        if (typed.month !== month) {
          errors.push(`month mismatch in ${filePath}`);
          continue;
        }
        if (!isOpenMeteoMonthlySummary(typed.summary)) {
          errors.push(`invalid summary shape in ${filePath}`);
          continue;
        }

        checkedEntries += 1;
      }
    }
  } else {
    const indexPath = resolve(STATIC_PUBLIC_DIR, "shards", "region-index.json");
    const indexRaw = readJsonOrNull(indexPath);
    if (!indexRaw || typeof indexRaw !== "object") {
      errors.push(`missing shard region index: ${indexPath}`);
    } else {
      const indexTyped = indexRaw as Record<string, unknown>;
      const regionToShardRaw =
        indexTyped.regionToShard && typeof indexTyped.regionToShard === "object"
          ? (indexTyped.regionToShard as Record<string, unknown>)
          : null;
      if (!regionToShardRaw) {
        errors.push(`invalid shard region index payload: ${indexPath}`);
      } else {
        const shardCache = new Map<string, Record<string, unknown>>();

        for (const region of regions) {
          const shardId = typeof regionToShardRaw[region.id] === "string" ? String(regionToShardRaw[region.id]) : "";
          if (!shardId) {
            errors.push(`missing shard mapping for region ${region.id}`);
            continue;
          }

          let shardEntries = shardCache.get(shardId);
          if (!shardEntries) {
            const shardPath = resolve(STATIC_PUBLIC_DIR, "shards", `${shardId}.json`);
            const shardRaw = readJsonOrNull(shardPath);
            if (!shardRaw || typeof shardRaw !== "object") {
              errors.push(`missing shard file: ${shardPath}`);
              continue;
            }

            const shardTyped = shardRaw as Record<string, unknown>;
            const entries =
              shardTyped.entries && typeof shardTyped.entries === "object"
                ? (shardTyped.entries as Record<string, unknown>)
                : null;
            if (!entries) {
              errors.push(`invalid shard entries: ${shardPath}`);
              continue;
            }

            shardEntries = entries;
            shardCache.set(shardId, entries);
          }

          for (const month of STATIC_MONTHS) {
            const entryKey = `${region.id}:${month}`;
            const summary = shardEntries[entryKey];
            if (!isOpenMeteoMonthlySummary(summary)) {
              errors.push(`invalid shard summary entry '${entryKey}' in shard '${shardId}'`);
              continue;
            }

            checkedEntries += 1;
          }
        }
      }
    }
  }

  return {
    layoutMode,
    checkedRegions: regions.length,
    checkedEntries,
    errors,
  };
}
