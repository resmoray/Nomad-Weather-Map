import { calculateSuitability } from "../scoring/calculateSuitability";
import { MONTHS, type Month, type Region, type RegionMonthRecord } from "../../types/weather";
import { mapOpenMeteoSummaryToMetrics } from "./mapper";
import { clearStaticWeatherCache, fetchOpenMeteoMonthlySummary } from "./openMeteoClient";

interface RecordLoadOptions {
  includeMarine?: boolean;
}

export interface WeatherProvider {
  getRegionMonthRecord(region: Region, month: Month, options?: RecordLoadOptions): Promise<RegionMonthRecord>;
  getRegionTimeline(region: Region, options?: RecordLoadOptions): Promise<RegionMonthRecord[]>;
  clearCache(): void;
}

interface CacheEntry {
  promise: Promise<RegionMonthRecord>;
  expiresAt: number;
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly monthCache = new Map<string, CacheEntry>();

  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;

  private getCacheKey(regionId: string, month: Month, includeMarine: boolean): string {
    return `${regionId}-${month}-${includeMarine ? "marine" : "no-marine"}`;
  }

  clearCache(): void {
    this.monthCache.clear();
    clearStaticWeatherCache();
  }

  async getRegionMonthRecord(
    region: Region,
    month: Month,
    options?: RecordLoadOptions,
  ): Promise<RegionMonthRecord> {
    const includeMarine = (options?.includeMarine ?? true) && region.isCoastal;
    const key = this.getCacheKey(region.id, month, includeMarine);
    const cachedEntry = this.monthCache.get(key);

    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.promise;
    }

    const loadPromise = (async () => {
      const summary = await fetchOpenMeteoMonthlySummary(region, month, {
        includeMarine,
      });
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

    this.monthCache.set(key, {
      promise: loadPromise,
      expiresAt: Date.now() + OpenMeteoWeatherProvider.CACHE_TTL_MS,
    });

    try {
      const record = await loadPromise;
      const missingAllAirMetrics =
        record.metrics.pm25.value === null &&
        record.metrics.aqi.value === null &&
        record.metrics.uvIndex.value === null;

      // Avoid caching all-null air snapshots for long periods; they are often transient.
      if (missingAllAirMetrics) {
        this.monthCache.delete(key);
      }

      return record;
    } catch (error) {
      this.monthCache.delete(key);
      throw error;
    }
  }

  async getRegionTimeline(region: Region, options?: RecordLoadOptions): Promise<RegionMonthRecord[]> {
    const includeMarine = (options?.includeMarine ?? true) && region.isCoastal;
    const records = await Promise.all(
      MONTHS.map((month) =>
        this.getRegionMonthRecord(region, month, {
          includeMarine,
        }),
      ),
    );
    return [...records].sort((left, right) => left.month - right.month);
  }
}

export const weatherProvider: WeatherProvider = new OpenMeteoWeatherProvider();
