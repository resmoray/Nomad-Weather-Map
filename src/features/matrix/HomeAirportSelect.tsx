import { useMemo, useState } from "react";
import { AIRPORTS, type AirportOption, formatAirportLabel } from "../../data/airports";

interface HomeAirportSelectProps {
  value: string;
  onChange: (iata: string) => void;
}

const MAX_RESULTS = 12;
const DEFAULT_SUGGESTIONS = ["SFO", "LHR", "SIN", "BKK", "HND"];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function startsOrIncludes(source: string, query: string): number {
  if (!query) {
    return 0;
  }

  if (source.startsWith(query)) {
    return 2;
  }

  if (source.includes(query)) {
    return 1;
  }

  return 0;
}

function subsequenceScore(source: string, query: string): number {
  if (!query || query.length < 2) {
    return 0;
  }

  let at = 0;
  for (const char of query) {
    const next = source.indexOf(char, at);
    if (next === -1) {
      return 0;
    }
    at = next + 1;
  }

  return 1;
}

function airportScore(airport: AirportOption, query: string): number {
  const iata = normalize(airport.iata);
  const city = normalize(airport.city);
  const country = normalize(airport.country);
  const aliases = (airport.aliases ?? []).map(normalize);

  const aliasBest = aliases.reduce((best, alias) => Math.max(best, startsOrIncludes(alias, query)), 0);

  const base =
    startsOrIncludes(iata, query) * 120 +
    startsOrIncludes(city, query) * 90 +
    startsOrIncludes(country, query) * 70 +
    aliasBest * 60;

  if (base > 0) {
    return base;
  }

  return (
    subsequenceScore(iata, query) * 30 +
    subsequenceScore(city, query) * 20 +
    subsequenceScore(country, query) * 15
  );
}

export function HomeAirportSelect({ value, onChange }: HomeAirportSelectProps) {
  const [query, setQuery] = useState(() => {
    const selected = AIRPORTS.find((airport) => airport.iata === value);
    return selected ? formatAirportLabel(selected) : value;
  });
  const [isOpen, setIsOpen] = useState(false);

  const normalizedQuery = normalize(query.trim());

  const ranked = useMemo(() => {
    if (!normalizedQuery) {
      return AIRPORTS.filter((airport) => DEFAULT_SUGGESTIONS.includes(airport.iata));
    }

    return [...AIRPORTS]
      .map((airport) => ({ airport, score: airportScore(airport, normalizedQuery) }))
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((row) => row.airport);
  }, [normalizedQuery]);

  const matches = ranked.slice(0, MAX_RESULTS);
  const hasNoResults = normalizedQuery.length > 0 && matches.length === 0;

  const suggestions = useMemo(() => {
    if (!hasNoResults) {
      return [];
    }

    return [...AIRPORTS]
      .map((airport) => ({ airport, score: airportScore(airport, normalizedQuery) }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 5)
      .map((row) => row.airport);
  }, [hasNoResults, normalizedQuery]);

  function selectAirport(airport: AirportOption): void {
    onChange(airport.iata);
    setQuery(formatAirportLabel(airport));
    setIsOpen(false);
  }

  return (
    <div className="airport-select">
      <input
        aria-label="Home airport"
        value={query}
        placeholder="Search by code, city, or country"
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            return;
          }

          if (event.key === "Enter" && matches.length > 0) {
            event.preventDefault();
            selectAirport(matches[0]);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
      />

      {isOpen ? (
        <div className="airport-dropdown" role="listbox" aria-label="Airport options">
          {matches.map((airport) => (
            <button
              type="button"
              key={airport.iata}
              className="airport-option"
              onMouseDown={(event) => {
                event.preventDefault();
                selectAirport(airport);
              }}
            >
              {formatAirportLabel(airport)}
            </button>
          ))}

          {hasNoResults ? (
            <div className="airport-empty">
              <p>No exact match found.</p>
              {suggestions.length > 0 ? (
                <div className="airport-suggestions">
                  <span>Did you mean:</span>
                  {suggestions.map((airport) => (
                    <button
                      type="button"
                      key={airport.iata}
                      className="airport-suggestion"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectAirport(airport);
                      }}
                    >
                      {formatAirportLabel(airport)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
