#!/usr/bin/env python3
"""휴일 데이터를 직전 평일 환율로 보정하여 CSV를 생성합니다."""

from __future__ import annotations

import csv
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Sequence


DATE_COL = "날짜"
CURRENCY_COL = "통화명"
RATE_COL = "매매기준율"
DATE_FMT = "%Y%m%d"


def parse_date(value: str) -> date:
    return datetime.strptime(value, DATE_FMT).date()


def daterange(start: date, end: date):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def load_rows(path: Path) -> Dict[str, Dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        return {row[DATE_COL]: row for row in reader}


def write_rows(path: Path, rows: Sequence[Dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=[DATE_COL, CURRENCY_COL, RATE_COL])
        writer.writeheader()
        writer.writerows(rows)


def fill_missing_days(rows_by_date: Dict[str, Dict[str, str]]) -> List[Dict[str, str]]:
    if not rows_by_date:
        return []

    sorted_dates = sorted(rows_by_date.keys())
    start = parse_date(sorted_dates[0])
    end = parse_date(sorted_dates[-1])

    filled_rows: List[Dict[str, str]] = []
    last_known_row: Dict[str, str] | None = None

    for current in daterange(start, end):
        key = current.strftime(DATE_FMT)
        if key in rows_by_date:
            last_known_row = rows_by_date[key]
            filled_rows.append(last_known_row)
        elif last_known_row is not None:
            filled_rows.append(
                {
                    DATE_COL: key,
                    CURRENCY_COL: last_known_row[CURRENCY_COL],
                    RATE_COL: last_known_row[RATE_COL],
                }
            )

    return filled_rows


def main(argv: Sequence[str]) -> int:
    if len(argv) < 2:
        print(f"Usage: {argv[0]} <input_csv> [output_csv]")
        return 1

    input_path = Path(argv[1])
    output_path = Path(argv[2]) if len(argv) > 2 else input_path

    rows_by_date = load_rows(input_path)
    filled = fill_missing_days(rows_by_date)
    write_rows(output_path, filled)

    print(
        f"{len(rows_by_date)}건 입력 → 주중 {len(filled)}건으로 채워 "
        f"{output_path}에 저장했습니다."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
