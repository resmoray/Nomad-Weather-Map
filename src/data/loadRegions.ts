import { z } from "zod";
import rawRegions from "./regions.json";
import type { CountryCode, Region } from "../types/weather";

const regionSchema = z.object({
  id: z.string(),
  countryCode: z.union([
    z.literal("AE"),
    z.literal("AR"),
    z.literal("AT"),
    z.literal("AU"),
    z.literal("BN"),
    z.literal("BR"),
    z.literal("CA"),
    z.literal("CL"),
    z.literal("CN"),
    z.literal("CO"),
    z.literal("DE"),
    z.literal("EG"),
    z.literal("ES"),
    z.literal("FR"),
    z.literal("FI"),
    z.literal("GB"),
    z.literal("GR"),
    z.literal("IS"),
    z.literal("IN"),
    z.literal("IT"),
    z.literal("KH"),
    z.literal("ID"),
    z.literal("JP"),
    z.literal("KE"),
    z.literal("KR"),
    z.literal("LK"),
    z.literal("LA"),
    z.literal("MA"),
    z.literal("MX"),
    z.literal("MY"),
    z.literal("MM"),
    z.literal("NZ"),
    z.literal("NO"),
    z.literal("PE"),
    z.literal("PH"),
    z.literal("PT"),
    z.literal("SA"),
    z.literal("SG"),
    z.literal("TH"),
    z.literal("TL"),
    z.literal("TR"),
    z.literal("TW"),
    z.literal("US"),
    z.literal("VN"),
    z.literal("ZA"),
  ]),
  countryName: z.string(),
  regionName: z.string(),
  cityName: z.string(),
  lat: z.number(),
  lon: z.number(),
  cityIata: z.string().length(3),
  destinationIata: z.string().length(3),
  isCoastal: z.boolean(),
});

const regionsSchema = z.array(regionSchema);

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareRegionsAlphabetically(left: Region, right: Region): number {
  const byCountry = compareText(left.countryName, right.countryName);
  if (byCountry !== 0) {
    return byCountry;
  }

  const byRegion = compareText(left.regionName, right.regionName);
  if (byRegion !== 0) {
    return byRegion;
  }

  return compareText(left.cityName, right.cityName);
}

const parsedRegions = regionsSchema.parse(rawRegions);

export const regions: Region[] = [...parsedRegions].sort(compareRegionsAlphabetically);

export const countries: Array<{ code: CountryCode; name: string }> = Array.from(
  regions
    .reduce((map, region) => {
      map.set(region.countryCode, region.countryName);
      return map;
    }, new Map<CountryCode, string>())
    .entries(),
)
  .map(([code, name]) => ({ code, name }))
  .sort((left, right) => compareText(left.name, right.name));
