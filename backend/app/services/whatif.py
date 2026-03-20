from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from typing import Dict, Optional

import psycopg2


DB_CFG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "sosang"),
    "user": os.getenv("DB_USER", "sosang"),
    "password": os.getenv("DB_PASSWORD", "sosang"),
}

BASE_MIN_WAGE = 9860  # 2024~2025 최저임금 (원)


COMMODITY_CONFIG = {
    "Egg": {"label": "계란", "item_name": "계란", "variety": "특란30구", "grade": "일반란"},
    "Pork": {"label": "돼지", "item_name": "돼지", "variety": "삼겹살", "grade": "삼겹살"},
    "Rice": {"label": "쌀", "item_name": "쌀", "variety": "20kg", "grade": "상품"},
    "Apple": {"label": "사과", "item_name": "사과", "variety": "후지", "grade": "상품"},
    "Salt": {"label": "천일염", "item_name": "천일염", "variety": "천일염", "grade": "상품"},
    "Garlic": {"label": "피마늘", "item_name": "피마늘", "variety": "난지(대서)", "grade": "상품"},
}


def _connect():
    return psycopg2.connect(**DB_CFG)


def _fetch_single_value(cur, query: str, params: tuple) -> Optional[float]:
    cur.execute(query, params)
    row = cur.fetchone()
    if not row:
        return None
    value = row[0]
    if value is None:
        return None
    return float(value)


def fetch_standard_prices(target_date: date) -> Dict[str, Optional[float]]:
    conn = _connect()
    cur = conn.cursor()
    prices: Dict[str, Optional[float]] = {}
    for key, meta in COMMODITY_CONFIG.items():
        price = _fetch_single_value(
            cur,
            """
            SELECT price_per_kg
            FROM standard_prices
            WHERE item_name = %s
              AND variety_name = %s
              AND grade_name = %s
              AND stat_date <= %s
            ORDER BY stat_date DESC
            LIMIT 1
            """,
            (meta["item_name"], meta["variety"], meta["grade"], target_date),
        )
        prices[key] = price
    cur.close()
    conn.close()
    return prices


def fetch_diesel_price(target_date: date) -> Optional[float]:
    conn = _connect()
    cur = conn.cursor()
    value = _fetch_single_value(
        cur,
        """
        SELECT avg_price
        FROM diesel_daily_prices
        WHERE price_date <= %s
        ORDER BY price_date DESC
        LIMIT 1
        """,
        (target_date,),
    )
    cur.close()
    conn.close()
    return value


def fetch_fx_rate(target_date: date) -> Optional[float]:
    conn = _connect()
    cur = conn.cursor()
    value = _fetch_single_value(
        cur,
        """
        SELECT base_rate
        FROM usd_daily_rates
        WHERE rate_date <= %s
        ORDER BY rate_date DESC
        LIMIT 1
        """,
        (target_date,),
    )
    cur.close()
    conn.close()
    return value


@dataclass
class BaselineData:
    target_date: date
    current_prices: Dict[str, Optional[float]]
    base_diesel: Optional[float]
    base_fx: Optional[float]
    base_wage: float = BASE_MIN_WAGE


def load_baseline(target_date: date) -> BaselineData:
    return BaselineData(
        target_date=target_date,
        current_prices=fetch_standard_prices(target_date),
        base_diesel=fetch_diesel_price(target_date),
        base_fx=fetch_fx_rate(target_date),
    )
