# GitHub Repo Setup (Minimal)

Diese Einstellungen reichen, damit der neue Static-Refresh-Flow vollautomatisch läuft:

## 1) Actions-Berechtigungen

Pfad:
- `Settings` -> `Actions` -> `General`

Setzen:
- `Actions permissions`: `Allow all actions and reusable workflows`
- `Workflow permissions`: `Read and write permissions`
- `Allow GitHub Actions to create and approve pull requests`: `Enabled`

## 2) Auto-Merge aktivieren

Pfad:
- `Settings` -> `General` -> `Pull Requests`

Setzen:
- `Allow auto-merge`: `Enabled`
- `Automatically delete head branches`: `Enabled` (empfohlen)

## 3) Branch Protection für `main`

Pfad:
- `Settings` -> `Branches` -> `Add branch protection rule`

Rule:
- `Branch name pattern`: `main`
- `Require a pull request before merging`: `Enabled`
- `Require status checks to pass before merging`: `Enabled`
- Required checks:
  - `CI / quality` (nach erstem PR-Lauf sichtbar)
- `Do not allow bypassing the above settings`: `Enabled`

Hinweis:
- Keine Pflicht-Review aktivieren, wenn Auto-PR sofort ohne manuelles Review gemerged werden soll.

## 4) GitHub Pages

Pfad:
- `Settings` -> `Pages`

Setzen:
- `Source`: `GitHub Actions`

## 5) Benachrichtigungen bei Action-Fehlern

Pfad:
- Repo `Watch` -> `Custom`

Setzen:
- `Actions`: `Enabled`

Damit kommen Fail-Mails bei Workflow-Fehlern.

## 6) Schnellcheck nach Setup

1. Warten bis der tägliche Workflow `Refresh Static Weather Data` läuft (oder manuell via `Run workflow`).
2. Prüfen, dass ein PR erstellt wird.
3. Prüfen, dass der PR nach grünem `CI / quality` automatisch merged.
4. Prüfen, dass `Deploy Static App` danach auf `main` läuft und Pages aktualisiert.
