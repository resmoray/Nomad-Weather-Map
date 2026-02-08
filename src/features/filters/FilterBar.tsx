import { useEffect, useMemo, useRef, useState } from "react";
import { CONTINENT_GROUPS, REGIONAL_GROUPS } from "../../data/countryGroups";
import { MONTHS, type CountryCode, type Month, type Region } from "../../types/weather";
import { MONTH_LABELS } from "../../utils/months";
import { formatRegionLabel } from "../../utils/regionLabel";

interface FilterBarProps {
  countries: Array<{ code: CountryCode; name: string }>;
  regions: Region[];
  selectedCountryCodes: CountryCode[];
  selectedMonth: Month;
  selectedRegionIds: string[];
  onCountryCodesChange: (codes: CountryCode[]) => void;
  onMonthChange: (month: Month) => void;
  onRegionToggle: (regionId: string) => void;
  onSelectAllRegions: () => void;
  onClearRegions: () => void;
}

export function FilterBar({
  countries,
  regions,
  selectedCountryCodes,
  selectedMonth,
  selectedRegionIds,
  onCountryCodesChange,
  onMonthChange,
  onRegionToggle,
  onSelectAllRegions,
  onClearRegions,
}: FilterBarProps) {
  const [countrySearch, setCountrySearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const countryPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!countryPickerRef.current) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!countryPickerRef.current.contains(target)) {
        setIsCountryDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const countryOrderMap = useMemo(
    () => new Map(countries.map((country, index) => [country.code, index])),
    [countries],
  );

  function sortCountryCodes(codes: CountryCode[]): CountryCode[] {
    return [...codes].sort((left, right) => (countryOrderMap.get(left) ?? 0) - (countryOrderMap.get(right) ?? 0));
  }

  function toggleCountry(countryCode: CountryCode): void {
    if (selectedCountryCodes.includes(countryCode)) {
      onCountryCodesChange(selectedCountryCodes.filter((code) => code !== countryCode));
      return;
    }

    onCountryCodesChange(sortCountryCodes([...selectedCountryCodes, countryCode]));
  }

  function applyCountryTemplate(codes: CountryCode[]): void {
    onCountryCodesChange(sortCountryCodes(codes));
  }

  const visibleCountries = useMemo(
    () =>
      countries.filter((country) =>
        country.name.toLowerCase().includes(countrySearch.toLowerCase().trim()),
      ),
    [countries, countrySearch],
  );

  const selectedCountryNames = useMemo(
    () =>
      countries
        .filter((country) => selectedCountryCodes.includes(country.code))
        .map((country) => country.name),
    [countries, selectedCountryCodes],
  );

  const selectedCountrySummary = useMemo(() => {
    if (selectedCountryCodes.length === 0) {
      return "All countries";
    }

    if (selectedCountryCodes.length === 1) {
      return selectedCountryNames[0] ?? "1 country selected";
    }

    return `${selectedCountryCodes.length} countries selected`;
  }, [selectedCountryCodes.length, selectedCountryNames]);

  const countryCardValue = useMemo(() => {
    if (selectedCountryCodes.length === 0) {
      return "All countries";
    }

    if (selectedCountryNames.length === 1) {
      return selectedCountryNames[0] ?? "1 country";
    }

    return `${selectedCountryCodes.length} countries`;
  }, [selectedCountryCodes.length, selectedCountryNames]);

  const visibleRegions = useMemo(() => {
    const query = regionSearch.toLowerCase().trim();

    return regions
      .filter((region) => {
        if (!query) {
          return true;
        }

        const label = formatRegionLabel(region).toLowerCase();
        return label.includes(query);
      })
      .sort((left, right) =>
        formatRegionLabel(left).localeCompare(formatRegionLabel(right), undefined, {
          sensitivity: "base",
        }),
      );
  }, [regions, regionSearch]);

  return (
    <section className="panel filter-panel">
      <header className="panel-header">
        <h2>Filters</h2>
        <p>Choose a country, month, and one or more regions to compare.</p>
      </header>

      <div className="filter-grid">
        <div className="country-picker-wrap" ref={countryPickerRef}>
          <span>Countries</span>
          <div className="country-picker">
            <input
              aria-label="Country search and select"
              placeholder={selectedCountrySummary}
              value={countrySearch}
              onFocus={() => setIsCountryDropdownOpen(true)}
              onChange={(event) => {
                setCountrySearch(event.target.value);
                setIsCountryDropdownOpen(true);
              }}
            />
            <button
              type="button"
              className="ghost-button country-picker-toggle"
              aria-label={isCountryDropdownOpen ? "Close country dropdown" : "Open country dropdown"}
              onClick={() => setIsCountryDropdownOpen((previous) => !previous)}
            >
              {isCountryDropdownOpen ? "Close" : "Open"}
            </button>
          </div>

          {isCountryDropdownOpen ? (
            <div className="country-dropdown">
              <div className="country-template-block">
                <p>Quick templates</p>
                <div className="country-template-row">
                  <button type="button" className="ghost-button" onClick={() => onCountryCodesChange([])}>
                    All countries
                  </button>
                  {REGIONAL_GROUPS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="ghost-button"
                      onClick={() => applyCountryTemplate(template.countries)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="country-template-block">
                <p>Continents</p>
                <div className="country-template-row">
                  {CONTINENT_GROUPS.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      className="ghost-button"
                      onClick={() => applyCountryTemplate(template.countries)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="country-dropdown-list">
                {visibleCountries.map((country) => (
                  <label key={country.code} className="country-option">
                    <input
                      type="checkbox"
                      checked={selectedCountryCodes.includes(country.code)}
                      onChange={() => toggleCountry(country.code)}
                    />
                    <span>{country.name} ({country.code})</span>
                  </label>
                ))}
                {visibleCountries.length === 0 ? <p className="hint-text">No country matches.</p> : null}
              </div>
            </div>
          ) : null}
        </div>

        <label>
          <span>Month</span>
          <select
            aria-label="Month"
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

        <label>
          <span>Region search</span>
          <input
            aria-label="Region search"
            placeholder="Search region"
            value={regionSearch}
            onChange={(event) => setRegionSearch(event.target.value)}
          />
        </label>

        <div className="region-list">
          {visibleRegions.map((region) => {
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

          {visibleRegions.length === 0 ? (
            <p className="hint-text">No regions for this filter.</p>
          ) : null}
        </div>

        <div className="setup-stats filter-summary-stats" aria-label="Current selection summary">
          <div className="setup-stat">
            <span>Countries</span>
            <strong>{countryCardValue}</strong>
          </div>
          <div className="setup-stat">
            <span>Month</span>
            <strong>{MONTH_LABELS[selectedMonth]}</strong>
          </div>
          <div className="setup-stat">
            <span>Selected regions</span>
            <strong>{selectedRegionIds.length}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
