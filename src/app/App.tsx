import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { countries, regions } from "../data/loadRegions";
import { ExportButtons } from "../features/export/ExportButtons";
import { FilterBar } from "../features/filters/FilterBar";
import { ClimateMatrix } from "../features/matrix/ClimateMatrix";
import { MatrixToolbar } from "../features/matrix/MatrixToolbar";
import { calculatePersonalScore } from "../features/matrix/presets";
import { WeatherMap } from "../features/map/WeatherMap";
import { fetchSeasonSummary } from "../services/season/seasonClient";
import { weatherProvider } from "../services/weather/provider";
import type { ComfortProfileId, MatrixMode, TripTypeId } from "../types/presentation";
import type { SeasonSignalByMonth } from "../types/season";
import type { CountryCode, Month, Region, RegionMonthRecord } from "../types/weather";
import { MONTH_LABELS } from "../utils/months";
import "./App.css";

type CountryFilter = CountryCode | "ALL";
const DEFAULT_SEASON_API_BASE_URL = "http://localhost:8787";
const THEME_STORAGE_KEY = "nomad-weather-theme";
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

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const [selectedCountry, setSelectedCountry] = useState<CountryFilter>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<Month>(1);
  const [selectedRegionIds, setSelectedRegionIds] = useState<string[]>(defaultSelectedRegionIds);
  const [records, setRecords] = useState<RegionMonthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [refreshCounter, setRefreshCounter] = useState(0);

  const [matrixMode, setMatrixMode] = useState<MatrixMode>("monthCompare");
  const [comfortProfileId, setComfortProfileId] = useState<ComfortProfileId>("perfectTemp");
  const [tripTypeId, setTripTypeId] = useState<TripTypeId>("cityTrip");
  const [timelineRegionId, setTimelineRegionId] = useState<string>("");

  const [timelineRecords, setTimelineRecords] = useState<RegionMonthRecord[]>([]);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string>("");

  const [seasonByRegion, setSeasonByRegion] = useState<Record<string, SeasonSignalByMonth>>({});
  const [isStoppingApp, setIsStoppingApp] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  async function handleStopApp(): Promise<void> {
    const confirmed = window.confirm(
      "App wirklich beenden? Das stoppt Frontend + Backend und versucht den Browser-Tab zu schließen.",
    );
    if (!confirmed) {
      return;
    }

    setIsStoppingApp(true);
    const baseUrl = import.meta.env.VITE_SEASON_API_BASE_URL ?? DEFAULT_SEASON_API_BASE_URL;

    try {
      await fetch(`${baseUrl}/api/dev/stop`, {
        method: "POST",
      });
    } catch {
      // Ignore network errors here, process stop may already be in progress.
    }

    setTimeout(() => {
      window.open("", "_self");
      window.close();
      window.location.href = "about:blank";
    }, 350);
  }

  const visibleRegions = useMemo(() => {
    if (selectedCountry === "ALL") {
      return regions;
    }

    return regions.filter((region) => region.countryCode === selectedCountry);
  }, [selectedCountry]);

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

  const selectedCountryLabel = useMemo(() => {
    if (selectedCountry === "ALL") {
      return "All countries";
    }

    const match = countries.find((country) => country.code === selectedCountry);
    return match?.name ?? selectedCountry;
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedRegions.length === 0) {
      setTimelineRegionId("");
      return;
    }

    const stillSelected = selectedRegions.some((region) => region.id === timelineRegionId);
    if (!stillSelected) {
      setTimelineRegionId(selectedRegions[0].id);
    }
  }, [selectedRegions, timelineRegionId]);

  useEffect(() => {
    let isCurrent = true;

    async function loadRecords() {
      if (selectedRegions.length === 0) {
        if (isCurrent) {
          setRecords([]);
          setErrorMessage("");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextRecords = await Promise.all(
          selectedRegions.map((region) => weatherProvider.getRegionMonthRecord(region, selectedMonth)),
        );

        if (isCurrent) {
          setRecords(nextRecords);
        }
      } catch (error) {
        if (isCurrent) {
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
  }, [selectedMonth, selectedRegions, refreshCounter]);

  useEffect(() => {
    let isCurrent = true;

    async function loadMonthSeasonSignals() {
      if (records.length === 0) {
        return;
      }

      const year = getCurrentYear();

      const seasonResults = await Promise.all(
        records.map(async (record) => {
          const personal = calculatePersonalScore(record, comfortProfileId, tripTypeId);
          const season = await fetchSeasonSummary({
            regionId: record.region.id,
            presetId: `${comfortProfileId}:${tripTypeId}`,
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
  }, [records, comfortProfileId, tripTypeId]);

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
        const timeline = await weatherProvider.getRegionTimeline(timelineRegion);

        const weatherByMonth = timeline.reduce<Partial<Record<Month, number>>>((acc, record) => {
          const personal = calculatePersonalScore(record, comfortProfileId, tripTypeId);
          acc[record.month] = personal.score;
          return acc;
        }, {});

        const seasonSignals = await fetchSeasonSummary({
          regionId: timelineRegion.id,
          presetId: `${comfortProfileId}:${tripTypeId}`,
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
  }, [matrixMode, timelineRegion, comfortProfileId, tripTypeId, refreshCounter]);

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
              className="stop-app-button"
              onClick={() => {
                void handleStopApp();
              }}
              disabled={isStoppingApp}
            >
              {isStoppingApp ? "Stopping..." : "App beenden"}
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
            <strong>Setup:</strong> choose country, month, regions, mode, comfort profile and trip
            type.
          </li>
          <li>
            <strong>Compare:</strong> read fixed market/climate seasons first, then live weather rows.
          </li>
          <li>
            <strong>Export:</strong> download CSV or JSON when the selection looks good.
          </li>
        </ol>
      </section>

      <section className="setup-grid">
        <FilterBar
          countries={countries}
          regions={visibleRegions}
          selectedCountry={selectedCountry}
          selectedMonth={selectedMonth}
          selectedRegionIds={selectedRegionIds}
          onCountryChange={(nextCountry) => setSelectedCountry(nextCountry)}
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
            <h2>Trip Profile</h2>
            <p>These settings control personal ranking and matrix interpretation.</p>
          </header>

          <MatrixToolbar
            matrixMode={matrixMode}
            onMatrixModeChange={setMatrixMode}
            comfortProfileId={comfortProfileId}
            onComfortProfileChange={setComfortProfileId}
            tripTypeId={tripTypeId}
            onTripTypeChange={setTripTypeId}
            timelineRegionId={timelineRegionId}
            timelineRegions={selectedRegions}
            onTimelineRegionChange={setTimelineRegionId}
          />

          <div className="setup-stats" aria-label="Current selection summary">
            <div className="setup-stat">
              <span>Country</span>
              <strong>{selectedCountryLabel}</strong>
            </div>
            <div className="setup-stat">
              <span>Month</span>
              <strong>{MONTH_LABELS[selectedMonth]}</strong>
            </div>
            <div className="setup-stat">
              <span>Selected regions</span>
              <strong>{selectedRegions.length}</strong>
            </div>
          </div>
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

      <section className="panel comparison-panel">
        <header className="panel-header">
          <h2>Step 2: Compare Regions</h2>
          <p>
            Read top rows first: Market season (demand/price) and Climate season (comfort). Personal
            combines your comfort profile and trip type. Metric rows stay live from APIs.
          </p>
        </header>

        <ClimateMatrix
          mode={matrixMode}
          month={selectedMonth}
          monthRecords={records}
          timelineRecords={timelineRecords}
          seasonByRegion={seasonByRegion}
          comfortProfileId={comfortProfileId}
          tripTypeId={tripTypeId}
          isLoading={isLoading || isTimelineLoading}
        />

        {timelineError ? <ErrorState message={timelineError} /> : null}
      </section>

      <section className="support-grid">
        <WeatherMap records={records} />
        <section>
          <p className="hint-text step3-hint">
            Step 3: Export your current selection after checking matrix + map.
          </p>
          <ExportButtons records={records} month={selectedMonth} seasonByRegion={seasonByRegion} />
        </section>
      </section>

      <button
        type="button"
        className="stop-app-fab"
        onClick={() => {
          void handleStopApp();
        }}
        disabled={isStoppingApp}
      >
        {isStoppingApp ? "Stopping..." : "App beenden"}
      </button>
    </div>
  );
}
