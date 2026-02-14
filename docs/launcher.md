# Nomad Weather Dev Launcher (macOS)

This launcher starts both required services with one click:
- Combined dev command: `npm run dev`
- Backend API on `8787`
- Frontend on `5173`

It keeps normal development fully intact.

## 1) Daily usage (Terminal shortcut)

Run from project root:

```bash
./launch-dev.command
```

Alternative (shell scripts directly):

```bash
./scripts/launch-dev.sh
```

To stop:

```bash
./stop-dev.command
```

Alternative:

```bash
./scripts/stop-dev.sh
```

Portable Finder launchers (recommended if you move the repo):

```bash
./launch-dev.command
./stop-dev.command
```

These files always resolve the current repo location and avoid hard-coded `cd "/old/path"` commands.

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

## Notes

- If ports are already in use, stop old processes first (`./scripts/stop-dev.sh`).
- On first run, `launch-dev.sh` installs dependencies automatically.
- If the launcher app is moved outside the repo, it will ask you once to select the project folder.
- If you changed the repo folder and still see `cd: no such file or directory`, remove the old hard-coded Terminal command and run `./launch-dev.command` from the new repo path.
- The launcher is for development convenience; build/release flow stays unchanged.
