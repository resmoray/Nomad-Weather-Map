# Nomad Weather Map

Nomad Weather Map helps you compare destinations by month using weather metrics, fixed season context, and custom plain-language preference scoring.

It is designed to run immediately after clone with no API keys and no manual config.

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

`npm run dev` starts:
- frontend (Vite) on `5173`
- local season backend on `8787`

## Zero-Config Behavior

- Weather data uses keyless Open-Meteo APIs by default.
- Backend weather summaries are cached on disk (`.cache/weather-summary`) to reduce repeat upstream requests.
- Verified region/month snapshots are stored in `.cache/weather-snapshot` and used first by the API.
- Season signals fall back to fixed profiles when backend/live sources are unavailable.
- Amadeus live mode is optional and off by default.

You only need a `.env` file if you want to override defaults.

## Scripts

- `npm run dev`: run backend + frontend together (recommended)
- `npm run dev:web`: run frontend only
- `npm run server:dev`: run backend only
- `npm run weather:snapshot:update -- --limit=200`: refresh stale/ missing stored weather rows
- `npm run nomad:tables:sync -- --mode=refresh_if_stale --limit=200`: validate + store city/month raw and derived table rows
- `npm run nomad:tables:report`: show table counts and monthly coverage from local SQLite store
- `npm run nomad:manual:import -- --dir=data/manual-city-month`: import manually researched city files into SQLite
- `npm run lint`: lint source
- `npm run test:run`: run tests once
- `npm run build`: typecheck + production build
- `npm run check`: lint + tests + build
- `npm run security:secrets`: scan workspace files for common leaked-secret patterns
- `npm run preview`: preview production build

## Verified Snapshot Workflow

- API default mode is `verified_only`: no live weather pull per page load.
- Per city a stored month table is used (`12` months per region).
- Background auto-update runs in small batches on the backend (default every 6h).
- Use the update script to fill or refresh snapshots:

```bash
npm run weather:snapshot:update -- --limit=200
```

```bash
npm run weather:snapshot:update -- --force=1 --regionIds=vn-da-nang,th-bangkok
```

```bash
npm run weather:snapshot:update -- --offset=400 --limit=200 --pauseMs=600
```

- Recommended cadence:
1. Run update weekly (safe default).
2. Air data naturally refreshes every ~90 days (quarterly freshness window).
3. Climate/marine refresh every ~365 days (yearly freshness window).
4. For first full bootstrap (193 x 12), run in batches with `offset` + `limit`:

```bash
npm run weather:snapshot:update -- --offset=0 --limit=200 --pauseMs=600 --allowStale=1
npm run weather:snapshot:update -- --offset=200 --limit=200 --pauseMs=600 --allowStale=1
```

If you still hit `429`, wait 10-20 minutes and continue with the next offset batch.
Use `--all=1` only if you intentionally want one long full-catalog run.

## Nomad Tables Workflow

- Local SQLite database path defaults to `.cache/nomad-hub/nomad-data.sqlite`.
- Tables are:
1. `city` (fixed city metadata)
2. `city_month_raw` (validated stored weather/air/marine raw values)
3. `city_month_derived` (deterministic computed scores and flags)

Populate tables:

```bash
npm run nomad:tables:sync -- --mode=refresh_if_stale --allowStale=1 --pauseMs=250
```

```bash
npm run nomad:tables:sync -- --mode=refresh_if_stale --offset=400 --limit=200 --pauseMs=600
```

Snapshot-only ingest (no live pull):

```bash
npm run nomad:tables:sync -- --mode=verified_only
```

Report coverage:

```bash
npm run nomad:tables:report
```

Notes:
- `uv_index_max`, `wave_height_min_m`, `wave_height_max_m`, and `water_temp_c` are currently stored as `null` until dedicated upstream series are added.
- This avoids fake precision while keeping table schema stable for phase-2 expansion.

## Manual Data Fallback (No API)

If Open-Meteo is rate-limiting your network, you can still progress by manually researched files:

1. Add files to `data/manual-city-month` using `<region_id>.<year>.json`.
2. Use `data/manual-city-month/vn-da-nang.2025.json` as the reference format.
3. Import:

```bash
npm run nomad:manual:import -- --dir=data/manual-city-month
```

4. Optional: auto-fill/correct climate core fields from Meteostat (3-year average):

```bash
python3 -m venv .venv-meteostat
.venv-meteostat/bin/pip install meteostat pandas
```

```bash
npm run nomad:manual:fill-climate
```

## Environment Variables (Optional)

Copy `.env.example` to `.env` only if you need overrides.

Frontend:
- `VITE_OPEN_METEO_CLIMATE_BASE_URL`
- `VITE_OPEN_METEO_AIR_BASE_URL`
- `VITE_WEATHER_BASELINE_YEARS`
- `VITE_WEATHER_SUMMARY_API_BASE_URL`
- `VITE_SEASON_API_BASE_URL`

Note:
- By default the app uses Open-Meteo historical endpoints (`historical-forecast` + `archive`) for monthly climate aggregation.
- Default baseline is 3 full past years for more stable monthly climatology.
- Set `VITE_OPEN_METEO_CLIMATE_BASE_URL` only if you explicitly want the climate endpoint.
- If Open-Meteo keeps throttling (`429`), the backend first serves manual JSON data from `data/manual-city-month` (if available), then stale snapshots (if available), and otherwise returns an error.

Backend:
- `SEASON_SERVER_PORT`
- `WEATHER_BASELINE_YEARS`
- `WEATHER_SUMMARY_TIMEOUT_MS`
- `WEATHER_SUMMARY_ATTEMPTS`
- `WEATHER_SUMMARY_RETRY_BASE_DELAY_MS`
- `WEATHER_UPSTREAM_REQUEST_SPACING_MS`
- `WEATHER_RATE_LIMIT_MIN_BACKOFF_MS`
- `WEATHER_YEAR_CACHE_MAX_ENTRIES`
- `WEATHER_SNAPSHOT_CLIMATE_MAX_AGE_DAYS`
- `WEATHER_SNAPSHOT_AIR_MAX_AGE_DAYS`
- `WEATHER_SNAPSHOT_MARINE_MAX_AGE_DAYS`
- `WEATHER_SNAPSHOT_AUTO_UPDATE_ENABLED`
- `WEATHER_SNAPSHOT_AUTO_INTERVAL_MINUTES`
- `WEATHER_SNAPSHOT_AUTO_BATCH_SIZE`
- `WEATHER_MANUAL_DATA_DIR`
- `NOMAD_DATA_DB_PATH`
- `SEASON_ENABLE_LIVE_AMADEUS`
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`
- `AMADEUS_BASE_URL`

## Project Structure

```text
src/
  app/          # top-level app shell and page orchestration
  features/     # map, matrix, filters, export UI + logic
  services/     # weather + season clients, scoring logic
  data/         # regions and static catalogs
  types/        # shared TypeScript domain types
server/
  index.ts      # lightweight season API server
  seasonService.ts
  nomadDataStore.ts # schema + validation + derived score logic for nomad tables
scripts/
  launch-dev.sh # macOS-friendly launcher wrapper
  stop-dev.sh
  updateWeatherSnapshot.ts # bulk refresh for verified weather snapshots
  syncNomadTables.ts # persist validated city/month raw + derived rows into SQLite
  reportNomadTables.ts # show SQLite table coverage summary
```

## macOS Launcher (Optional)

See `/docs/launcher.md` for a one-click local launcher app flow.

## CI

GitHub Actions runs lint, tests, and build on every push and pull request.

## License

MIT. See [`LICENSE`](./LICENSE).
