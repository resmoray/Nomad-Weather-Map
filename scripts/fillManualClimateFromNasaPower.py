#!/usr/bin/env python3
from __future__ import annotations

import argparse
import calendar
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlencode
from urllib.request import urlopen

NASA_BASE_URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"
NASA_PARAMS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M"
NASA_MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


@dataclass
class CliOptions:
    data_dir: Path
    dry_run: bool
    region_ids: list[str]


def parse_args() -> CliOptions:
    parser = argparse.ArgumentParser(
        description=(
            "Fill missing core monthly climate values from NASA POWER climatology "
            "(used only as fallback for null fields)."
        )
    )
    parser.add_argument("--dir", default="data/manual-city-month")
    parser.add_argument("--dryRun", action="store_true")
    parser.add_argument("--regionIds", default="")
    args = parser.parse_args()
    region_ids = [item.strip() for item in str(args.regionIds).split(",") if item.strip()]
    return CliOptions(data_dir=Path(args.dir).resolve(), dry_run=bool(args.dryRun), region_ids=region_ids)


def to_float_or_none(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        as_float = float(value)
    except (TypeError, ValueError):
        return None
    if as_float <= -900:
        return None
    return as_float


def round_or_none(value: Optional[float], precision: int = 1) -> Optional[float]:
    if value is None:
        return None
    return round(value, precision)


def build_nasa_url(lat: float, lon: float) -> str:
    query = urlencode(
        {
            "parameters": NASA_PARAMS,
            "community": "RE",
            "longitude": str(lon),
            "latitude": str(lat),
            "format": "JSON",
        }
    )
    return f"{NASA_BASE_URL}?{query}"


def fetch_nasa_climatology(lat: float, lon: float) -> Dict[str, Dict[str, Any]]:
    url = build_nasa_url(lat, lon)
    with urlopen(url, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["properties"]["parameter"]


def month_key(month: int) -> str:
    return NASA_MONTH_KEYS[month - 1]


def append_source(existing: str, addition: str) -> str:
    existing_trim = (existing or "").strip()
    if not existing_trim:
        return addition
    if addition in existing_trim:
        return existing_trim
    return f"{existing_trim} | {addition}"


def fill_file(file_path: Path, fetched_at: str) -> Dict[str, int]:
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    city = payload.get("city", {})
    lat = city.get("lat")
    lon = city.get("lon")
    year = int(payload.get("year", datetime.now(timezone.utc).year))

    if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)):
        raise ValueError("city.lat/lon missing")

    params = fetch_nasa_climatology(float(lat), float(lon))

    months = payload.get("months", [])
    changed_fields = 0
    changed_months = 0

    for month_row in months:
        month = month_row.get("month")
        raw = month_row.get("raw")
        if not isinstance(month, int) or month < 1 or month > 12 or not isinstance(raw, dict):
            continue

        key = month_key(month)
        days_in_month = calendar.monthrange(year, month)[1]
        target_values = {
            "temp_min_c": round_or_none(to_float_or_none(params.get("T2M_MIN", {}).get(key))),
            "temp_avg_c": round_or_none(to_float_or_none(params.get("T2M", {}).get(key))),
            "temp_max_c": round_or_none(to_float_or_none(params.get("T2M_MAX", {}).get(key))),
            "rain_mm": round_or_none(
                (to_float_or_none(params.get("PRECTOTCORR", {}).get(key)) or 0.0) * days_in_month
                if to_float_or_none(params.get("PRECTOTCORR", {}).get(key)) is not None
                else None
            ),
            "humidity_pct": round_or_none(to_float_or_none(params.get("RH2M", {}).get(key))),
            "wind_avg_kph": round_or_none(
                (to_float_or_none(params.get("WS2M", {}).get(key)) or 0.0) * 3.6
                if to_float_or_none(params.get("WS2M", {}).get(key)) is not None
                else None
            ),
        }

        row_changed = False
        for field, value in target_values.items():
            if raw.get(field) is not None or value is None:
                continue
            raw[field] = value
            changed_fields += 1
            row_changed = True

        if row_changed:
            month_row["climate_last_updated"] = fetched_at
            changed_months += 1

    if changed_fields > 0:
        sources = payload.setdefault("sources", {})
        climate = sources.setdefault("climate", {})
        climate["source_name"] = append_source(
            str(climate.get("source_name", "")),
            "NASA POWER monthly climatology fallback (T2M/T2M_MIN/T2M_MAX/PRECTOTCORR/RH2M/WS2M)",
        )
        climate["source_url"] = append_source(str(climate.get("source_url", "")), build_nasa_url(float(lat), float(lon)))
        climate["last_updated"] = fetched_at

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

    print(f"Starting NASA fallback fill: files={len(files)}, dryRun={options.dry_run}")

    for index, file_path in enumerate(files, start=1):
        try:
            result = fill_file(file_path, fetched_at=fetched_at)
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

    print("NASA fallback summary:")
    print(f"- processed: {processed}")
    print(f"- changed_files: {changed_files}")
    print(f"- changed_fields: {changed_fields}")
    print(f"- changed_months: {changed_months}")
    print(f"- errors: {errors}")

    return 1 if errors > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
