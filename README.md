# Nomad Weather Map

Nomad Weather Map compares destinations by month using climate, air-quality, marine signals, and season context.

## Quick Start

Prerequisites:
- Node.js `>= 22`
- npm `>= 10`

Run:

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Runtime Modes

- `dynamic` (default): frontend + local backend (`server/index.ts`) with cached weather snapshots.
- `static`: frontend reads prebuilt files from `public/static-weather/v1` and makes no direct Open-Meteo calls in browser.

Set with:

```bash
VITE_RUNTIME_MODE=dynamic
VITE_RUNTIME_MODE=static
```

Both modes use a 5-year weather baseline by default.

## Key Paths

- Static manifest: `public/static-weather/v1/manifest.json`
- Static refresh state: `.github/static-refresh/state.json`
- Canonical static store: `.github/static-refresh/canonical.json`
- Backend snapshot cache: `.cache/weather-snapshot`
- Weather request cache: `.cache/weather-summary`

## Scripts

- `npm run dev`: backend + frontend
- `npm run dev:web`: frontend only
- `npm run server:dev`: backend only
- `npm run weather:snapshot:update -- --limit=200`: refresh backend snapshots
- `npm run static:refresh:batch`: refresh rolling static batch (cursor-based)
- `npm run static:export`: write static files + manifest to `public/static-weather/v1`
- `npm run static:validate`: validate static manifest/layout/content
- `npm run regions:bootstrap -- --missingOnly=1 --mode=verified_only`: fill missing canonical entries (manual/snapshot-first)
- `npm run regions:expand:plan -- --countries=VN,TH --maxPerCountry=8`: generate deterministic expansion plan
- `npm run nomad:tables:sync -- --mode=refresh_if_stale --limit=200`: sync SQLite tables
- `npm run nomad:tables:report`: show SQLite coverage
- `npm run nomad:manual:import -- --dir=data/manual-city-month`: import manual city files
- `npm run check`: lint + tests + build

## Static Refresh Model (180-Day Target)

Configured defaults:
- `TARGET_CYCLE_DAYS=180`
- `DAILY_CALL_BUDGET=3000`
- `RUNS_PER_DAY=1`
- `WEATHER_BASELINE_YEARS=5`
- `WEATHER_UPSTREAM_REQUEST_SPACING_MS=500`

Budget logic:
- `calls_per_region = baselineYears * 3` (climate + air + marine yearly series reuse across 12 months)
- `max_regions_per_day = floor(dailyBudget / calls_per_region)`
- `desired_regions_per_day = ceil(total_regions / targetCycleDays)`
- `effective_regions_per_day = min(desired_regions_per_day, max_regions_per_day)`

If dataset size grows above budget capacity, cycle length extends automatically.

## GitHub Automation

- `refresh-static-data.yml` (daily schedule): bootstrap missing entries, refresh batch, export, validate, create/update PR, enable auto-merge.
- `deploy-static-pages.yml` (on `main`): validate static data, build `VITE_RUNTIME_MODE=static`, deploy to GitHub Pages.

Safety behavior:
- failed checks => no merge, no deploy
- last successful Pages deployment remains live

## Initial Bootstrap (One-Time Recommended)

Before relying on scheduled refresh, seed all region-month entries once:

```bash
npm run regions:bootstrap -- --missingOnly=0 --mode=verified_only --allowStale=1 --export=1
npm run static:validate
```

This uses stored/manual sources first and avoids unnecessary upstream load.

## Environment Variables (Optional)

Copy `.env.example` to `.env` only when overriding defaults.

Important frontend vars:
- `VITE_RUNTIME_MODE`
- `VITE_STATIC_WEATHER_BASE_PATH`
- `VITE_WEATHER_BASELINE_YEARS`
- `VITE_WEATHER_SUMMARY_API_BASE_URL`
- `VITE_SEASON_API_BASE_URL`

Important backend/refresh vars:
- `WEATHER_BASELINE_YEARS`
- `WEATHER_UPSTREAM_REQUEST_SPACING_MS`
- `TARGET_CYCLE_DAYS`
- `DAILY_CALL_BUDGET`
- `RUNS_PER_DAY`
- `STATIC_LAYOUT_SHARD_THRESHOLD`
- `WEATHER_MANUAL_DATA_DIR`

## Project Structure

```text
src/
  app/          # app shell and page orchestration
  features/     # map, matrix, filters, export UI + logic
  services/     # weather + season clients, scoring logic
  data/         # regions and static catalogs
  types/        # shared TypeScript types
server/
  index.ts
  seasonService.ts
  weatherSummaryService.ts
scripts/
  refreshStaticWeatherBatch.ts
  exportStaticWeatherData.ts
  validateStaticWeatherData.ts
  bootstrapRegions.ts
  planRegionExpansion.ts
  updateWeatherSnapshot.ts
```

## CI

`ci.yml` runs lint, tests, and build on push + pull request.

## License

MIT. See [`LICENSE`](./LICENSE).
