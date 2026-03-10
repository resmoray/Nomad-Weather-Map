import { describe, expect, it } from "vitest";
import type { MatrixViewModel } from "../../types/presentation";
import { toTableExportMatrix } from "./toTableExportMatrix";

const mockViewModel: MatrixViewModel = {
  columns: [
    { key: "col1", title: "Da Nang", subtitle: "VN · Central · Mar", month: 3, regionId: "vn-da-nang", personalScore: 84 },
    { key: "col2", title: "Chiang Mai", subtitle: "TH · North · Mar", month: 3, regionId: "th-chiang-mai", personalScore: 71 },
  ],
  rows: [
    {
      key: "personal",
      label: "Personal Score",
      group: "seasons",
      cells: [
        { key: "c1", label: "Excellent", valueText: "", severity: "excellent", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "", confidenceText: "high confidence" },
        { key: "c2", label: "Good", valueText: "", severity: "good", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
      ],
    },
    {
      key: "temperatureC",
      label: "Temp (°C)",
      group: "comfort",
      cells: [
        { key: "c3", label: "Comfortable", valueText: "22 / 27 / 33", severity: "excellent", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
        { key: "c4", label: "Warm", valueText: "20 / 29 / 36", severity: "good", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
      ],
    },
  ],
};

describe("toTableExportMatrix", () => {
  it("returns header row + one row per metric", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix).toHaveLength(3); // 1 header + 2 rows
  });

  it("header row starts with 'Metric' then column titles with subtitles", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[0]).toEqual(["Metric", "Da Nang · VN · Central · Mar", "Chiang Mai · TH · North · Mar"]);
  });

  it("metric row starts with row label", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[1][0]).toBe("Personal Score");
    expect(matrix[2][0]).toBe("Temp (°C)");
  });

  it("formats cell as 'label · valueText' when valueText is present", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[2][1]).toBe("Comfortable · 22 / 27 / 33");
  });

  it("formats cell as just label when no valueText", () => {
    const matrix = toTableExportMatrix(mockViewModel);
    expect(matrix[1][1]).toBe("Excellent");
  });

  it("returns — for missing severity", () => {
    const vm: MatrixViewModel = {
      ...mockViewModel,
      rows: [
        {
          key: "temperatureC",
          label: "Temp (°C)",
          group: "comfort",
          cells: [
            { key: "c1", label: "—", valueText: "", severity: "missing", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
            { key: "c2", label: "Warm", valueText: "25", severity: "good", icon: "", reason: "", sourceName: "", sourceUrl: "", lastUpdated: "" },
          ],
        },
      ],
    };
    const matrix = toTableExportMatrix(vm);
    expect(matrix[1][1]).toBe("—");
  });
});
