# Nomad Weather Map

Nomad Weather Map helps you compare destinations by month using weather metrics, fixed season context, and persona-based scoring.

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
- Season signals fall back to fixed profiles when backend/live sources are unavailable.
- Amadeus live mode is optional and off by default.

You only need a `.env` file if you want to override defaults.

## Scripts

- `npm run dev`: run backend + frontend together (recommended)
- `npm run dev:web`: run frontend only
- `npm run server:dev`: run backend only
- `npm run lint`: lint source
- `npm run test:run`: run tests once
- `npm run build`: typecheck + production build
- `npm run check`: lint + tests + build
- `npm run preview`: preview production build

## Environment Variables (Optional)

Copy `.env.example` to `.env` only if you need overrides.

Frontend:
- `VITE_OPEN_METEO_CLIMATE_BASE_URL`
- `VITE_OPEN_METEO_AIR_BASE_URL`
- `VITE_WEATHER_BASELINE_YEARS`
- `VITE_SEASON_API_BASE_URL`

Backend:
- `SEASON_SERVER_PORT`
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
scripts/
  launch-dev.sh # macOS-friendly launcher wrapper
  stop-dev.sh
```

## macOS Launcher (Optional)

See `/docs/launcher.md` for a one-click local launcher app flow.

## CI

GitHub Actions runs lint, tests, and build on every push and pull request.

## License

MIT. See [`LICENSE`](./LICENSE).
