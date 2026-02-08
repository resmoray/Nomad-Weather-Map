import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UserPreferenceProfile } from "../../types/presentation";
import { MatrixToolbar } from "./MatrixToolbar";

describe("MatrixToolbar", () => {
  it("renders custom profile controls and triggers profile updates", () => {
    const onProfileChange = vi.fn();
    const profile: UserPreferenceProfile = {
      tempPreference: "mild",
      humidityPreference: "balanced",
      rainTolerance: "okayRain",
      airSensitivity: "normal",
      uvSensitivity: "normal",
      surfEnabled: false,
      dealbreakers: {
        avoidHeavyRain: false,
        avoidUnhealthyAir: false,
        avoidVeryHighUv: false,
        avoidStrongWind: false,
        coastalOnly: false,
      },
    };

    render(
      <MatrixToolbar
        profile={profile}
        onProfileChange={onProfileChange}
        onOpenScoringGuide={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Temp feel"), {
      target: { value: "warm" },
    });
    fireEvent.change(screen.getByLabelText("Surf interest"), {
      target: { value: "on" },
    });
    fireEvent.click(screen.getByLabelText("No heavy rain"));

    expect(onProfileChange).toHaveBeenCalledWith({
      ...profile,
      tempPreference: "warm",
    });
    expect(onProfileChange).toHaveBeenCalledWith({
      ...profile,
      surfEnabled: true,
    });
    expect(onProfileChange).toHaveBeenCalledWith({
      ...profile,
      dealbreakers: {
        ...profile.dealbreakers,
        avoidHeavyRain: true,
      },
    });
  });
});
