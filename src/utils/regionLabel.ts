import type { Region } from "../types/weather";

export function formatRegionLabel(region: Region): string {
  return `${region.countryName}, ${region.regionName} - ${region.cityName}`;
}
