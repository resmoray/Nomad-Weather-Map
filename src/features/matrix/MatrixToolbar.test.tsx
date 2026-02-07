import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Region } from "../../types/weather";
import { MatrixToolbar } from "./MatrixToolbar";

const regions: Region[] = [
  {
    id: "vn-da-nang",
    countryCode: "VN",
    countryName: "Vietnam",
    regionName: "Central",
    cityName: "Da Nang",
    lat: 16.0544,
    lon: 108.2022,
    cityIata: "DAD",
    destinationIata: "DAD",
    isCoastal: true,
  },
];

describe("MatrixToolbar", () => {
  it("renders comfort and trip selectors and triggers callbacks", () => {
    const onComfortProfileChange = vi.fn();
    const onTripTypeChange = vi.fn();

    render(
      <MatrixToolbar
        matrixMode="monthCompare"
        onMatrixModeChange={vi.fn()}
        comfortProfileId="perfectTemp"
        onComfortProfileChange={onComfortProfileChange}
        tripTypeId="cityTrip"
        onTripTypeChange={onTripTypeChange}
        timelineRegionId="vn-da-nang"
        timelineRegions={regions}
        onTimelineRegionChange={vi.fn()}
      />, 
    );

    fireEvent.change(screen.getByLabelText("Comfort profile"), {
      target: { value: "warmTraveler" },
    });
    fireEvent.change(screen.getByLabelText("Trip type"), {
      target: { value: "surfVacation" },
    });

    expect(onComfortProfileChange).toHaveBeenCalledWith("warmTraveler");
    expect(onTripTypeChange).toHaveBeenCalledWith("surfVacation");
  });
});
