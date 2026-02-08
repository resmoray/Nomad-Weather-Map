import type {
  AirSensitivity,
  DealbreakerSettings,
  HumidityPreference,
  RainTolerance,
  TempPreference,
  UserPreferenceProfile,
  UvSensitivity,
} from "../../types/presentation";

interface RangeConfig {
  idealMin: number;
  idealMax: number;
  hardMin: number;
  hardMax: number;
}

interface LowerBetterConfig {
  goodThreshold: number;
  badThreshold: number;
}

export interface ProfileThresholdConfig {
  temperature: RangeConfig;
  humidity: RangeConfig;
  rainfall: LowerBetterConfig;
  pm25: LowerBetterConfig;
  aqi: LowerBetterConfig;
  uvIndex: LowerBetterConfig;
}

const TEMP_CONFIG: Record<TempPreference, RangeConfig> = {
  cool: { idealMin: 15, idealMax: 23, hardMin: 5, hardMax: 33 },
  mild: { idealMin: 21, idealMax: 29, hardMin: 10, hardMax: 38 },
  warm: { idealMin: 24, idealMax: 32, hardMin: 14, hardMax: 42 },
  hot: { idealMin: 27, idealMax: 35, hardMin: 18, hardMax: 44 },
  noPreference: { idealMin: 6, idealMax: 38, hardMin: -15, hardMax: 55 },
};

const HUMIDITY_CONFIG: Record<HumidityPreference, RangeConfig> = {
  dry: { idealMin: 30, idealMax: 55, hardMin: 15, hardMax: 85 },
  balanced: { idealMin: 40, idealMax: 68, hardMin: 25, hardMax: 95 },
  humid: { idealMin: 55, idealMax: 82, hardMin: 35, hardMax: 100 },
  noPreference: { idealMin: 20, idealMax: 95, hardMin: 0, hardMax: 100 },
};

const RAIN_CONFIG: Record<RainTolerance, LowerBetterConfig> = {
  avoidRain: { goodThreshold: 40, badThreshold: 220 },
  okayRain: { goodThreshold: 85, badThreshold: 300 },
  rainFlexible: { goodThreshold: 120, badThreshold: 380 },
  noPreference: { goodThreshold: 380, badThreshold: 1200 },
};

const AIR_CONFIG: Record<AirSensitivity, { pm25: LowerBetterConfig; aqi: LowerBetterConfig }> = {
  sensitive: {
    pm25: { goodThreshold: 10, badThreshold: 70 },
    aqi: { goodThreshold: 40, badThreshold: 160 },
  },
  normal: {
    pm25: { goodThreshold: 15, badThreshold: 100 },
    aqi: { goodThreshold: 55, badThreshold: 220 },
  },
  tolerant: {
    pm25: { goodThreshold: 25, badThreshold: 130 },
    aqi: { goodThreshold: 70, badThreshold: 260 },
  },
  noPreference: {
    pm25: { goodThreshold: 130, badThreshold: 400 },
    aqi: { goodThreshold: 260, badThreshold: 500 },
  },
};

const UV_CONFIG: Record<UvSensitivity, LowerBetterConfig> = {
  sensitive: { goodThreshold: 3, badThreshold: 9 },
  normal: { goodThreshold: 5, badThreshold: 11 },
  tolerant: { goodThreshold: 6, badThreshold: 13 },
  noPreference: { goodThreshold: 13, badThreshold: 20 },
};

export const DEFAULT_DEALBREAKERS: DealbreakerSettings = {
  avoidHeavyRain: false,
  avoidUnhealthyAir: false,
  avoidVeryHighUv: false,
  avoidStrongWind: false,
  coastalOnly: false,
};

export const DEFAULT_PROFILE: UserPreferenceProfile = {
  tempPreference: "mild",
  humidityPreference: "balanced",
  rainTolerance: "okayRain",
  airSensitivity: "normal",
  uvSensitivity: "normal",
  surfEnabled: false,
  dealbreakers: { ...DEFAULT_DEALBREAKERS },
};

export const TEMP_OPTIONS: Array<{ id: TempPreference; label: string }> = [
  { id: "noPreference", label: "No preference" },
  { id: "cool", label: "Cool" },
  { id: "mild", label: "Mild" },
  { id: "warm", label: "Warm" },
  { id: "hot", label: "Hot" },
];

export const HUMIDITY_OPTIONS: Array<{ id: HumidityPreference; label: string }> = [
  { id: "noPreference", label: "No preference" },
  { id: "dry", label: "Dry" },
  { id: "balanced", label: "Balanced" },
  { id: "humid", label: "Humid" },
];

export const RAIN_OPTIONS: Array<{ id: RainTolerance; label: string }> = [
  { id: "noPreference", label: "No preference" },
  { id: "avoidRain", label: "Avoid rain" },
  { id: "okayRain", label: "Okay with rain" },
  { id: "rainFlexible", label: "Rain-flexible" },
];

export const AIR_OPTIONS: Array<{ id: AirSensitivity; label: string }> = [
  { id: "noPreference", label: "No preference" },
  { id: "sensitive", label: "Sensitive" },
  { id: "normal", label: "Normal" },
  { id: "tolerant", label: "Tolerant" },
];

export const UV_OPTIONS: Array<{ id: UvSensitivity; label: string }> = [
  { id: "noPreference", label: "No preference" },
  { id: "sensitive", label: "Sensitive" },
  { id: "normal", label: "Normal" },
  { id: "tolerant", label: "Tolerant" },
];

export const SURF_IMPORTANCE_OPTIONS: Array<{ id: "off" | "on"; label: string }> = [
  { id: "off", label: "No preference" },
  { id: "on", label: "Important" },
];

export const DEALBREAKER_OPTIONS: Array<{
  id: keyof DealbreakerSettings;
  label: string;
  description: string;
}> = [
  {
    id: "avoidHeavyRain",
    label: "No heavy rain",
    description: "Exclude regions with monthly rain above 180 mm.",
  },
  {
    id: "avoidUnhealthyAir",
    label: "No unhealthy air",
    description: "Exclude when PM2.5 > 55.4 or AQI > 150.",
  },
  {
    id: "avoidVeryHighUv",
    label: "No very high UV",
    description: "Exclude when UV index is above 10.",
  },
  {
    id: "avoidStrongWind",
    label: "No strong wind",
    description: "Exclude when wind is above 35 kph.",
  },
  {
    id: "coastalOnly",
    label: "Coastal only",
    description: "Exclude inland regions.",
  },
];

export function buildThresholdConfig(profile: UserPreferenceProfile): ProfileThresholdConfig {
  const air = AIR_CONFIG[profile.airSensitivity];

  return {
    temperature: TEMP_CONFIG[profile.tempPreference],
    humidity: HUMIDITY_CONFIG[profile.humidityPreference],
    rainfall: RAIN_CONFIG[profile.rainTolerance],
    pm25: air.pm25,
    aqi: air.aqi,
    uvIndex: UV_CONFIG[profile.uvSensitivity],
  };
}
