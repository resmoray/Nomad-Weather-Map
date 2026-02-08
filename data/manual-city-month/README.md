# Manual City-Month Files

Use one file per city and year:

- file name format: `<region_id>.<year>.json`
- schema version: `nomad-city-month-v1`

Example:

- `vn-da-nang.2025.json`

Import into SQLite tables:

```bash
npm run nomad:manual:import -- --dir=data/manual-city-month
```

Notes:

- Keep every month entry (`1` to `12`) in each file.
- Unknown values should be `null` (do not guess).
- `sources` must point to where the value came from.
- Derived fields can stay `null`; they are computed on import from the raw metrics.
