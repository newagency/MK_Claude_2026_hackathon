#!/usr/bin/env python3
"""Filter 쌀 rows so that only the highest priced one per 날짜 remains."""

from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Dict, List, Sequence


DATE_COL = "날짜"
ITEM_COL = "품목명"
PRICE_COL = "조사일_kg_환산_가격"
TARGET_ITEM = "쌀"


def parse_price(raw_price: str) -> float:
    """Convert a price string (possibly comma separated) to a float for comparison."""
    cleaned = raw_price.replace(",", "").strip()
    if not cleaned:
        raise ValueError("가격 칸이 비어 있습니다.")
    return float(cleaned)


def load_rows(path: Path) -> tuple[Sequence[str], List[Dict[str, str]]]:
    with path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        reader = csv.DictReader(csv_file)
        if not reader.fieldnames:
            raise ValueError("CSV 헤더를 찾을 수 없습니다.")
        return reader.fieldnames, list(reader)


def write_rows(path: Path, headers: Sequence[str], rows: Sequence[Dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def keep_expensive_rice_rows(rows: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Return rows where duplicated 쌀 entries per 날짜 keep the highest-priced one."""
    rice_best_index: Dict[str, int] = {}
    rice_best_price: Dict[str, float] = {}

    for idx, row in enumerate(rows):
        if row.get(ITEM_COL) != TARGET_ITEM:
            continue
        date = row[DATE_COL]
        price = parse_price(row[PRICE_COL])
        best_price = rice_best_price.get(date)
        if best_price is None or price > best_price:
            rice_best_price[date] = price
            rice_best_index[date] = idx

    keep_indices = set(rice_best_index.values())
    filtered: List[Dict[str, str]] = []
    for idx, row in enumerate(rows):
        if row.get(ITEM_COL) != TARGET_ITEM or idx in keep_indices:
            filtered.append(row)

    return filtered


def main(argv: Sequence[str]) -> int:
    if len(argv) < 2:
        print(f"Usage: {argv[0]} <input_csv> [output_csv]")
        return 1

    input_path = Path(argv[1])
    if len(argv) > 2:
        output_path = Path(argv[2])
    else:
        output_path = input_path

    headers, rows = load_rows(input_path)
    filtered = keep_expensive_rice_rows(rows)
    write_rows(output_path, headers, filtered)

    removed = len(rows) - len(filtered)
    print(
        f"총 {len(rows)}개의 행 중 {TARGET_ITEM} 중복 {removed}건을 제거하고 "
        f"{output_path} 파일에 저장했습니다."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
