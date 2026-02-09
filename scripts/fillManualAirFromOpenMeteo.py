#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

AIR_BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
HOURLY_FIELDS = "pm2_5,us_aqi,uv_index"
MONTHS = tuple(range(1, 13))

PM25_MIN = 0.0
PM25_MAX = 1000.0
AQI_MIN = 0.0
AQI_MAX = 500.0
UV_MIN = 0.0
UV_MAX = 20.0

# EPA PM2.5 (24h) breakpoints for US AQI conversion.
US_AQI_PM25_BREAKPOINTS = (
    (0.0, 12.0, 0.0, 50.0),
    (12.1, 35.4, 51.0, 100.0),
    (35.5, 55.4, 101.0, 150.0),
    (55.5, 150.4, 151.0, 200.0),
    (150.5, 250.4, 201.0, 300.0),
    (250.5, 350.4, 301.0, 400.0),
    (350.5, 500.4, 401.0, 500.0),
)


@dataclass
class CliOptions:
    data_dir: Path
    dry_run: bool
    region_ids: list[str]
    overwrite: bool
    pause_ms: int
    attempts: int


def parse_args() -> CliOptions:
    parser = argparse.ArgumentParser(
        description=(
            "Fill monthly PM2.5 / AQI / UV fields from Open-Meteo Air Quality API "
            "(hourly aggregation per city-year)."
        )
    )
    parser.add_argument("--dir", default="data/manual-city-month")
    parser.add_argument("--regionIds", default="")
    parser.add_argument("--dryRun", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    parser.add_argument("--pauseMs", type=int, default=900)
    parser.add_argument("--attempts", type=int, default=3)
    args = parser.parse_args()

    region_ids = [item.strip() for item in str(args.regionIds).split(",") if item.strip()]
    return CliOptions(
        data_dir=Path(args.dir).resolve(),
        dry_run=bool(args.dryRun),
        region_ids=region_ids,
        overwrite=bool(args.overwrite),
        pause_ms=max(0, int(args.pauseMs)),
        attempts=max(1, int(args.attempts)),
    )


def round_or_none(value: Optional[float], precision: int = 1) -> Optional[float]:
    if value is None:
        return None
    return round(value, precision)


def clamp_or_none(value: Optional[float], minimum: float, maximum: float) -> Optional[float]:
    if value is None:
        return None
    if value < minimum or value > maximum:
        return None
    return value


def pm25_to_us_aqi(pm25_ug_m3: Optional[float]) -> Optional[float]:
    if pm25_ug_m3 is None:
        return None

    concentration = max(PM25_MIN, min(500.4, pm25_ug_m3))
    for c_low, c_high, i_low, i_high in US_AQI_PM25_BREAKPOINTS:
        if c_low <= concentration <= c_high:
            if c_high == c_low:
                return round_or_none(i_high)
            aqi = ((i_high - i_low) / (c_high - c_low)) * (concentration - c_low) + i_low
            return round_or_none(aqi)

    return round_or_none(AQI_MAX)


def parse_retry_after_seconds(raw: Optional[str]) -> float:
    if not raw:
        return 0.0
    try:
        value = float(raw)
        return max(0.0, value)
    except ValueError:
        return 0.0


def build_air_url(lat: float, lon: float, year: int) -> str:
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
    return f"{AIR_BASE_URL}?{query}"


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


def fetch_hourly_air(url: str, attempts: int) -> Dict[str, Any]:
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
        raise RuntimeError("Unknown air fetch error")
    raise last_error


def monthly_air_aggregate(payload: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    hourly = payload.get("hourly", {})
    times = hourly.get("time", [])
    pm_values = hourly.get("pm2_5", [])
    aqi_values = hourly.get("us_aqi", [])
    uv_values = hourly.get("uv_index", [])

    month_pm: Dict[int, list[float]] = {month: [] for month in MONTHS}
    month_aqi: Dict[int, list[float]] = {month: [] for month in MONTHS}
    month_uv: Dict[int, list[float]] = {month: [] for month in MONTHS}
    month_day_uv_max: Dict[int, Dict[str, float]] = {month: {} for month in MONTHS}

    max_len = min(len(times), len(pm_values), len(aqi_values), len(uv_values))
    for index in range(max_len):
        timestamp = times[index]
        if not isinstance(timestamp, str) or len(timestamp) < 10:
            continue
        month = int(timestamp[5:7])
        day_key = timestamp[:10]
        if month not in month_pm:
            continue

        pm = to_float(pm_values[index])
        aqi = to_float(aqi_values[index])
        uv = to_float(uv_values[index])

        if pm is not None:
            month_pm[month].append(pm)
        if aqi is not None:
            month_aqi[month].append(aqi)
        if uv is not None:
            month_uv[month].append(uv)
            day_map = month_day_uv_max[month]
            previous = day_map.get(day_key)
            if previous is None or uv > previous:
                day_map[day_key] = uv

    result: Dict[int, Dict[str, Any]] = {}
    for month in MONTHS:
        pm_avg = round_or_none(sum(month_pm[month]) / len(month_pm[month])) if month_pm[month] else None
        aqi_avg = round_or_none(sum(month_aqi[month]) / len(month_aqi[month])) if month_aqi[month] else None
        day_max_values = list(month_day_uv_max[month].values())
        uv_avg = round_or_none(sum(day_max_values) / len(day_max_values)) if day_max_values else None
        uv_max = round_or_none(max(month_uv[month])) if month_uv[month] else None

        pm_avg = clamp_or_none(pm_avg, PM25_MIN, PM25_MAX)
        aqi_avg = clamp_or_none(aqi_avg, AQI_MIN, AQI_MAX)
        uv_avg = clamp_or_none(uv_avg, UV_MIN, UV_MAX)
        uv_max = clamp_or_none(uv_max, UV_MIN, UV_MAX)

        used_pm25_fallback_for_aqi = False
        if aqi_avg is None:
            fallback = pm25_to_us_aqi(pm_avg)
            if fallback is not None:
                aqi_avg = fallback
                used_pm25_fallback_for_aqi = True

        result[month] = {
            "pm25_ug_m3": pm_avg,
            "aqi_avg": aqi_avg,
            "uv_index_avg": uv_avg,
            "uv_index_max": uv_max,
            "_aqi_fallback_used": used_pm25_fallback_for_aqi,
        }

    return result


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
    year = int(payload.get("year", datetime.now(timezone.utc).year))

    if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)):
        raise ValueError("city.lat/lon missing")

    url = build_air_url(float(lat), float(lon), year)
    data = fetch_hourly_air(url, attempts=options.attempts)
    by_month = monthly_air_aggregate(data)

    changed_fields = 0
    changed_months = 0
    used_aqi_fallback = False
    for month_row in payload.get("months", []):
        month = month_row.get("month")
        raw = month_row.get("raw")
        if not isinstance(month, int) or month not in by_month or not isinstance(raw, dict):
            continue

        month_data = by_month[month]
        if bool(month_data.get("_aqi_fallback_used")):
            used_aqi_fallback = True

        row_changed = False
        for field, value in month_data.items():
            if field.startswith("_"):
                continue
            if value is None:
                continue
            if (not options.overwrite) and raw.get(field) is not None:
                continue
            if raw.get(field) != value:
                raw[field] = value
                changed_fields += 1
                row_changed = True

        if row_changed:
            month_row["air_last_updated"] = fetched_at
            changed_months += 1

    if changed_fields > 0:
        sources = payload.setdefault("sources", {})
        air = sources.setdefault("air", {})
        air["source_name"] = append_source(
            str(air.get("source_name", "")),
            "Open-Meteo Air Quality API monthly aggregate (pm2_5/us_aqi/uv_index)",
        )
        if used_aqi_fallback:
            air["source_name"] = append_source(
                str(air.get("source_name", "")),
                "Fallback: US AQI estimated from monthly PM2.5 (EPA breakpoint conversion)",
            )
        air["source_url"] = append_source(str(air.get("source_url", "")), url)
        air["last_updated"] = fetched_at

    return {
        "changed_fields": changed_fields,
        "changed_months": changed_months,
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
    changed_files = 0
    changed_fields = 0
    changed_months = 0
    errors = 0

    print(
        f"Starting Open-Meteo air fill: files={len(files)}, dryRun={options.dry_run}, "
        f"overwrite={options.overwrite}, pauseMs={options.pause_ms}, attempts={options.attempts}"
    )

    for index, file_path in enumerate(files, start=1):
        try:
            result = fill_file(file_path=file_path, options=options, fetched_at=fetched_at)
            processed += 1
            changed_fields += result["changed_fields"]
            changed_months += result["changed_months"]

            if result["changed_fields"] > 0:
                changed_files += 1
                if not options.dry_run:
                    file_path.write_text(f"{json.dumps(result['payload'], indent=2, ensure_ascii=True)}\n", encoding="utf-8")

            print(
                f"[{index}/{len(files)}] {file_path.name} -> "
                f"{'updated' if result['changed_fields'] > 0 else 'unchanged'} "
                f"(fields={result['changed_fields']}, months={result['changed_months']})"
            )
        except Exception as error:
            errors += 1
            print(f"[{index}/{len(files)}] {file_path.name} -> ERROR: {error}")

        if options.pause_ms > 0 and index < len(files):
            time.sleep(options.pause_ms / 1000.0)

    print("Open-Meteo air fill summary:")
    print(f"- processed: {processed}")
    print(f"- changed_files: {changed_files}")
    print(f"- changed_fields: {changed_fields}")
    print(f"- changed_months: {changed_months}")
    print(f"- errors: {errors}")

    return 1 if errors > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
