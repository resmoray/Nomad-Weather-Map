#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import pandas as pd
from meteostat import Point, daily, stations

STATION_ID_RE = re.compile(r"\(([^)]+)\)")
CORE_KEYS = ("temp_min_c", "temp_avg_c", "temp_max_c", "rain_mm", "humidity_pct", "wind_avg_kph")
CLIMATE_KEYS = (*CORE_KEYS, "sunshine_hours")
REQUIRED_DAILY_COLUMNS = ("temp", "rhum", "prcp", "wspd", "tsun")


@dataclass
class CliOptions:
    data_dir: Path
    start_year: int
    end_year: int
    max_candidates: int
    min_days_per_month: int
    overwrite_climate: bool
    dry_run: bool
    sleep_ms: int


def parse_args(argv: list[str]) -> CliOptions:
    parser = argparse.ArgumentParser(
        description=(
            "Fill/correct manual city-month climate fields from Meteostat daily station data "
            "(3-year monthly climatology by default)."
        )
    )
    parser.add_argument("--dir", dest="data_dir", default="data/manual-city-month")
    parser.add_argument("--startYear", type=int, default=None)
    parser.add_argument("--endYear", type=int, default=None)
    parser.add_argument("--years", type=int, default=3)
    parser.add_argument("--maxCandidates", type=int, default=8)
    parser.add_argument("--minDaysPerMonth", type=int, default=20)
    parser.add_argument("--sleepMs", type=int, default=120)
    parser.add_argument("--dryRun", action="store_true")
    parser.add_argument("--noOverwriteClimate", action="store_true")
    args = parser.parse_args(argv)

    current_year = datetime.now(timezone.utc).year
    end_year = args.endYear if args.endYear is not None else current_year - 1
    if end_year < 1900:
        raise ValueError("endYear must be >= 1900")

    if args.startYear is not None:
        start_year = args.startYear
    else:
        years = max(1, int(args.years))
        start_year = end_year - years + 1

    if start_year > end_year:
        raise ValueError("startYear must be <= endYear")

    return CliOptions(
        data_dir=Path(args.data_dir).resolve(),
        start_year=start_year,
        end_year=end_year,
        max_candidates=max(1, int(args.maxCandidates)),
        min_days_per_month=max(1, int(args.minDaysPerMonth)),
        overwrite_climate=not args.noOverwriteClimate,
        dry_run=bool(args.dryRun),
        sleep_ms=max(0, int(args.sleepMs)),
    )


def parse_station_id(source_name: str) -> Optional[str]:
    if not source_name:
        return None
    match = STATION_ID_RE.search(source_name)
    if not match:
        return None
    station_id = match.group(1).strip()
    return station_id or None


def round_or_none(value: float | int | None, precision: int = 1) -> Optional[float]:
    if value is None:
        return None
    if pd.isna(value):
        return None
    return round(float(value), precision)


def ensure_daily_columns(df: pd.DataFrame) -> pd.DataFrame:
    for column in REQUIRED_DAILY_COLUMNS:
        if column not in df.columns:
            df[column] = pd.NA
    return df


def station_score(df: pd.DataFrame, min_days_per_month: int) -> Tuple[int, int]:
    complete_months = 0
    total_non_null = 0

    for month in range(1, 13):
        month_df = df[df.index.month == month]
        month_counts = [int(month_df[field].notna().sum()) for field in ("temp", "rhum", "prcp", "wspd")]
        total_non_null += sum(month_counts)
        if all(count >= min_days_per_month for count in month_counts):
            complete_months += 1

    return complete_months, total_non_null


def aggregate_month(df: pd.DataFrame, month: int) -> Dict[str, Optional[float]]:
    month_df = df[df.index.month == month]
    if month_df.empty:
        return {key: None for key in CLIMATE_KEYS}

    temp = pd.to_numeric(month_df["temp"], errors="coerce").dropna()
    rhum = pd.to_numeric(month_df["rhum"], errors="coerce").dropna()
    wspd = pd.to_numeric(month_df["wspd"], errors="coerce").dropna()
    prcp = pd.to_numeric(month_df["prcp"], errors="coerce").dropna()
    tsun = pd.to_numeric(month_df["tsun"], errors="coerce").dropna()

    rain_mm: Optional[float]
    if prcp.empty:
        rain_mm = None
    else:
        by_year = prcp.groupby(prcp.index.year).sum(min_count=1)
        rain_mm = round_or_none(by_year.mean())

    sunshine_hours: Optional[float]
    if tsun.empty:
        sunshine_hours = None
    else:
        # Meteostat daily tsun is sunshine duration in minutes.
        sunshine_hours = round_or_none(tsun.mean() / 60.0)

    return {
        "temp_min_c": round_or_none(temp.min() if not temp.empty else None),
        "temp_avg_c": round_or_none(temp.mean() if not temp.empty else None),
        "temp_max_c": round_or_none(temp.max() if not temp.empty else None),
        "rain_mm": rain_mm,
        "humidity_pct": round_or_none(rhum.mean() if not rhum.empty else None),
        "wind_avg_kph": round_or_none(wspd.mean() if not wspd.empty else None),
        "sunshine_hours": sunshine_hours,
    }


def fetch_daily_dataframe(
    station_id: str,
    start_date: date,
    end_date: date,
    cache: Dict[str, Optional[pd.DataFrame]],
    sleep_ms: int,
) -> Optional[pd.DataFrame]:
    if station_id in cache:
        return cache[station_id]

    try:
        series = daily(station_id, start=start_date, end=end_date)
        df = series.fetch()
        if df is None or df.empty:
            cache[station_id] = None
            return None

        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index, errors="coerce")
            df = df[~df.index.isna()]

        if getattr(df.index, "tz", None) is not None:
            df.index = df.index.tz_convert("UTC").tz_localize(None)

        df = ensure_daily_columns(df).sort_index()
        cache[station_id] = df
        return df
    except Exception:
        cache[station_id] = None
        return None
    finally:
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000.0)


def pick_best_station(
    city_lat: float,
    city_lon: float,
    current_station_id: Optional[str],
    start_date: date,
    end_date: date,
    max_candidates: int,
    min_days_per_month: int,
    cache: Dict[str, Optional[pd.DataFrame]],
    sleep_ms: int,
) -> Tuple[Optional[str], Optional[pd.DataFrame], Tuple[int, int]]:
    candidate_ids: list[str] = []
    if current_station_id:
        candidate_ids.append(current_station_id)

    try:
        nearby = stations.nearby(Point(city_lat, city_lon)).head(max_candidates)
        for station_id in nearby.index.tolist():
            if station_id not in candidate_ids:
                candidate_ids.append(station_id)
    except Exception:
        # Keep running even if nearby lookup fails.
        pass

    best_station: Optional[str] = None
    best_df: Optional[pd.DataFrame] = None
    best_score = (-1, -1)

    for station_id in candidate_ids:
        df = fetch_daily_dataframe(station_id, start_date, end_date, cache, sleep_ms)
        if df is None or df.empty:
            continue
        score = station_score(df, min_days_per_month)
        if score > best_score:
            best_station = station_id
            best_df = df
            best_score = score

    return best_station, best_df, best_score


def apply_climate_values(raw: Dict[str, Any], values: Dict[str, Optional[float]], overwrite: bool) -> int:
    changed = 0
    for key, value in values.items():
        current_value = raw.get(key)

        # Never erase existing values when the source has no value for this field/month.
        if value is None and current_value is not None:
            continue

        if not overwrite and current_value is not None:
            continue
        if current_value != value:
            raw[key] = value
            changed += 1
    return changed


def month_has_missing_core(raw: Dict[str, Any]) -> bool:
    return any(raw.get(key) is None for key in CORE_KEYS)


def process_file(
    file_path: Path,
    options: CliOptions,
    fetched_at: str,
    daily_cache: Dict[str, Optional[pd.DataFrame]],
) -> Tuple[bool, int, bool, int]:
    payload = json.loads(file_path.read_text(encoding="utf-8"))
    city = payload.get("city", {})
    sources = payload.get("sources", {})
    climate_source = sources.get("climate", {})
    months = payload.get("months", [])

    lat = city.get("lat")
    lon = city.get("lon")
    if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)):
        raise ValueError("city.lat/lon missing or invalid")

    current_station = parse_station_id(str(climate_source.get("source_name", "")))
    best_station, best_df, score = pick_best_station(
        city_lat=float(lat),
        city_lon=float(lon),
        current_station_id=current_station,
        start_date=date(options.start_year, 1, 1),
        end_date=date(options.end_year, 12, 31),
        max_candidates=options.max_candidates,
        min_days_per_month=options.min_days_per_month,
        cache=daily_cache,
        sleep_ms=options.sleep_ms,
    )

    if best_station is None or best_df is None:
        raise ValueError("no usable Meteostat station found")

    value_changes = 0
    missing_core_months = 0
    for month_row in months:
        month = month_row.get("month")
        if not isinstance(month, int) or month < 1 or month > 12:
            continue
        raw = month_row.get("raw")
        if not isinstance(raw, dict):
            continue

        month_values = aggregate_month(best_df, month)
        value_changes += apply_climate_values(raw, month_values, options.overwrite_climate)
        month_row["climate_last_updated"] = fetched_at

        if month_has_missing_core(raw):
            missing_core_months += 1

    sources.setdefault("climate", {})
    sources["climate"]["source_name"] = (
        f"Meteostat daily station aggregate ({best_station}) [3y mean {options.start_year}-{options.end_year}]"
    )
    sources["climate"]["source_url"] = f"https://bulk.meteostat.net/v2/daily/{best_station}.csv.gz"
    sources["climate"]["last_updated"] = fetched_at

    payload["sources"] = sources

    changed_station = best_station != current_station
    changed = value_changes > 0 or changed_station

    if changed and not options.dry_run:
        file_path.write_text(f"{json.dumps(payload, indent=2, ensure_ascii=True)}\n", encoding="utf-8")

    # Return "completeness score" helper (months with enough data in station selection).
    complete_months = score[0]
    return changed, value_changes, changed_station, complete_months - missing_core_months


def main(argv: list[str]) -> int:
    try:
        options = parse_args(argv)
    except Exception as exc:
        print(f"Argument error: {exc}", file=sys.stderr)
        return 2

    if not options.data_dir.exists():
        print(f"Data dir not found: {options.data_dir}", file=sys.stderr)
        return 2

    files = sorted(options.data_dir.glob("*.json"))
    if not files:
        print(f"No JSON files found in {options.data_dir}", file=sys.stderr)
        return 2

    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    daily_cache: Dict[str, Optional[pd.DataFrame]] = {}

    processed = 0
    changed_files = 0
    changed_station_files = 0
    value_changes = 0
    errors = 0

    print(
        "Starting Meteostat manual climate fill: "
        f"files={len(files)}, years={options.start_year}-{options.end_year}, "
        f"maxCandidates={options.max_candidates}, minDaysPerMonth={options.min_days_per_month}, "
        f"overwriteClimate={options.overwrite_climate}, dryRun={options.dry_run}"
    )

    for index, file_path in enumerate(files, start=1):
        try:
            changed, file_value_changes, changed_station, _ = process_file(
                file_path=file_path,
                options=options,
                fetched_at=fetched_at,
                daily_cache=daily_cache,
            )
            processed += 1
            value_changes += file_value_changes
            if changed:
                changed_files += 1
            if changed_station:
                changed_station_files += 1
            print(
                f"[{index}/{len(files)}] {file_path.name} -> "
                f"{'updated' if changed else 'unchanged'} (values={file_value_changes}, station_changed={changed_station})"
            )
        except Exception as exc:
            errors += 1
            print(f"[{index}/{len(files)}] {file_path.name} -> ERROR: {exc}", file=sys.stderr)

    print("Meteostat fill summary:")
    print(f"- processed: {processed}")
    print(f"- changed_files: {changed_files}")
    print(f"- changed_station_files: {changed_station_files}")
    print(f"- value_changes: {value_changes}")
    print(f"- cached_station_frames: {len(daily_cache)}")
    print(f"- errors: {errors}")

    return 1 if errors > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
