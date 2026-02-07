import { z } from "zod";
import rawRegions from "./regions.json";
import type { CountryCode, Region } from "../types/weather";

const regionSchema = z.object({
  id: z.string(),
  countryCode: z.union([
    z.literal("AT"),
    z.literal("AU"),
    z.literal("BN"),
    z.literal("CN"),
    z.literal("ES"),
    z.literal("KH"),
    z.literal("ID"),
    z.literal("JP"),
    z.literal("KR"),
    z.literal("LK"),
    z.literal("LA"),
    z.literal("MA"),
    z.literal("MY"),
    z.literal("MM"),
    z.literal("NZ"),
    z.literal("PH"),
    z.literal("SG"),
    z.literal("TH"),
    z.literal("TL"),
    z.literal("TW"),
    z.literal("VN"),
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

export const regions: Region[] = regionsSchema.parse(rawRegions);

export const countries: Array<{ code: CountryCode; name: string }> = Array.from(
  regions
    .reduce((map, region) => {
      map.set(region.countryCode, region.countryName);
      return map;
    }, new Map<CountryCode, string>())
    .entries(),
).map(([code, name]) => ({ code, name }));
