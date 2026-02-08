import type { UserPreferenceProfile } from "../../types/presentation";
import {
  AIR_OPTIONS,
  DEALBREAKER_OPTIONS,
  HUMIDITY_OPTIONS,
  RAIN_OPTIONS,
  SURF_IMPORTANCE_OPTIONS,
  TEMP_OPTIONS,
  UV_OPTIONS,
} from "./customProfile";

interface MatrixToolbarProps {
  profile: UserPreferenceProfile;
  onProfileChange: (profile: UserPreferenceProfile) => void;
  onOpenScoringGuide: () => void;
}

export function MatrixToolbar({
  profile,
  onProfileChange,
  onOpenScoringGuide,
}: MatrixToolbarProps) {
  return (
    <div className="matrix-toolbar" role="group" aria-label="Comparison controls">
      <label>
        <span>Temp feel</span>
        <select
          aria-label="Temp feel"
          value={profile.tempPreference}
          onChange={(event) =>
            onProfileChange({ ...profile, tempPreference: event.target.value as UserPreferenceProfile["tempPreference"] })
          }
        >
          {TEMP_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Humidity feel</span>
        <select
          aria-label="Humidity feel"
          value={profile.humidityPreference}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              humidityPreference: event.target.value as UserPreferenceProfile["humidityPreference"],
            })
          }
        >
          {HUMIDITY_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Rain tolerance</span>
        <select
          aria-label="Rain tolerance"
          value={profile.rainTolerance}
          onChange={(event) =>
            onProfileChange({ ...profile, rainTolerance: event.target.value as UserPreferenceProfile["rainTolerance"] })
          }
        >
          {RAIN_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Air sensitivity</span>
        <select
          aria-label="Air sensitivity"
          value={profile.airSensitivity}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              airSensitivity: event.target.value as UserPreferenceProfile["airSensitivity"],
            })
          }
        >
          {AIR_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>UV sensitivity</span>
        <select
          aria-label="UV sensitivity"
          value={profile.uvSensitivity}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              uvSensitivity: event.target.value as UserPreferenceProfile["uvSensitivity"],
            })
          }
        >
          {UV_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="matrix-toggle">
        <span>Surf interest</span>
        <select
          aria-label="Surf interest"
          value={profile.surfEnabled ? "on" : "off"}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              surfEnabled: event.target.value === "on",
            })
          }
        >
          {SURF_IMPORTANCE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="matrix-dealbreakers">
        <legend>Dealbreakers (hard constraints)</legend>
        {DEALBREAKER_OPTIONS.map((option) => (
          <label key={option.id} title={option.description}>
            <input
              type="checkbox"
              checked={profile.dealbreakers[option.id]}
              onChange={(event) =>
                onProfileChange({
                  ...profile,
                  dealbreakers: {
                    ...profile.dealbreakers,
                    [option.id]: event.target.checked,
                  },
                })
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <button type="button" className="ghost-button" onClick={onOpenScoringGuide}>
        How scoring works
      </button>
    </div>
  );
}
