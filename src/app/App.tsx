import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { countries, regions } from "../data/loadRegions";
import { ExportButtons } from "../features/export/ExportButtons";
import { FilterBar } from "../features/filters/FilterBar";
import { TopPicksPanel } from "../features/insights/TopPicksPanel";
import { buildTopPicks } from "../features/insights/buildTopPicks";
import { WeatherMap } from "../features/map/WeatherMap";
import { ClimateMatrix } from "../features/matrix/ClimateMatrix";
import { DEFAULT_PROFILE } from "../features/matrix/customProfile";
import { MatrixToolbar } from "../features/matrix/MatrixToolbar";
import { calculatePersonalScore } from "../features/matrix/presets";
import { ScoringGuideModal } from "../features/matrix/ScoringGuideModal";
import { fetchSeasonSummary } from "../services/season/seasonClient";
import { weatherProvider } from "../services/weather/provider";
import type { MatrixMode, UserPreferenceProfile } from "../types/presentation";
import type { SeasonSignalByMonth } from "../types/season";
import type { CountryCode, MetricKey, Month, Region, RegionMonthRecord } from "../types/weather";
import { formatRegionLabel } from "../utils/regionLabel";
import { buildAppUrlState, getDefaultPinnedRows, parseAppUrlState } from "../utils/urlState";
import "./App.css";

const THEME_STORAGE_KEY = "nomad-weather-theme";
const ACCESSIBILITY_STORAGE_KEY = "nomad-weather-accessibility";
const REGION_LOAD_CONCURRENCY = 3;
const REGION_RETRY_CONCURRENCY = 1;
const REGION_RATE_LIMIT_COOLDOWN_MS = 2600;
const REGION_REQUEST_TIMEOUT_MS = 35000;
type ThemeMode = "light" | "dark";

const defaultSelectedRegionIds = regions
  .filter((region) => region.countryCode === "VN")
  .slice(0, 3)
  .map((region) => region.id);

function trimSelectedRegionIds(
  selectedRegionIds: string[],
  availableRegionIds: string[],
  fallbackRegionIds: string[],
): string[] {
  const allowed = new Set(availableRegionIds);
  const kept = selectedRegionIds.filter((regionId) => allowed.has(regionId));

  if (kept.length > 0) {
    return kept;
  }

  return fallbackRegionIds.filter((regionId) => allowed.has(regionId));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong while loading weather data.";
}

function isRateLimitedMessage(message: string | null): boolean {
  return typeof message === "string" && message.includes("status 429");
}

function firstRejectedReason(results: Array<PromiseSettledResult<unknown>>): string | null {
  for (const result of results) {
    if (result.status === "rejected") {
      return getErrorMessage(result.reason);
    }
  }

  return null;
}

function getCurrentYear(): number {
  return new Date().getUTCFullYear();
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

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function getInitialAccessibilityMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ACCESSIBILITY_STORAGE_KEY) === "1";
}

function latestMetricUpdate(records: RegionMonthRecord[]): string {
  const timestamps = records.flatMap((record) =>
    Object.values(record.metrics)
      .map((metric) => metric.lastUpdated)
      .filter(Boolean),
  );

  if (timestamps.length === 0) {
    return "Unknown";
  }

  const latest = timestamps.reduce((acc, value) => (value > acc ? value : acc), timestamps[0]);
  return latest;
}

export default function App() {
  const initialUrl = useMemo(
    () => (typeof window === "undefined" ? {} : parseAppUrlState(window.location.search)),
    [],
  );

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const [colorBlindMode, setColorBlindMode] = useState<boolean>(() => getInitialAccessibilityMode());
  const [selectedCountryCodes, setSelectedCountryCodes] = useState<CountryCode[]>(
    () => initialUrl.selectedCountryCodes ?? [],
  );
  const [selectedMonth, setSelectedMonth] = useState<Month>(() => initialUrl.selectedMonth ?? 1);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>(
    () => initialUrl.selectedRegionIds ?? defaultSelectedRegionIds,
  );
  const [records, setRecords] = useState<RegionMonthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [partialWarning, setPartialWarning] = useState<string>("");
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [matrixMode, setMatrixMode] = useState<MatrixMode>(() => initialUrl.matrixMode ?? "monthCompare");
  const [profile, setProfile] = useState<UserPreferenceProfile>(() => initialUrl.profile ?? DEFAULT_PROFILE);
  const [timelineRegionId, setTimelineRegionId] = useState<string>(() => initialUrl.timelineRegionId ?? "");
  const [minScore, setMinScore] = useState<number>(() => initialUrl.minScore ?? 0);
  const [pinnedMetricKeys, setPinnedMetricKeys] = useState<MetricKey[]>(
    () => initialUrl.pinnedRows ?? getDefaultPinnedRows(),
  );
  const [focusedRegionId, setFocusedRegionId] = useState<string>("");
  const [isScoringGuideOpen, setIsScoringGuideOpen] = useState(false);

  const [timelineRecords, setTimelineRecords] = useState<RegionMonthRecord[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string>("");

  const [seasonByRegion, setSeasonByRegion] = useState<Record<string, SeasonSignalByMonth>>({});

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accessibility", colorBlindMode ? "colorblind" : "default");
    window.localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, colorBlindMode ? "1" : "0");
  }, [colorBlindMode]);

  const visibleRegions = useMemo(() => {
    if (selectedCountryCodes.length === 0) {
      return regions;
    }

    return regions.filter((region) => selectedCountryCodes.includes(region.countryCode));
  }, [selectedCountryCodes]);

  useEffect(() => {
    const nextAvailableIds = visibleRegions.map((region) => region.id);
    const fallbackIds = visibleRegions.slice(0, 3).map((region) => region.id);

    setSelectedRegionIds((previous) =>
      trimSelectedRegionIds(previous, nextAvailableIds, fallbackIds),
    );
  }, [visibleRegions]);

  const selectedRegions = useMemo(
    () => visibleRegions.filter((region) => selectedRegionIds.includes(region.id)),
    [selectedRegionIds, visibleRegions],
  );

  useEffect(() => {
    if (selectedRegions.length === 0) {
      setTimelineRegionId("");
      setFocusedRegionId("");
      return;
    }

    const stillSelected = selectedRegions.some((region) => region.id === timelineRegionId);
    if (!stillSelected) {
      setTimelineRegionId(selectedRegions[0].id);
    }

    const stillFocused = selectedRegions.some((region) => region.id === focusedRegionId);
    if (!stillFocused) {
      setFocusedRegionId(selectedRegions[0].id);
    }
  }, [selectedRegions, timelineRegionId, focusedRegionId]);

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
                includeMarine: profile.surfEnabled,
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
                  includeMarine: profile.surfEnabled,
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
                  includeMarine: profile.surfEnabled,
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
              "Open-Meteo rate limit reached (429). Wait about 1-2 minutes, then press Try again.",
            );
          } else {
            const reasonSuffix = finalFailureReason ? ` Last error: ${finalFailureReason}` : "";
            setErrorMessage(`All selected regions failed to load.${reasonSuffix}`);
          }
        } else if (finalFailedCount > 0 || missingAirCount > 0) {
          const warningParts: string[] = [];
          if (finalFailedCount > 0) {
            const previewSuffix = finalFailedPreview ? ` (${finalFailedPreview}${finalFailedCount > 3 ? ", ..." : ""})` : "";
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
  }, [selectedMonth, selectedRegions, profile.surfEnabled, refreshCounter]);

  useEffect(() => {
    let isCurrent = true;

    async function loadMonthSeasonSignals() {
      if (records.length === 0) {
        return;
      }

      const year = getCurrentYear();

      const seasonResults = await Promise.all(
        records.map(async (record) => {
          const personal = calculatePersonalScore(record, profile);
          const season = await fetchSeasonSummary({
            regionId: record.region.id,
            presetId: "custom-profile",
            year,
            month: record.month,
            weatherByMonth: {
              [record.month]: personal.score,
            },
          });

          return [record.region.id, season] as const;
        }),
      );

      if (isCurrent) {
        setSeasonByRegion((previous) => ({
          ...previous,
          ...Object.fromEntries(seasonResults),
        }));
      }
    }

    void loadMonthSeasonSignals();

    return () => {
      isCurrent = false;
    };
  }, [records, profile]);

  const timelineRegion: Region | null = useMemo(() => {
    if (!timelineRegionId) {
      return null;
    }

    return selectedRegions.find((region) => region.id === timelineRegionId) ?? null;
  }, [selectedRegions, timelineRegionId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadTimelineData() {
      if (matrixMode !== "timeline" || !timelineRegion) {
        if (isCurrent) {
          setTimelineRecords([]);
          setTimelineError("");
          setIsTimelineLoading(false);
        }
        return;
      }

      setIsTimelineLoading(true);
      setTimelineError("");

      try {
        const timeline = await weatherProvider.getRegionTimeline(timelineRegion, {
          includeMarine: profile.surfEnabled,
        });
        const weatherByMonth = timeline.reduce<Partial<Record<Month, number>>>((acc, record) => {
          const personal = calculatePersonalScore(record, profile);
          acc[record.month] = personal.score;
          return acc;
        }, {});

        const seasonSignals = await fetchSeasonSummary({
          regionId: timelineRegion.id,
          presetId: "custom-profile",
          year: getCurrentYear(),
          weatherByMonth,
        });

        if (isCurrent) {
          setTimelineRecords(timeline);
          setSeasonByRegion((previous) => ({
            ...previous,
            [timelineRegion.id]: {
              ...previous[timelineRegion.id],
              ...seasonSignals,
            },
          }));
        }
      } catch (error) {
        if (isCurrent) {
          setTimelineError(getErrorMessage(error));
        }
      } finally {
        if (isCurrent) {
          setIsTimelineLoading(false);
        }
      }
    }

    void loadTimelineData();

    return () => {
      isCurrent = false;
    };
  }, [matrixMode, timelineRegion, profile, refreshCounter]);

  const topPicks = useMemo(
    () => buildTopPicks({ records, profile, seasonByRegion, maxPicks: 3 }),
    [records, profile, seasonByRegion],
  );

  const lastUpdated = useMemo(() => latestMetricUpdate(records), [records]);

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

  function togglePinnedMetric(metric: MetricKey): void {
    setPinnedMetricKeys((previous) =>
      previous.includes(metric) ? previous.filter((item) => item !== metric) : [...previous, metric],
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-top">
          <h1>Nomad Weather Map</h1>
          <div className="hero-actions">
            <button
              type="button"
              className="theme-toggle-button"
              aria-pressed={themeMode === "dark"}
              onClick={() => {
                setThemeMode((previous) => (previous === "dark" ? "light" : "dark"));
              }}
            >
              {themeMode === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              type="button"
              className="theme-toggle-button"
              aria-pressed={colorBlindMode}
              onClick={() => setColorBlindMode((previous) => !previous)}
            >
              {colorBlindMode ? "Colorblind mode: On" : "Colorblind mode: Off"}
            </button>
          </div>
        </div>
        <p>
          Explore where weather is best by month. Compare regions with human-friendly labels, season
          signals, and export data for AI route planning.
        </p>
        <div className="hero-tags" aria-label="App workflow">
          <span className="hero-tag">1. Setup</span>
          <span className="hero-tag">2. Compare</span>
          <span className="hero-tag">3. Export</span>
        </div>
      </header>

      <section className="panel workflow-panel">
        <header className="panel-header">
          <h2>How To Use This Page</h2>
        </header>
        <ol className="workflow-list">
          <li>
            <strong>Setup:</strong> choose country, month, regions and your custom preference
            profile.
          </li>
          <li>
            <strong>Compare:</strong> choose mode/timeline region, then review top picks, matrix
            groups, confidence and warnings.
          </li>
          <li>
            <strong>Export:</strong> download shortlist, monthly plan, CSV or JSON.
          </li>
        </ol>
      </section>

      <section className="setup-grid">
        <FilterBar
          countries={countries}
          regions={visibleRegions}
          selectedCountryCodes={selectedCountryCodes}
          selectedMonth={selectedMonth}
          selectedRegionIds={selectedRegionIds}
          onCountryCodesChange={(nextCountries) => setSelectedCountryCodes(nextCountries)}
          onMonthChange={(nextMonth) => setSelectedMonth(nextMonth)}
          onRegionToggle={(regionId) => {
            setSelectedRegionIds((previous) =>
              previous.includes(regionId)
                ? previous.filter((id) => id !== regionId)
                : [...previous, regionId],
            );
          }}
          onSelectAllRegions={() => {
            setSelectedRegionIds(visibleRegions.map((region) => region.id));
          }}
          onClearRegions={() => setSelectedRegionIds([])}
        />

        <section className="panel setup-panel">
          <header className="panel-header">
            <h2>Preference Profile</h2>
            <p>These settings control personal ranking and matrix interpretation.</p>
          </header>

          <MatrixToolbar
            profile={profile}
            onProfileChange={setProfile}
            onOpenScoringGuide={() => setIsScoringGuideOpen(true)}
          />
        </section>
      </section>

      {isLoading ? <LoadingState /> : null}
      {errorMessage ? (
        <ErrorState
          message={errorMessage}
          onRetry={() => {
            weatherProvider.clearCache();
            setSeasonByRegion({});
            setRefreshCounter((n) => n + 1);
          }}
        />
      ) : null}
      {partialWarning ? <p className="hint-text warning-text">{partialWarning}</p> : null}

      <TopPicksPanel
        picks={topPicks}
        isLoading={isLoading}
        onPickFocus={(regionId) => setFocusedRegionId(regionId)}
      />

      <section className="panel comparison-panel">
        <header className="panel-header compare-header">
          <div className="compare-header-main">
            <h2>Step 2: Compare Regions</h2>
            <p>
              Data last updated: {lastUpdated}. Read top rows first (market, climate, personal), then
              inspect grouped metric rows.
            </p>
          </div>
          <div className="compare-mode-controls" aria-label="Compare mode controls">
            <label>
              <span>Mode</span>
              <select
                aria-label="Matrix mode"
                value={matrixMode}
                onChange={(event) => setMatrixMode(event.target.value as MatrixMode)}
              >
                <option value="monthCompare">Month Compare</option>
                <option value="timeline">Region Timeline</option>
              </select>
            </label>

            {matrixMode === "timeline" ? (
              <label>
                <span>Timeline region</span>
                <select
                  aria-label="Timeline region"
                  value={timelineRegionId}
                  onChange={(event) => setTimelineRegionId(event.target.value)}
                >
                  {selectedRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {formatRegionLabel(region)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </header>

        <ClimateMatrix
          mode={matrixMode}
          month={selectedMonth}
          monthRecords={records}
          timelineRecords={timelineRecords}
          seasonByRegion={seasonByRegion}
          profile={profile}
          isLoading={isLoading || isTimelineLoading}
          minScore={minScore}
          onMinScoreChange={setMinScore}
          pinnedMetricKeys={pinnedMetricKeys}
          onPinnedMetricToggle={togglePinnedMetric}
          focusedRegionId={focusedRegionId}
          onFocusRegion={setFocusedRegionId}
          colorBlindMode={colorBlindMode}
        />

        {timelineError ? <ErrorState message={timelineError} /> : null}
      </section>

      <section className="support-grid">
        <WeatherMap
          records={records}
          profile={profile}
          minScore={minScore}
          onMinScoreChange={setMinScore}
          focusedRegionId={focusedRegionId}
          onFocusRegion={setFocusedRegionId}
        />
        <section>
          <p className="hint-text step3-hint">
            Step 3: Export your current selection after checking top picks, matrix and map.
          </p>
          <ExportButtons
            records={records}
            timelineRecords={timelineRecords}
            regions={selectedRegions}
            month={selectedMonth}
            seasonByRegion={seasonByRegion}
            profile={profile}
          />
        </section>
      </section>

      <ScoringGuideModal open={isScoringGuideOpen} onClose={() => setIsScoringGuideOpen(false)} />
    </div>
  );
}
