import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MatrixCellViewModel } from "../../types/presentation";
import { MatrixDetailPanel } from "./MatrixDetailPanel";

const marketCell: MatrixCellViewModel = {
  key: "market-vn-hanoi-1",
  label: "Market high season",
  valueText: "Weather 78 • Price 75 • Crowd 80",
  severity: "bad",
  icon: "arrow-up",
  reason: "Good weather, high demand, higher prices",
  sourceName: "Season service",
  sourceUrl: "https://example.com",
  lastUpdated: "2026-01-01T00:00:00.000Z",
  confidenceText: "high confidence (live)",
  marketConfidenceSource: "live",
  isPriceFallback: false,
  isCrowdFallback: false,
  seasonSources: [
    {
      name: "Amadeus",
      url: "https://developers.amadeus.com",
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("MatrixDetailPanel", () => {
  it("renders structured explanation blocks for a market season cell", () => {
    render(
      <MatrixDetailPanel
        rowLabel="Market season"
        columnLabel="Vietnam, North - Hanoi"
        cell={marketCell}
      />,
    );

    expect(screen.getByText("Meaning")).toBeInTheDocument();
    expect(screen.getByText("Why this label")).toBeInTheDocument();
    expect(screen.getByText("Confidence")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText(/not automatically more comfortable/i)).toBeInTheDocument();
    expect(screen.getByText(/Market signal source quality: live/i)).toBeInTheDocument();
  });
});
