import type { MatrixViewModel } from "../../types/presentation";

/**
 * Converts a MatrixViewModel into a 2D array suitable for Papa.unparse().
 * Row 0 = header (Metric, col1-title, col2-title, ...)
 * Rows 1..N = one row per metric
 * Cells = "label · valueText" or "label" or "—" for missing
 */
export function toTableExportMatrix(viewModel: MatrixViewModel): string[][] {
  const { columns, rows } = viewModel;

  const header: string[] = [
    "Metric",
    ...columns.map((col) => `${col.title} · ${col.subtitle}`),
  ];

  const dataRows: string[][] = rows.map((row) => {
    const cells = columns.map((_col, colIndex) => {
      const cell = row.cells[colIndex];
      if (!cell || cell.severity === "missing") {
        return "—";
      }
      if (cell.valueText) {
        return `${cell.label} · ${cell.valueText}`;
      }
      return cell.label;
    });
    return [row.label, ...cells];
  });

  return [header, ...dataRows];
}
