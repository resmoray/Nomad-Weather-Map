import type { ComfortProfileId } from "../../types/presentation";

export interface ScoreRange {
  idealMin: number;
  idealMax: number;
  hardMin: number;
  hardMax: number;
}

export interface ComfortProfileConfig {
  id: ComfortProfileId;
  label: string;
  description: string;
  temperature: ScoreRange;
  humidity: ScoreRange;
  rainfall: ScoreRange;
}

export const COMFORT_PROFILES: Record<ComfortProfileId, ComfortProfileConfig> = {
  tropicalLover: {
    id: "tropicalLover",
    label: "Tropical Lover",
    description: "Loves hot and humid weather.",
    temperature: {
      idealMin: 27,
      idealMax: 34,
      hardMin: 20,
      hardMax: 42,
    },
    humidity: {
      idealMin: 60,
      idealMax: 88,
      hardMin: 35,
      hardMax: 100,
    },
    rainfall: {
      idealMin: 0,
      idealMax: 180,
      hardMin: 0,
      hardMax: 420,
    },
  },
  warmTraveler: {
    id: "warmTraveler",
    label: "Warm Traveler",
    description: "Likes warm weather, but too much humidity is not ideal.",
    temperature: {
      idealMin: 24,
      idealMax: 32,
      hardMin: 14,
      hardMax: 42,
    },
    humidity: {
      idealMin: 45,
      idealMax: 75,
      hardMin: 30,
      hardMax: 98,
    },
    rainfall: {
      idealMin: 0,
      idealMax: 130,
      hardMin: 0,
      hardMax: 320,
    },
  },
  perfectTemp: {
    id: "perfectTemp",
    label: "Perfect Temp",
    description: "Prefers balanced comfort: not too hot, not too humid.",
    temperature: {
      idealMin: 21,
      idealMax: 28,
      hardMin: 10,
      hardMax: 38,
    },
    humidity: {
      idealMin: 40,
      idealMax: 68,
      hardMin: 25,
      hardMax: 95,
    },
    rainfall: {
      idealMin: 0,
      idealMax: 90,
      hardMin: 0,
      hardMax: 280,
    },
  },
  coolLover: {
    id: "coolLover",
    label: "Cool Lover",
    description: "Likes cooler and drier weather.",
    temperature: {
      idealMin: 16,
      idealMax: 24,
      hardMin: 5,
      hardMax: 34,
    },
    humidity: {
      idealMin: 35,
      idealMax: 60,
      hardMin: 20,
      hardMax: 90,
    },
    rainfall: {
      idealMin: 0,
      idealMax: 70,
      hardMin: 0,
      hardMax: 240,
    },
  },
};

export function getComfortProfileLabel(profileId: ComfortProfileId): string {
  return COMFORT_PROFILES[profileId].label;
}
