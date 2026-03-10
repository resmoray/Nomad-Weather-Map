# Design: Table CSV Export

**Date:** 2026-03-10
**Status:** Approved

## Problem

The existing CSV export contains ~100 columns per row — designed for LLM/raw-data use.
It is unreadable by humans and unusable in Excel or Google Sheets directly.

## Solution

Add a second export option ("Table CSV") that exports exactly what is currently visible
in the app's ClimateMatrix — same rows, same columns, same labels and values.
Keep the existing export as "Raw Data CSV".

## UI

Replace the existing `[↓ CSV]` button with a dropdown split-button:

```
[↓ Export ▾]
  ├── Table CSV       ← new
  └── Raw Data CSV    ← existing, unchanged
```

Filename is auto-generated from context:
- monthCompare mode → `nomad-table-march-2026.csv`
- timeline mode     → `nomad-table-danang-2026.csv`

## Table CSV Format

The CSV mirrors the matrix exactly. Rows = metrics, columns = cities (or months).

**monthCompare mode** (multiple cities, one month):

| Metric | Da Nang · VN · Mar | Chiang Mai · TH · Mar |
|---|---|---|
| Personal Score | Excellent · 84 | Good · 71 |
| Market Season | High | Shoulder |
| Climate Season | Shoulder | High |
| Temp (°C) | Comfortable · 22/27/33 | Warm · 20/29/36 |
| Rain (mm) | Light rain · 45 | Not rainy · 18 |
| Humidity (%) | Humid · 82 | Comfy · 62 |
| Wind (kph) | Calm · 14 | Breezy · 18 |
| UV Index | Very high · 11 | High · 9 |
| PM2.5 | Clean · 8 | Moderate · 22 |
| AQI | Good · 32 | Moderate · 71 |
| Wave Height (m) | Rideable · 1.2 | — |
| Wave Period (s) | Fair · 9 | — |

**timeline mode** (one city, all months): same structure, columns = Jan/Feb/.../Dec.

Cell values follow the pattern: `{label} · {valueText}` or just `{label}` when no value.
Missing data → `—`.

## Files Changed

| File | Change |
|---|---|
| `src/features/export/toTableExportMatrix.ts` | New — builds CSV matrix from `MatrixViewModel` |
| `src/features/export/exportCsv.ts` | Add `exportTableCsv(viewModel, mode)` function |
| `src/features/export/ExportButton.tsx` | Replace single button with dropdown |
| `src/features/export/index.ts` | Re-export new function |

`toLLMExportRecord.ts` and all existing raw export logic remain **untouched**.

## Data Flow

```
MatrixViewModel (already computed, displayed in app)
  └── toTableExportMatrix(viewModel)
        └── rows: MatrixRowViewModel[]  → CSV rows
        └── columns: MatrixColumnViewModel[] → CSV columns
              └── cells: MatrixCellViewModel → "{label} · {valueText}"
  └── Papa.unparse(matrix)
  └── downloadFile(csv, filename)
```

No new API calls. No new data fetching. Pure transformation of existing view state.

## Constraints

- No changes to existing raw CSV export
- No new API calls or data sources
- Works in both monthCompare and timeline matrix modes
- Filename reflects current view context
