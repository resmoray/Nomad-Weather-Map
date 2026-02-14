# Static Refresh Runbook

## Purpose

Operate the static weather dataset pipeline (`public/static-weather/v1`) with minimal manual work.

## Regular Automation

- Daily workflow: `.github/workflows/refresh-static-data.yml`
- Deploy workflow: `.github/workflows/deploy-static-pages.yml`

The refresh workflow updates data via PR and enables auto-merge when checks pass.

## Local Commands

```bash
npm run static:refresh:batch
npm run static:export
npm run static:validate
```

One-time full seed:

```bash
npm run regions:bootstrap -- --missingOnly=0 --mode=verified_only --allowStale=1 --export=1
```

## State and Data Files

- Cursor/state: `.github/static-refresh/state.json`
- Canonical source: `.github/static-refresh/canonical.json`
- Validation report: `.github/static-refresh/validation-report.json`
- Public static output: `public/static-weather/v1`

## Common Failures

1. `missingEntries > 0` in export
- Run full bootstrap once (`missingOnly=0`) to seed all region-month entries.

2. Validate errors for missing files
- Re-run export and validate.
- If still failing, inspect `validation-report.json`.

3. Upstream rate-limit/transient errors
- Batch refresh already uses stale/manual fallback.
- Keep schedule running; next cycle will continue from cursor.

## Rollback

1. Revert the latest refresh PR in GitHub.
2. Merge revert PR.
3. Pages deploy workflow will publish the previous stable static build.
