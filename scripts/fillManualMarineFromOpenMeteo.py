#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

MARINE_BASE_URL = "https://marine-api.open-meteo.com/v1/marine"
HOURLY_FIELDS = "wave_height,wave_period,sea_surface_temperature"
MONTHS = tuple(range(1, 13))

WAVE_MIN_M = 0.0
WAVE_MAX_M = 30.0
WAVE_PERIOD_MIN_S = 0.0
WAVE_PERIOD_MAX_S = 30.0
WATER_TEMP_MIN_C = -2.0
WATER_TEMP_MAX_C = 40.0


@dataclass
class CliOptions:
    data_dir: Path
    dry_run: bool
    region_ids: list[str]
    overwrite: bool
    pause_ms: int
    attempts: int
    include_inland: bool
    max_offset_deg: float
    offset_step_deg: float
    max_candidates: int


def parse_args() -> CliOptions:
    parser = argparse.ArgumentParser(
        description=(
            "Fill monthly marine/surf raw fields from Open-Meteo Marine API "
            "(wave height/period + sea surface temperature)."
        )
    )
    parser.add_argument("--dir", default="data/manual-city-month")
    parser.add_argument("--regionIds", default="")
    parser.add_argument("--dryRun", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--pauseMs", type=int, default=900)
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--includeInland", action="store_true")
    parser.add_argument("--maxOffsetDeg", type=float, default=1.2)
    parser.add_argument("--offsetStepDeg", type=float, default=0.2)
    parser.add_argument("--maxCandidates", type=int, default=36)
    args = parser.parse_args()

    region_ids = [item.strip() for item in str(args.regionIds).split(",") if item.strip()]
    return CliOptions(
        data_dir=Path(args.dir).resolve(),
        dry_run=bool(args.dryRun),
        region_ids=region_ids,
        overwrite=bool(args.overwrite),
        pause_ms=max(0, int(args.pauseMs)),
        attempts=max(1, int(args.attempts)),
        include_inland=bool(args.includeInland),
        max_offset_deg=max(0.2, float(args.maxOffsetDeg)),
        offset_step_deg=max(0.1, float(args.offsetStepDeg)),
        max_candidates=max(8, int(args.maxCandidates)),
    )


def round_or_none(value: Optional[float], precision: int = 2) -> Optional[float]:
    if value is None:
        return None
    return round(value, precision)


def clamp_or_none(value: Optional[float], minimum: float, maximum: float) -> Optional[float]:
    if value is None:
        return None
    if value < minimum or value > maximum:
        return None
    return value


def parse_retry_after_seconds(raw: Optional[str]) -> float:
    if not raw:
        return 0.0
    try:
        value = float(raw)
        return max(0.0, value)
    except ValueError:
        return 0.0


def build_marine_url(lat: float, lon: float, year: int) -> str:
    query = urlencode(
        {
            "latitude": str(lat),
            "longitude": str(lon),
            "start_date": f"{year}-01-01",
            "end_date": f"{year}-12-31",
            "timezone": "UTC",
            "hourly": HOURLY_FIELDS,
        }
    )
    return f"{MARINE_BASE_URL}?{query}"


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        as_float = float(value)
    except (TypeError, ValueError):
        return None
    if as_float <= -900:
        return None
    return as_float


def fetch_hourly_marine(url: str, attempts: int) -> Dict[str, Any]:
    last_error: Optional[Exception] = None
    for attempt in range(1, attempts + 1):
        try:
            with urlopen(url, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            last_error = error
            if error.code != 429 or attempt >= attempts:
                break
            retry_after = parse_retry_after_seconds(error.headers.get("Retry-After"))
            delay = max(2.0 * attempt, retry_after)
            time.sleep(delay)
        except URLError as error:
            last_error = error
            if attempt >= attempts:
                break
            time.sleep(1.5 * attempt)
    if last_error is None:
        raise RuntimeError("Unknown marine fetch error")
    raise last_error


def value_at(values: Any, index: int) -> Any:
    if not isinstance(values, list):
        return None
    if index < 0 or index >= len(values):
        return None
    return values[index]


def monthly_marine_aggregate(payload: Dict[str, Any]) -> Dict[int, Dict[str, Optional[float]]]:
    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    wave_heights = hourly.get("wave_height", [])
    wave_periods = hourly.get("wave_period", [])
    water_temps = hourly.get("sea_surface_temperature", [])

    month_wave_height: Dict[int, list[float]] = {month: [] for month in MONTHS}
    month_wave_period: Dict[int, list[float]] = {month: [] for month in MONTHS}
    month_water_temp: Dict[int, list[float]] = {month: [] for month in MONTHS}

    if not isinstance(times, list):
        times = []

    for index, timestamp in enumerate(times):
        if not isinstance(timestamp, str) or len(timestamp) < 10:
            continue
        month = int(timestamp[5:7])
        if month not in month_wave_height:
            continue

        wave_height = to_float(value_at(wave_heights, index))
        wave_period = to_float(value_at(wave_periods, index))
        water_temp = to_float(value_at(water_temps, index))

        if wave_height is not None:
            month_wave_height[month].append(wave_height)
        if wave_period is not None:
            month_wave_period[month].append(wave_period)
        if water_temp is not None:
            month_water_temp[month].append(water_temp)

    result: Dict[int, Dict[str, Optional[float]]] = {}
    for month in MONTHS:
        heights = month_wave_height[month]
        periods = month_wave_period[month]
        water_temps_month = month_water_temp[month]

        wave_height_min = round_or_none(min(heights)) if heights else None
        wave_height_avg = round_or_none(sum(heights) / len(heights)) if heights else None
        wave_height_max = round_or_none(max(heights)) if heights else None
        wave_period_avg = round_or_none(sum(periods) / len(periods)) if periods else None
        water_temp_avg = round_or_none(sum(water_temps_month) / len(water_temps_month)) if water_temps_month else None

        result[month] = {
            "wave_height_min_m": clamp_or_none(wave_height_min, WAVE_MIN_M, WAVE_MAX_M),
            "wave_height_avg_m": clamp_or_none(wave_height_avg, WAVE_MIN_M, WAVE_MAX_M),
            "wave_height_max_m": clamp_or_none(wave_height_max, WAVE_MIN_M, WAVE_MAX_M),
            "wave_interval_avg_s": clamp_or_none(wave_period_avg, WAVE_PERIOD_MIN_S, WAVE_PERIOD_MAX_S),
            "water_temp_c": clamp_or_none(water_temp_avg, WATER_TEMP_MIN_C, WATER_TEMP_MAX_C),
        }

    return result


def marine_coverage(by_month: Dict[int, Dict[str, Optional[float]]]) -> Dict[str, int]:
    wave_months = 0
    water_months = 0
    full_months = 0

    for month in MONTHS:
        row = by_month.get(month, {})
        has_wave = row.get("wave_height_avg_m") is not None and row.get("wave_interval_avg_s") is not None
        has_water = row.get("water_temp_c") is not None
        if has_wave:
            wave_months += 1
        if has_water:
            water_months += 1
        if has_wave and has_water:
            full_months += 1

    # Prioritize complete surfability (wave+period), then water temperature coverage.
    score = wave_months * 100 + water_months
    return {
        "wave_months": wave_months,
        "water_months": water_months,
        "full_months": full_months,
        "score": score,
    }


def build_offset_candidates(max_offset_deg: float, offset_step_deg: float, max_candidates: int) -> list[tuple[float, float]]:
    rings = max(1, int(round(max_offset_deg / offset_step_deg)))
    candidates: list[tuple[float, float]] = [(0.0, 0.0)]
    seen = {(0.0, 0.0)}

    for ix in range(-rings, rings + 1):
        for iy in range(-rings, rings + 1):
            if ix == 0 and iy == 0:
                continue
            dx = round(ix * offset_step_deg, 6)
            dy = round(iy * offset_step_deg, 6)
            key = (dx, dy)
            if key in seen:
                continue
            seen.add(key)
            candidates.append(key)

    # Search closest offsets first.
    sorted_candidates = [candidates[0]] + sorted(
        candidates[1:],
        key=lambda item: (item[0] * item[0] + item[1] * item[1], abs(item[0]) + abs(item[1])),
    )

    capped = sorted_candidates[: max(2, max_candidates)]
    return capped


def distance_km(lat: float, dx: float, dy: float) -> float:
    lat_km = abs(dy) * 111.0
    lon_km = abs(dx) * 111.0 * math.cos(math.radians(lat))
    return math.sqrt(lat_km * lat_km + lon_km * lon_km)


def append_source(existing: str, addition: str) -> str:
    current = (existing or "").strip()
    if not current:
        return addition
    if addition in current:
        return current
    return f"{current} | {addition}"


def fill_file(file_path: Path, options: CliOptions, fetched_at: str) -> Dict[str, Any]:
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    city = payload.get("city", {})
    lat = city.get("lat")
    lon = city.get("lon")
    coastal = bool(city.get("coastal"))
    year = int(payload.get("year", datetime.now(timezone.utc).year))

    if not options.include_inland and not coastal:
        return {
            "changed_fields": 0,
            "changed_months": 0,
            "skipped": True,
            "payload": payload,
        }

    if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)):
        raise ValueError("city.lat/lon missing")

    origin_lat = float(lat)
    origin_lon = float(lon)
    url = build_marine_url(origin_lat, origin_lon, year)
    data = fetch_hourly_marine(url, attempts=options.attempts)
    by_month = monthly_marine_aggregate(data)
    best_url = url
    best_lat = origin_lat
    best_lon = origin_lon
    best_dx = 0.0
    best_dy = 0.0
    best_cov = marine_coverage(by_month)

    if best_cov["wave_months"] < 12 or best_cov["water_months"] < 12:
        offsets = build_offset_candidates(
            max_offset_deg=options.max_offset_deg,
            offset_step_deg=options.offset_step_deg,
            max_candidates=options.max_candidates,
        )
        for dx, dy in offsets[1:]:
            candidate_lat = round(origin_lat + dy, 6)
            candidate_lon = round(origin_lon + dx, 6)
            candidate_url = build_marine_url(candidate_lat, candidate_lon, year)
            candidate_data = fetch_hourly_marine(candidate_url, attempts=options.attempts)
            candidate_months = monthly_marine_aggregate(candidate_data)
            candidate_cov = marine_coverage(candidate_months)

            if candidate_cov["score"] > best_cov["score"]:
                by_month = candidate_months
                best_cov = candidate_cov
                best_url = candidate_url
                best_lat = candidate_lat
                best_lon = candidate_lon
                best_dx = dx
                best_dy = dy

            if best_cov["wave_months"] == 12 and best_cov["water_months"] == 12:
                break

    changed_fields = 0
    changed_months = 0
    for month_row in payload.get("months", []):
        month = month_row.get("month")
        raw = month_row.get("raw")
        if not isinstance(month, int) or month not in by_month or not isinstance(raw, dict):
            continue

        row_changed = False
        for field, value in by_month[month].items():
            if value is None:
                continue
            if (not options.overwrite) and raw.get(field) is not None:
                continue
            if raw.get(field) != value:
                raw[field] = value
                changed_fields += 1
                row_changed = True

        if row_changed:
            month_row["marine_last_updated"] = fetched_at
            changed_months += 1

    if changed_fields > 0:
        sources = payload.setdefault("sources", {})
        marine = sources.setdefault("marine", {})
        marine["source_name"] = append_source(
            str(marine.get("source_name", "")),
            "Open-Meteo Marine API monthly aggregate (wave_height/wave_period/sea_surface_temperature)",
        )
        if best_dx != 0.0 or best_dy != 0.0:
            marine["source_name"] = append_source(
                str(marine.get("source_name", "")),
                (
                    "Nearest offshore fallback used "
                    f"(~{round(distance_km(origin_lat, best_dx, best_dy), 1)} km, "
                    f"deltaLat={best_dy:+.3f}, deltaLon={best_dx:+.3f})"
                ),
            )
        marine["source_url"] = append_source(str(marine.get("source_url", "")), best_url)
        marine["last_updated"] = fetched_at

    return {
        "changed_fields": changed_fields,
        "changed_months": changed_months,
        "skipped": False,
        "fallback_used": best_dx != 0.0 or best_dy != 0.0,
        "coverage_wave_months": best_cov["wave_months"],
        "coverage_water_months": best_cov["water_months"],
        "selected_lat": best_lat,
        "selected_lon": best_lon,
        "payload": payload,
    }


def main() -> int:
    options = parse_args()
    if not options.data_dir.exists():
        raise SystemExit(f"Data directory not found: {options.data_dir}")

    files = sorted(options.data_dir.glob("*.json"))
    if options.region_ids:
        allowed = set(options.region_ids)
        files = [file_path for file_path in files if file_path.name.split(".")[0] in allowed]

    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    processed = 0
    skipped = 0
    changed_files = 0
    changed_fields = 0
    changed_months = 0
    errors = 0

    print(
        f"Starting Open-Meteo marine fill: files={len(files)}, dryRun={options.dry_run}, "
        f"overwrite={options.overwrite}, includeInland={options.include_inland}, "
        f"pauseMs={options.pause_ms}, attempts={options.attempts}"
    )

    for index, file_path in enumerate(files, start=1):
        try:
            result = fill_file(file_path=file_path, options=options, fetched_at=fetched_at)
            if result["skipped"]:
                skipped += 1
                print(f"[{index}/{len(files)}] {file_path.name} -> skipped (inland)")
            else:
                processed += 1
                changed_fields += result["changed_fields"]
                changed_months += result["changed_months"]

                if result["changed_fields"] > 0:
                    changed_files += 1
                    if not options.dry_run:
                        file_path.write_text(
                            f"{json.dumps(result['payload'], indent=2, ensure_ascii=True)}\n",
                            encoding="utf-8",
                        )

                suffix = ""
                if result.get("fallback_used"):
                    suffix = (
                        f", fallback=1, waveMonths={result.get('coverage_wave_months', 0)}, "
                        f"waterMonths={result.get('coverage_water_months', 0)}"
                    )
                print(
                    f"[{index}/{len(files)}] {file_path.name} -> "
                    f"{'updated' if result['changed_fields'] > 0 else 'unchanged'} "
                    f"(fields={result['changed_fields']}, months={result['changed_months']}{suffix})"
                )
        except Exception as error:
            errors += 1
            print(f"[{index}/{len(files)}] {file_path.name} -> ERROR: {error}")

        if options.pause_ms > 0 and index < len(files):
            time.sleep(options.pause_ms / 1000.0)

    print("Open-Meteo marine fill summary:")
    print(f"- processed: {processed}")
    print(f"- skipped: {skipped}")
    print(f"- changed_files: {changed_files}")
    print(f"- changed_fields: {changed_fields}")
    print(f"- changed_months: {changed_months}")
    print(f"- errors: {errors}")

    return 1 if errors > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
