# Nomad Weather Dev Launcher (macOS)

This launcher starts both required services with one click:
- Backend: `npm run server:dev` (port `8787`)
- Frontend: `npm run dev` (port `5173`)

It keeps normal development fully intact.

## 1) Daily usage (Terminal shortcut)

Run from project root:

```bash
./scripts/launch-dev.sh
```

To stop:

```bash
./scripts/stop-dev.sh
```

## 2) Build the `.app`

From project root:

```bash
osacompile -o "/tmp/Nomad Weather Dev.app" "scripts/macos/NomadWeatherDev.applescript"
```

Test by double-clicking:

```bash
open "/tmp/Nomad Weather Dev.app"
```

## 3) Install to Applications

```bash
cp -R "/tmp/Nomad Weather Dev.app" "/Applications/"
```

Then launch via Spotlight: `Nomad Weather Dev`.

## In-App Stop Button

Inside the app header there is an **App beenden** button.
It sends a local stop command to `POST /api/dev/stop`, stops backend + frontend,
and then attempts to close the current browser tab/window.

When started via the `.app`, Terminal is set to auto-close after services stop.

## Notes

- If ports are already in use, stop old processes first (`./scripts/stop-dev.sh`).
- If dependencies are missing, run `npm install`.
- The launcher is for development convenience; build/release flow stays unchanged.
