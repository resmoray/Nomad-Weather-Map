import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { countries, regions } from "../data/loadRegions";
import { ExportButtons } from "../features/export/ExportButtons";
import { FilterBar } from "../features/filters/FilterBar";
import { TopPicksPanel } from "../features/insights/TopPicksPanel";
import { buildTopPicks } from "../features/insights/buildTopPicks";
import { ClimateMatrix } from "../features/matrix/ClimateMatrix";
import { DEFAULT_PROFILE } from "../features/matrix/customProfile";
import { MatrixToolbar } from "../features/matrix/MatrixToolbar";
import { calculatePersonalScore } from "../features/matrix/presets";
import { ScoringGuideModal } from "../features/matrix/ScoringGuideModal";
import { useAppUrlSync } from "./hooks/useAppUrlSync";
import { useRegionMonthRecords } from "./hooks/useRegionMonthRecords";
import { fetchSeasonSummary } from "../services/season/seasonClient";
import { weatherProvider } from "../services/weather/provider";
import type { MatrixMode, UserPreferenceProfile } from "../types/presentation";
import type { SeasonSignalByMonth } from "../types/season";
import type { CountryCode, MetricKey, Month, Region, RegionMonthRecord } from "../types/weather";
import { formatRegionLabel } from "../utils/regionLabel";
import { getDefaultPinnedRows, parseAppUrlState } from "../utils/urlState";
import "./App.css";

const THEME_STORAGE_KEY = "nomad-weather-theme";
const ACCESSIBILITY_STORAGE_KEY = "nomad-weather-accessibility";
type ThemeMode = "light" | "dark";

const WeatherMap = lazy(() =>
  import("../features/map/WeatherMap").then((module) => ({
    default: module.WeatherMap,
  })),
);

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

function getCurrentYear(): number {
  return new Date().getUTCFullYear();
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
  const comparisonSectionRef = useRef<HTMLElement | null>(null);
  const supportSectionRef = useRef<HTMLElement | null>(null);

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

  const { records, isLoading, errorMessage, partialWarning } = useRegionMonthRecords({
    selectedRegions,
    selectedMonth,
    refreshCounter,
  });

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
        setSeasonByRegion((previous) => {
          const merged: Record<string, SeasonSignalByMonth> = { ...previous };
          for (const [regionId, seasonSignals] of seasonResults) {
            merged[regionId] = {
              ...(previous[regionId] ?? {}),
              ...seasonSignals,
            };
          }
          return merged;
        });
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
          includeMarine: true,
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

  useAppUrlSync({
    selectedCountryCodes,
    selectedMonth,
    selectedRegionIds,
    matrixMode,
    timelineRegionId,
    profile,
    minScore,
    pinnedMetricKeys,
  });

  function togglePinnedMetric(metric: MetricKey): void {
    setPinnedMetricKeys((previous) =>
      previous.includes(metric) ? previous.filter((item) => item !== metric) : [...previous, metric],
    );
  }

  function navigateToRegionComparison(regionId: string): void {
    setMatrixMode("monthCompare");
    setFocusedRegionId(regionId);
    window.requestAnimationFrame(() => {
      comparisonSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function navigateToRegionMap(regionId: string): void {
    setFocusedRegionId(regionId);
    window.requestAnimationFrame(() => {
      supportSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <main id="main-content" className="app-shell">
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

      <section ref={comparisonSectionRef} className="panel comparison-panel">
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
          onNavigateToRegion={navigateToRegionMap}
          colorBlindMode={colorBlindMode}
        />

        {timelineError ? <ErrorState message={timelineError} /> : null}
      </section>

      <section ref={supportSectionRef} className="support-grid">
        <Suspense fallback={<LoadingState message="Loading map view..." />}>
          <WeatherMap
            records={records}
            profile={profile}
            seasonByRegion={seasonByRegion}
            minScore={minScore}
            onMinScoreChange={setMinScore}
            focusedRegionId={focusedRegionId}
            onFocusRegion={setFocusedRegionId}
            onNavigateToRegion={navigateToRegionComparison}
          />
        </Suspense>
        <section>
          <p className="hint-text step3-hint">
            Step 3: Export your current selection after checking top picks, matrix and map.
          </p>
          <ExportButtons
            records={records}
            regions={selectedRegions}
            month={selectedMonth}
            seasonByRegion={seasonByRegion}
            profile={profile}
            loadRegionTimeline={(region) =>
              weatherProvider.getRegionTimeline(region, {
                includeMarine: true,
              })
            }
          />
        </section>
      </section>

      <ScoringGuideModal open={isScoringGuideOpen} onClose={() => setIsScoringGuideOpen(false)} />
      </main>
    </>
  );
}
