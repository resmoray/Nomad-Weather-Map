import type { CountryCode } from "../types/weather";

export interface CountryTemplate {
  id: string;
  label: string;
  kind: "continent" | "region";
  countries: CountryCode[];
}

export const CONTINENT_GROUPS: CountryTemplate[] = [
  {
    id: "asia",
    label: "Asia",
    kind: "continent",
    countries: [
      "AE",
      "BN",
      "CN",
      "IN",
      "KH",
      "ID",
      "JP",
      "KR",
      "LK",
      "LA",
      "MY",
      "MM",
      "PH",
      "SA",
      "SG",
      "TH",
      "TL",
      "TR",
      "TW",
      "VN",
    ],
  },
  {
    id: "europe",
    label: "Europe",
    kind: "continent",
    countries: ["AT", "DE", "ES", "FI", "FR", "GB", "GR", "IS", "IT", "NO", "PT"],
  },
  {
    id: "oceania",
    label: "Oceania",
    kind: "continent",
    countries: ["AU", "NZ"],
  },
  {
    id: "africa",
    label: "Africa",
    kind: "continent",
    countries: ["EG", "KE", "MA", "ZA"],
  },
  {
    id: "north-america",
    label: "North America",
    kind: "continent",
    countries: ["CA", "MX", "US"],
  },
  {
    id: "south-america",
    label: "South America",
    kind: "continent",
    countries: ["AR", "BR", "CL", "CO", "PE"],
  },
];

export const REGIONAL_GROUPS: CountryTemplate[] = [
  {
    id: "southeast-asia",
    label: "Southeast Asia",
    kind: "region",
    countries: ["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN"],
  },
  {
    id: "east-asia",
    label: "East Asia",
    kind: "region",
    countries: ["CN", "JP", "KR", "TW"],
  },
  {
    id: "south-asia",
    label: "South Asia",
    kind: "region",
    countries: ["IN", "LK"],
  },
  {
    id: "middle-east",
    label: "Middle East",
    kind: "region",
    countries: ["AE", "SA"],
  },
  {
    id: "nordics",
    label: "Nordics",
    kind: "region",
    countries: ["FI", "IS", "NO"],
  },
  {
    id: "north-america-core",
    label: "North America",
    kind: "region",
    countries: ["CA", "US"],
  },
  {
    id: "southern-cone",
    label: "Southern Cone",
    kind: "region",
    countries: ["AR", "CL"],
  },
  {
    id: "alpine-central-europe",
    label: "Alpine Central Europe",
    kind: "region",
    countries: ["AT"],
  },
  {
    id: "oceania-core",
    label: "Oceania",
    kind: "region",
    countries: ["AU", "NZ"],
  },
  {
    id: "western-europe",
    label: "Western Europe",
    kind: "region",
    countries: ["DE", "FR", "GB", "IT", "PT", "ES"],
  },
  {
    id: "mediterranean",
    label: "Mediterranean",
    kind: "region",
    countries: ["EG", "ES", "FR", "GR", "IT", "TR", "MA"],
  },
  {
    id: "latin-america",
    label: "Latin America",
    kind: "region",
    countries: ["AR", "BR", "CL", "CO", "MX", "PE"],
  },
  {
    id: "east-africa",
    label: "East Africa",
    kind: "region",
    countries: ["KE"],
  },
  {
    id: "southern-africa",
    label: "Southern Africa",
    kind: "region",
    countries: ["ZA"],
  },
];
