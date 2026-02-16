import { useEffect } from "react";
import type { MatrixMode, UserPreferenceProfile } from "../../types/presentation";
import type { CountryCode, MetricKey, Month } from "../../types/weather";
import { buildAppUrlState } from "../../utils/urlState";

export interface UseAppUrlSyncInput {
  selectedCountryCodes: CountryCode[];
  selectedMonth: Month;
  selectedRegionIds: string[];
  matrixMode: MatrixMode;
  timelineRegionId: string;
  profile: UserPreferenceProfile;
  minScore: number;
  pinnedMetricKeys: MetricKey[];
}

export function useAppUrlSync({
  selectedCountryCodes,
  selectedMonth,
  selectedRegionIds,
  matrixMode,
  timelineRegionId,
  profile,
  minScore,
  pinnedMetricKeys,
}: UseAppUrlSyncInput): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = buildAppUrlState({
        selectedCountryCodes,
        selectedMonth,
        selectedRegionIds,
        matrixMode,
        timelineRegionId,
        profile,
        minScore,
        pinnedRows: pinnedMetricKeys,
      });
      const next = `${window.location.pathname}?${search}`;
      window.history.replaceState(null, "", next);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    selectedCountryCodes,
    selectedMonth,
    selectedRegionIds,
    matrixMode,
    timelineRegionId,
    profile,
    minScore,
    pinnedMetricKeys,
  ]);
}

