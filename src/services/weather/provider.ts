import { calculateSuitability } from "../scoring/calculateSuitability";
import { MONTHS, type Month, type Region, type RegionMonthRecord } from "../../types/weather";
import { mapOpenMeteoSummaryToMetrics } from "./mapper";
import { fetchOpenMeteoMonthlySummary } from "./openMeteoClient";

export interface WeatherProvider {
  getRegionMonthRecord(region: Region, month: Month): Promise<RegionMonthRecord>;
  getRegionTimeline(region: Region): Promise<RegionMonthRecord[]>;
  clearCache(): void;
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly monthCache = new Map<string, Promise<RegionMonthRecord>>();

  private getCacheKey(regionId: string, month: Month): string {
    return `${regionId}-${month}`;
  }

  clearCache(): void {
    this.monthCache.clear();
  }

  async getRegionMonthRecord(region: Region, month: Month): Promise<RegionMonthRecord> {
    const key = this.getCacheKey(region.id, month);
    const cached = this.monthCache.get(key);

    if (cached) {
      return cached;
    }

    const loadPromise = (async () => {
      const summary = await fetchOpenMeteoMonthlySummary(region, month);
      const metrics = mapOpenMeteoSummaryToMetrics(summary);
      const suitability = calculateSuitability(metrics);

      return {
        region,
        month,
        metrics,
        suitability,
        temperatureProfile: {
          minC: summary.temperatureMinC,
          avgC: summary.temperatureC,
          maxC: summary.temperatureMaxC,
        },
      };
    })();

    this.monthCache.set(key, loadPromise);

    try {
      return await loadPromise;
    } catch (error) {
      this.monthCache.delete(key);
      throw error;
    }
  }

  async getRegionTimeline(region: Region): Promise<RegionMonthRecord[]> {
    const records = await Promise.all(MONTHS.map((month) => this.getRegionMonthRecord(region, month)));
    return [...records].sort((left, right) => left.month - right.month);
  }
}

export const weatherProvider: WeatherProvider = new OpenMeteoWeatherProvider();
