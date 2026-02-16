import { useEffect, useState } from "react";
import { weatherProvider } from "../../services/weather/provider";
import type { Month, Region, RegionMonthRecord } from "../../types/weather";

const REGION_LOAD_CONCURRENCY = 3;
const REGION_RETRY_CONCURRENCY = 1;
const REGION_RATE_LIMIT_COOLDOWN_MS = 2600;
const REGION_REQUEST_TIMEOUT_MS = 35000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong while loading weather data.";
}

function isRateLimitedMessage(message: string | null): boolean {
  return typeof message === "string" && message.includes("status 429");
}

function isMissingVerifiedSnapshotMessage(message: string | null): boolean {
  if (typeof message !== "string") {
    return false;
  }

  return message.includes("No verified weather snapshot") || message.includes("weather:snapshot:update");
}

function firstRejectedReason(results: Array<PromiseSettledResult<unknown>>): string | null {
  for (const result of results) {
    if (result.status === "rejected") {
      return getErrorMessage(result.reason);
    }
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

async function mapWithConcurrencyLimit<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  mapper: (item: TItem, index: number) => Promise<TResult>,
): Promise<Array<PromiseSettledResult<TResult>>> {
  if (items.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const settledResults: Array<PromiseSettledResult<TResult>> = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      try {
        const value = await mapper(items[currentIndex], currentIndex);
        settledResults[currentIndex] = { status: "fulfilled", value };
      } catch (error) {
        settledResults[currentIndex] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()));
  return settledResults;
}

export interface UseRegionMonthRecordsInput {
  selectedRegions: Region[];
  selectedMonth: Month;
  refreshCounter: number;
}

export interface UseRegionMonthRecordsResult {
  records: RegionMonthRecord[];
  isLoading: boolean;
  errorMessage: string;
  partialWarning: string;
}

export function useRegionMonthRecords({
  selectedRegions,
  selectedMonth,
  refreshCounter,
}: UseRegionMonthRecordsInput): UseRegionMonthRecordsResult {
  const [records, setRecords] = useState<RegionMonthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [partialWarning, setPartialWarning] = useState<string>("");

  useEffect(() => {
    let isCurrent = true;

    async function loadRecords() {
      if (selectedRegions.length === 0) {
        if (isCurrent) {
          setRecords([]);
          setPartialWarning("");
          setErrorMessage("");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setPartialWarning("");

      try {
        const settled = await mapWithConcurrencyLimit(
          selectedRegions,
          REGION_LOAD_CONCURRENCY,
          (region) =>
            withTimeout(
              weatherProvider.getRegionMonthRecord(region, selectedMonth, {
                includeMarine: true,
              }),
              REGION_REQUEST_TIMEOUT_MS,
              `Weather request timeout for ${region.cityName}`,
            ),
        );

        if (!isCurrent) {
          return;
        }

        const firstPassFulfilled = settled
          .filter((result): result is PromiseFulfilledResult<RegionMonthRecord> => result.status === "fulfilled")
          .map((result) => result.value);

        const failedRegions = settled.flatMap((result, index) =>
          result.status === "rejected" ? [selectedRegions[index]] : [],
        );

        let recoveredRecords: RegionMonthRecord[] = [];
        let stillFailedRegions = failedRegions;
        let finalFailedCount = failedRegions.length;
        let finalFailedPreview = "";
        let finalFailureReason = firstRejectedReason(settled);

        if (failedRegions.length > 0) {
          await sleep(500);

          const retrySettled = await mapWithConcurrencyLimit(
            failedRegions,
            REGION_RETRY_CONCURRENCY,
            (region) =>
              withTimeout(
                weatherProvider.getRegionMonthRecord(region, selectedMonth, {
                  includeMarine: true,
                }),
                REGION_REQUEST_TIMEOUT_MS,
                `Weather request timeout for ${region.cityName}`,
              ),
          );

          if (!isCurrent) {
            return;
          }

          recoveredRecords = retrySettled
            .filter((result): result is PromiseFulfilledResult<RegionMonthRecord> => result.status === "fulfilled")
            .map((result) => result.value);
          finalFailedCount = retrySettled.length - recoveredRecords.length;
          finalFailureReason = firstRejectedReason(retrySettled) ?? finalFailureReason;

          stillFailedRegions = retrySettled.flatMap((result, index) =>
            result.status === "rejected" ? [failedRegions[index]] : [],
          );
          finalFailedPreview = stillFailedRegions
            .slice(0, 3)
            .map((region) => region.cityName)
            .join(", ");
        }

        if (
          stillFailedRegions.length > 0 &&
          firstPassFulfilled.length + recoveredRecords.length === 0 &&
          isRateLimitedMessage(finalFailureReason)
        ) {
          await sleep(REGION_RATE_LIMIT_COOLDOWN_MS);

          const cooldownSettled = await mapWithConcurrencyLimit(
            stillFailedRegions,
            1,
            (region) =>
              withTimeout(
                weatherProvider.getRegionMonthRecord(region, selectedMonth, {
                  includeMarine: true,
                }),
                REGION_REQUEST_TIMEOUT_MS,
                `Weather request timeout for ${region.cityName}`,
              ),
          );

          if (!isCurrent) {
            return;
          }

          const cooldownRecovered = cooldownSettled
            .filter((result): result is PromiseFulfilledResult<RegionMonthRecord> => result.status === "fulfilled")
            .map((result) => result.value);
          recoveredRecords = [...recoveredRecords, ...cooldownRecovered];
          const retryInputRegions = stillFailedRegions;
          stillFailedRegions = cooldownSettled.flatMap((result, index) =>
            result.status === "rejected" ? [retryInputRegions[index]] : [],
          );
          finalFailedCount = stillFailedRegions.length;
          finalFailureReason = firstRejectedReason(cooldownSettled) ?? finalFailureReason;
          finalFailedPreview = stillFailedRegions
            .slice(0, 3)
            .map((region) => region.cityName)
            .join(", ");
        }

        const byRegionId = new Map(
          [...firstPassFulfilled, ...recoveredRecords].map((record) => [record.region.id, record]),
        );
        const resolvedRecords = selectedRegions
          .map((region) => byRegionId.get(region.id))
          .filter((record): record is RegionMonthRecord => Boolean(record));

        setRecords(resolvedRecords);

        const missingAirCount = resolvedRecords.filter(
          (record) =>
            record.metrics.pm25.value === null &&
            record.metrics.aqi.value === null &&
            record.metrics.uvIndex.value === null,
        ).length;

        if (resolvedRecords.length === 0 && finalFailedCount > 0) {
          if (isRateLimitedMessage(finalFailureReason)) {
            setErrorMessage(
              "Open-Meteo throttled requests (429). To keep data truthful, no estimated fallback is used. Try again later or reduce selected regions.",
            );
          } else if (isMissingVerifiedSnapshotMessage(finalFailureReason)) {
            setErrorMessage(
              "No verified weather snapshot is stored yet. Run: npm run weather:snapshot:update -- --limit=200",
            );
          } else {
            const reasonSuffix = finalFailureReason ? ` Last error: ${finalFailureReason}` : "";
            setErrorMessage(`All selected regions failed to load.${reasonSuffix}`);
          }
        } else if (finalFailedCount > 0 || missingAirCount > 0) {
          const warningParts: string[] = [];
          if (finalFailedCount > 0) {
            const previewSuffix = finalFailedPreview
              ? ` (${finalFailedPreview}${finalFailedCount > 3 ? ", ..." : ""})`
              : "";
            warningParts.push(`${finalFailedCount} region(s) failed to load after retry${previewSuffix}.`);
          }
          if (missingAirCount > 0) {
            warningParts.push(`${missingAirCount} region(s) missing air/UV data.`);
          }
          setPartialWarning(`${warningParts.join(" ")} Showing available results only.`);
        }
      } catch (error) {
        if (isCurrent) {
          setRecords([]);
          setErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadRecords();

    return () => {
      isCurrent = false;
    };
  }, [refreshCounter, selectedMonth, selectedRegions]);

  return {
    records,
    isLoading,
    errorMessage,
    partialWarning,
  };
}

