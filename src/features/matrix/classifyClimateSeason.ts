import type { CellSeverity } from "../../types/presentation";
import { getFixedSeasonProfile } from "../../services/season/fixedSeasonProfiles";
import type { RegionMonthRecord } from "../../types/weather";

export type ClimateSeasonLabel = "high" | "shoulder" | "off";

export interface ClimateSeasonAssessment {
  label: ClimateSeasonLabel;
  displayLabel: string;
  severity: CellSeverity;
  reason: string;
}

export function classifyClimateSeason(record: RegionMonthRecord): ClimateSeasonAssessment {
  const fixedProfile = getFixedSeasonProfile(record.region.id);
  if (fixedProfile) {
    const fixedLabel = fixedProfile.climateByMonth[record.month];
    if (fixedLabel === "high") {
      return {
        label: "high",
        displayLabel: "Climate high season",
        severity: "excellent",
        reason: fixedProfile.climateReason,
      };
    }

    if (fixedLabel === "off") {
      return {
        label: "off",
        displayLabel: "Climate off season",
        severity: "bad",
        reason: fixedProfile.climateReason,
      };
    }

    return {
      label: "shoulder",
      displayLabel: "Climate shoulder season",
      severity: "good",
      reason: fixedProfile.climateReason,
    };
  }

  return {
    label: "shoulder",
    displayLabel: "Climate shoulder season",
    severity: "missing",
    reason: "No fixed climate season profile configured for this city yet.",
  };
}
