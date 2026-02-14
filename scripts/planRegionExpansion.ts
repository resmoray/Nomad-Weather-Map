import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

interface RegionCandidate {
  regionId: string;
  countryCode: string;
  countryName: string;
  cityName: string;
  lat: number;
  lon: number;
  population: number;
  isCoastal: boolean;
  koppenMain: string;
}

interface CliOptions {
  countries: string[];
  maxPerCountry: number;
  candidatesFile: string;
  outFile: string;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
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
    countries: parseList(byKey.get("countries")),
    maxPerCountry: parsePositiveInt(byKey.get("maxPerCountry"), 8),
    candidatesFile: (byKey.get("candidatesFile") ?? "data/region-candidates.json").trim(),
    outFile: (byKey.get("outFile") ?? ".github/static-refresh/region-expansion-plan.json").trim(),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function deriveKoppenMainFromLatitude(latitude: number): string {
  const abs = Math.abs(latitude);
  if (abs < 15) {
    return "A";
  }
  if (abs < 30) {
    return "B";
  }
  if (abs < 45) {
    return "C";
  }
  if (abs < 60) {
    return "D";
  }
  return "E";
}

function normalizeCandidate(raw: Record<string, unknown>): RegionCandidate | null {
  const countryCode = typeof raw.countryCode === "string" ? raw.countryCode.trim().toUpperCase() : "";
  const countryName = typeof raw.countryName === "string" ? raw.countryName.trim() : "";
  const cityName = typeof raw.cityName === "string" ? raw.cityName.trim() : "";
  const lat = typeof raw.lat === "number" ? raw.lat : Number.NaN;
  const lon = typeof raw.lon === "number" ? raw.lon : Number.NaN;

  if (!countryCode || !countryName || !cityName || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }

  const rawRegionId = typeof raw.regionId === "string" ? raw.regionId.trim() : "";
  const regionId = rawRegionId || `${countryCode.toLowerCase()}-${slugify(cityName)}`;
  const population =
    typeof raw.population === "number" && Number.isFinite(raw.population)
      ? Math.max(0, Math.floor(raw.population))
      : 0;
  const isCoastal = raw.isCoastal === true;
  const koppenRaw = typeof raw.koppenMain === "string" ? raw.koppenMain.trim().toUpperCase() : "";
  const koppenMain = koppenRaw || deriveKoppenMainFromLatitude(lat);

  return {
    regionId,
    countryCode,
    countryName,
    cityName,
    lat,
    lon,
    population,
    isCoastal,
    koppenMain,
  };
}

function loadBaseCandidates(): RegionCandidate[] {
  const regionsPath = resolve(process.cwd(), "src", "data", "regions.json");
  const raw = JSON.parse(readFileSync(regionsPath, "utf-8")) as Array<Record<string, unknown>>;
  return raw
    .map((entry) =>
      normalizeCandidate({
        ...entry,
        regionId: typeof entry.id === "string" ? entry.id : undefined,
      }),
    )
    .filter((entry): entry is RegionCandidate => entry !== null);
}

function loadExtraCandidates(filePath: string): RegionCandidate[] {
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    return [];
  }

  const raw = JSON.parse(readFileSync(resolved, "utf-8")) as Array<Record<string, unknown>>;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((entry) => normalizeCandidate(entry)).filter((entry): entry is RegionCandidate => entry !== null);
}

function bucketKey(candidate: RegionCandidate): string {
  return `${candidate.koppenMain}:${candidate.isCoastal ? "coastal" : "inland"}`;
}

function compareCandidates(left: RegionCandidate, right: RegionCandidate): number {
  if (left.population !== right.population) {
    return right.population - left.population;
  }

  return left.cityName.localeCompare(right.cityName, undefined, { sensitivity: "base" });
}

const options = parseCliOptions(process.argv.slice(2));
const baseCandidates = loadBaseCandidates();
const extraCandidates = loadExtraCandidates(options.candidatesFile);
const merged = new Map<string, RegionCandidate>();

for (const candidate of [...baseCandidates, ...extraCandidates]) {
  merged.set(candidate.regionId, candidate);
}

const allCandidates = [...merged.values()];
const filteredCandidates =
  options.countries.length > 0
    ? allCandidates.filter((candidate) => options.countries.includes(candidate.countryCode))
    : allCandidates;

const candidatesByCountry = new Map<string, RegionCandidate[]>();
for (const candidate of filteredCandidates) {
  if (!candidatesByCountry.has(candidate.countryCode)) {
    candidatesByCountry.set(candidate.countryCode, []);
  }
  candidatesByCountry.get(candidate.countryCode)!.push(candidate);
}

const countryCodes = [...candidatesByCountry.keys()].sort((left, right) => left.localeCompare(right));
const selectedByCountry: Record<string, RegionCandidate[]> = {};

for (const countryCode of countryCodes) {
  const candidates = candidatesByCountry.get(countryCode) ?? [];
  const buckets = new Map<string, RegionCandidate[]>();
  for (const candidate of candidates) {
    const key = bucketKey(candidate);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key)!.push(candidate);
  }

  const bucketWinners: RegionCandidate[] = [];
  for (const rows of buckets.values()) {
    const sorted = [...rows].sort(compareCandidates);
    if (sorted[0]) {
      bucketWinners.push(sorted[0]);
    }
  }

  const selectedMap = new Map<string, RegionCandidate>();
  for (const row of bucketWinners.sort(compareCandidates)) {
    if (selectedMap.size >= options.maxPerCountry) {
      break;
    }
    selectedMap.set(row.regionId, row);
  }

  if (selectedMap.size < options.maxPerCountry) {
    const remaining = candidates
      .filter((candidate) => !selectedMap.has(candidate.regionId))
      .sort(compareCandidates);

    for (const row of remaining) {
      if (selectedMap.size >= options.maxPerCountry) {
        break;
      }
      selectedMap.set(row.regionId, row);
    }
  }

  selectedByCountry[countryCode] = [...selectedMap.values()];
}

const planPayload = {
  generatedAt: new Date().toISOString(),
  selectionModel: "koppen+coastal",
  maxPerCountry: options.maxPerCountry,
  countriesRequested: options.countries,
  countriesPlanned: countryCodes,
  counts: {
    candidates: filteredCandidates.length,
    selected: Object.values(selectedByCountry).reduce((sum, entries) => sum + entries.length, 0),
  },
  selectedByCountry,
};

const outPath = resolve(process.cwd(), options.outFile);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(planPayload, null, 2)}\n`, "utf-8");

console.log("Region expansion plan created:");
console.log(`- output: ${outPath}`);
console.log(`- countries: ${countryCodes.length}`);
console.log(`- candidates: ${filteredCandidates.length}`);
console.log(`- selected: ${planPayload.counts.selected}`);
