import type { CountryCode, MetricKey, Month } from "../types/weather";
import type { MatrixMode, UserPreferenceProfile } from "../types/presentation";
import { DEFAULT_PROFILE } from "../features/matrix/customProfile";
import { countries as regionCountries } from "../data/loadRegions";

export interface AppUrlState {
  selectedCountryCodes: CountryCode[];
  selectedMonth: Month;
  selectedRegionIds: string[];
  matrixMode: MatrixMode;
  timelineRegionId: string;
  profile: UserPreferenceProfile;
  minScore: number;
  pinnedRows: MetricKey[];
}

const PINNED_DEFAULT: MetricKey[] = ["temperatureC", "rainfallMm", "pm25", "aqi"];
const ALLOWED_COUNTRY_CODES: CountryCode[] = regionCountries.map((country) => country.code);
const ALLOWED_COUNTRY_CODE_SET = new Set(ALLOWED_COUNTRY_CODES);
const TEMP_VALUES: UserPreferenceProfile["tempPreference"][] = [
  "cool",
  "mild",
  "warm",
  "hot",
  "noPreference",
];
const HUMIDITY_VALUES: UserPreferenceProfile["humidityPreference"][] = [
  "dry",
  "balanced",
  "humid",
  "noPreference",
];
const RAIN_VALUES: UserPreferenceProfile["rainTolerance"][] = [
  "avoidRain",
  "okayRain",
  "rainFlexible",
  "noPreference",
];
const AIR_VALUES: UserPreferenceProfile["airSensitivity"][] = [
  "sensitive",
  "normal",
  "tolerant",
  "noPreference",
];
const UV_VALUES: UserPreferenceProfile["uvSensitivity"][] = [
  "sensitive",
  "normal",
  "tolerant",
  "noPreference",
];
const SEASON_PREFERENCE_VALUES: UserPreferenceProfile["preferredMarketSeason"][] = [
  "low",
  "shoulder",
  "high",
  "noPreference",
];

function parseMonth(raw: string | null): Month | null {
  const month = Number(raw);
  if (month >= 1 && month <= 12) {
    return month as Month;
  }

  return null;
}

function parseCountry(raw: string | null): CountryCode | "ALL" | null {
  if (!raw) {
    return null;
  }

  if (raw === "ALL") {
    return "ALL";
  }

  const upper = raw.toUpperCase();
  return ALLOWED_COUNTRY_CODE_SET.has(upper as CountryCode) ? (upper as CountryCode) : null;
}

function parseCountryCodes(raw: string | null): CountryCode[] | null {
  if (!raw) {
    return null;
  }

  if (raw.toUpperCase() === "ALL") {
    return [];
  }

  const parsed = raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is CountryCode => ALLOWED_COUNTRY_CODE_SET.has(value as CountryCode));

  return Array.from(new Set(parsed));
}

function parsePinnedRows(raw: string | null): MetricKey[] {
  if (!raw) {
    return PINNED_DEFAULT;
  }

  const allowed: MetricKey[] = [
    "temperatureC",
    "rainfallMm",
    "humidityPct",
    "windKph",
    "uvIndex",
    "pm25",
    "aqi",
    "waveHeightM",
    "wavePeriodS",
    "waveDirectionDeg",
    "floodRisk",
    "stormRisk",
  ];

  const parsed = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is MetricKey => allowed.includes(value as MetricKey));

  return parsed.length > 0 ? parsed : PINNED_DEFAULT;
}

function parseEnumValue<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!raw) {
    return fallback;
  }

  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function parseAppUrlState(search: string): Partial<AppUrlState> {
  const params = new URLSearchParams(search);

  const selectedCountryCodesFromParam = parseCountryCodes(params.get("countries"));
  const legacyCountry = parseCountry(params.get("country"));
  const selectedCountryCodes =
    selectedCountryCodesFromParam ??
    (legacyCountry === null ? undefined : legacyCountry === "ALL" ? [] : [legacyCountry]);
  const selectedMonth = parseMonth(params.get("month"));
  const selectedRegionIds = (params.get("regions") ?? "")
    .split(",")
    .map((region) => region.trim())
    .filter(Boolean);
  const mode = params.get("mode");
  const matrixMode: MatrixMode | null = mode === "timeline" || mode === "monthCompare" ? mode : null;
  const timelineRegionId = params.get("timelineRegion") ?? "";
  const minScoreRaw = Number(params.get("minScore") ?? "0");
  const minScore = Number.isFinite(minScoreRaw) ? Math.max(0, Math.min(100, minScoreRaw)) : 0;

  const profile: UserPreferenceProfile = {
    tempPreference: parseEnumValue(params.get("temp"), TEMP_VALUES, DEFAULT_PROFILE.tempPreference),
    humidityPreference: parseEnumValue(
      params.get("humidity"),
      HUMIDITY_VALUES,
      DEFAULT_PROFILE.humidityPreference,
    ),
    rainTolerance: parseEnumValue(params.get("rain"), RAIN_VALUES, DEFAULT_PROFILE.rainTolerance),
    airSensitivity: parseEnumValue(params.get("air"), AIR_VALUES, DEFAULT_PROFILE.airSensitivity),
    uvSensitivity: parseEnumValue(params.get("uv"), UV_VALUES, DEFAULT_PROFILE.uvSensitivity),
    preferredMarketSeason: parseEnumValue(
      params.get("marketSeason"),
      SEASON_PREFERENCE_VALUES,
      DEFAULT_PROFILE.preferredMarketSeason,
    ),
    preferredClimateSeason: parseEnumValue(
      params.get("climateSeason"),
      SEASON_PREFERENCE_VALUES,
      DEFAULT_PROFILE.preferredClimateSeason,
    ),
    surfEnabled: (params.get("surf") ?? "0") === "1",
    dealbreakers: {
      avoidHeavyRain: (params.get("dbRain") ?? "0") === "1",
      avoidUnhealthyAir: (params.get("dbAir") ?? "0") === "1",
      avoidVeryHighUv: (params.get("dbUv") ?? "0") === "1",
      avoidStrongWind: (params.get("dbWind") ?? "0") === "1",
      coastalOnly: (params.get("dbCoastal") ?? "0") === "1",
    },
  };

  return {
    selectedCountryCodes,
    selectedMonth: selectedMonth ?? undefined,
    selectedRegionIds: selectedRegionIds.length > 0 ? selectedRegionIds : undefined,
    matrixMode: matrixMode ?? undefined,
    timelineRegionId: timelineRegionId || undefined,
    profile,
    minScore,
    pinnedRows: parsePinnedRows(params.get("rows")),
  };
}

export function buildAppUrlState(state: AppUrlState): string {
  const params = new URLSearchParams();
  params.set("countries", state.selectedCountryCodes.length === 0 ? "ALL" : state.selectedCountryCodes.join(","));
  params.set("month", String(state.selectedMonth));
  params.set("regions", state.selectedRegionIds.join(","));
  params.set("mode", state.matrixMode);

  if (state.timelineRegionId) {
    params.set("timelineRegion", state.timelineRegionId);
  }

  params.set("temp", state.profile.tempPreference);
  params.set("humidity", state.profile.humidityPreference);
  params.set("rain", state.profile.rainTolerance);
  params.set("air", state.profile.airSensitivity);
  params.set("uv", state.profile.uvSensitivity);
  params.set("marketSeason", state.profile.preferredMarketSeason);
  params.set("climateSeason", state.profile.preferredClimateSeason);
  params.set("surf", state.profile.surfEnabled ? "1" : "0");
  params.set("dbRain", state.profile.dealbreakers.avoidHeavyRain ? "1" : "0");
  params.set("dbAir", state.profile.dealbreakers.avoidUnhealthyAir ? "1" : "0");
  params.set("dbUv", state.profile.dealbreakers.avoidVeryHighUv ? "1" : "0");
  params.set("dbWind", state.profile.dealbreakers.avoidStrongWind ? "1" : "0");
  params.set("dbCoastal", state.profile.dealbreakers.coastalOnly ? "1" : "0");
  params.set("minScore", String(Math.round(state.minScore)));
  params.set("rows", state.pinnedRows.join(","));

  return params.toString();
}

export function getDefaultPinnedRows(): MetricKey[] {
  return [...PINNED_DEFAULT];
}
