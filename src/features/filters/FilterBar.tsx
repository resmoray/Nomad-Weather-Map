import { MONTHS, type CountryCode, type Month, type Region } from "../../types/weather";
import { MONTH_LABELS } from "../../utils/months";
import { formatRegionLabel } from "../../utils/regionLabel";

interface FilterBarProps {
  countries: Array<{ code: CountryCode; name: string }>;
  regions: Region[];
  selectedCountry: CountryCode | "ALL";
  selectedMonth: Month;
  selectedRegionIds: string[];
  onCountryChange: (country: CountryCode | "ALL") => void;
  onMonthChange: (month: Month) => void;
  onRegionToggle: (regionId: string) => void;
  onSelectAllRegions: () => void;
  onClearRegions: () => void;
}

export function FilterBar({
  countries,
  regions,
  selectedCountry,
  selectedMonth,
  selectedRegionIds,
  onCountryChange,
  onMonthChange,
  onRegionToggle,
  onSelectAllRegions,
  onClearRegions,
}: FilterBarProps) {
  return (
    <section className="panel filter-panel">
      <header className="panel-header">
        <h2>Filters</h2>
        <p>Choose a country, month, and one or more regions to compare.</p>
      </header>

      <div className="filter-grid">
        <label>
          <span>Country</span>
          <select
            value={selectedCountry}
            onChange={(event) => onCountryChange(event.target.value as CountryCode | "ALL")}
          >
            <option value="ALL">All countries</option>
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Month</span>
          <select
            value={selectedMonth}
            onChange={(event) => onMonthChange(Number(event.target.value) as Month)}
          >
            {MONTHS.map((month) => (
              <option key={month} value={month}>
                {MONTH_LABELS[month]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="region-picker">
        <div className="region-picker-header">
          <h3>Regions</h3>
          <div className="region-picker-actions">
            <button type="button" onClick={onSelectAllRegions}>
              Select all
            </button>
            <button type="button" onClick={onClearRegions}>
              Clear
            </button>
          </div>
        </div>

        <div className="region-list">
          {regions.map((region) => {
            const checked = selectedRegionIds.includes(region.id);

            return (
              <label key={region.id} className="region-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onRegionToggle(region.id)}
                />
                <span>{formatRegionLabel(region)}</span>
              </label>
            );
          })}

          {regions.length === 0 ? <p className="hint-text">No regions for this country.</p> : null}
        </div>
      </div>
    </section>
  );
}
