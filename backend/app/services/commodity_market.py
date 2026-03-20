from __future__ import annotations

from collections import defaultdict
from datetime import date as date_type
import os

import psycopg2
from psycopg2.extras import RealDictCursor

from app.services.collectors.fair_price import PriceForensics

COMMODITY_META = {
    "egg": {
        "name": "계란",
        "db_name": "계란",
        "emoji": "🥚",
        "en": "Egg",
        "macro_weight": {"diesel": 0.7, "usd": 0.1},
    },
    "pork": {
        "name": "돼지",
        "db_name": "돼지",
        "emoji": "🐷",
        "en": "Pork",
        "macro_weight": {"diesel": 0.8, "usd": 0.1},
    },
    "apple": {
        "name": "사과",
        "db_name": "사과",
        "emoji": "🍎",
        "en": "Apple",
        "macro_weight": {"diesel": 0.6, "usd": 0.1},
    },
    "rice": {
        "name": "쌀",
        "db_name": "쌀",
        "emoji": "🌾",
        "en": "Rice",
        "macro_weight": {"diesel": 0.3, "usd": 0.0},
    },
    "salt": {
        "name": "천일염",
        "db_name": "천일염",
        "emoji": "🧂",
        "en": "Sea Salt",
        "macro_weight": {"diesel": 0.7, "usd": 0.2},
    },
    "garlic": {
        "name": "피마늘",
        "db_name": "피마늘",
        "emoji": "🧄",
        "en": "Garlic",
        "macro_weight": {"diesel": 0.6, "usd": 0.1},
    },
}

MAX_CHART_POINTS = 10


def _connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "sosang"),
        user=os.getenv("DB_USER", "sosang"),
        password=os.getenv("DB_PASSWORD", "sosang"),
    )


def _round(value: float, digits: int = 1) -> float:
    return round(float(value), digits)


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _pct_change(current: float, baseline: float) -> float:
    if not baseline:
        return 0.0
    return ((current - baseline) / baseline) * 100


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(value, high))


def resolve_target_date(requested_date: date_type | None) -> date_type | None:
    conn = _connect()
    cur = conn.cursor()
    if requested_date is None:
        cur.execute("SELECT MAX(stat_date) FROM standard_prices")
    else:
        cur.execute(
            "SELECT MAX(stat_date) FROM standard_prices WHERE stat_date <= %s",
            (requested_date,),
        )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row[0] if row else None


def _fetch_standard_prices(target_date: date_type) -> list[dict]:
    names = [meta["db_name"] for meta in COMMODITY_META.values()]

    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT stat_date, item_name, variety_name, grade_name, price_per_kg
        FROM standard_prices
        WHERE stat_date <= %s
          AND item_name = ANY(%s)
        ORDER BY item_name, stat_date
        """,
        (target_date, names),
    )
    rows = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def _fetch_macro_series(
    table_name: str, date_column: str, value_column: str, target_date: date_type
) -> list[dict]:
    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        f"""
        SELECT {date_column} AS stat_date, {value_column} AS value
        FROM {table_name}
        WHERE {date_column} <= %s
        ORDER BY {date_column}
        """,
        (target_date,),
    )
    rows = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def _build_macro_context(rows: list[dict]) -> dict:
    values = [float(row["value"]) for row in rows if row.get("value") is not None]
    if not values:
        return {"current": 0.0, "baseline": 0.0, "delta_pct": 0.0}

    current = values[-1]
    baseline_window = values[-30:] if len(values) >= 30 else values
    baseline = _mean(baseline_window)
    return {
        "current": _round(current, 2),
        "baseline": _round(baseline, 2),
        "delta_pct": _round(_pct_change(current, baseline), 1),
    }


def _compress_series(entries: list[dict], max_points: int = MAX_CHART_POINTS) -> list[dict]:
    if len(entries) <= max_points:
        return entries

    last_index = len(entries) - 1
    indexes = []
    for i in range(max_points):
        idx = round((last_index * i) / (max_points - 1))
        if not indexes or idx != indexes[-1]:
            indexes.append(idx)

    if indexes[-1] != last_index:
        indexes[-1] = last_index

    return [entries[idx] for idx in indexes]


def _normalize_rocket_feather(analysis: dict) -> dict:
    return {
        "isFeather": bool(analysis.get("is_feather")),
        "upVelocity": float(analysis.get("up_velocity", 0)),
        "downVelocity": float(analysis.get("down_velocity", 0)),
        "asymmetryRatio": float(analysis.get("asymmetry_ratio", 1)),
    }


def _infer_trend_direction(delta_pct: float, momentum_pct: float, volatility_pct: float) -> str:
    if volatility_pct >= 12 and abs(momentum_pct) < 4:
        return "unstable"
    if momentum_pct >= 2 or delta_pct >= 5:
        return "up"
    if momentum_pct <= -2 or delta_pct <= -5:
        return "down"
    return "unstable"


def _score_market_risk(
    *,
    delta_pct: float,
    momentum_pct: float,
    volatility_pct: float,
    rocket_feather: dict,
    diesel_context: dict,
    usd_context: dict,
    macro_weight: dict,
) -> int:
    score = 22.0
    score += min(35.0, max(0.0, delta_pct) * 1.7)
    score += min(14.0, max(0.0, momentum_pct) * 0.9)
    score += min(12.0, max(0.0, volatility_pct) * 0.6)
    score += max(0.0, diesel_context["delta_pct"]) * 0.9 * macro_weight["diesel"]
    score += max(0.0, usd_context["delta_pct"]) * 0.8 * macro_weight["usd"]

    if rocket_feather["isFeather"]:
        score += 8.0

    if delta_pct < 0:
        score -= min(10.0, abs(delta_pct) * 0.5)
    if momentum_pct < 0:
        score -= min(8.0, abs(momentum_pct) * 0.3)

    return int(round(_clamp(score, 8, 98)))


def _risk_level_from(score: int, delta_pct: float) -> str:
    if score >= 75 or delta_pct >= 18:
        return "high"
    if score >= 45 or delta_pct >= 6:
        return "medium"
    return "low"


def _build_summary(
    *,
    commodity_name: str,
    avg_reference_price: float,
    delta_pct: float,
    trend_direction: str,
    volatility_pct: float,
    diesel_context: dict,
    usd_context: dict,
    macro_weight: dict,
) -> str:
    if delta_pct > 0:
        base = (
            f"{commodity_name} 가격은 기준 평균 {int(avg_reference_price):,}원 대비 "
            f"{abs(delta_pct):.1f}% 높은 수준입니다."
        )
    elif delta_pct < 0:
        base = (
            f"{commodity_name} 가격은 기준 평균 {int(avg_reference_price):,}원 대비 "
            f"{abs(delta_pct):.1f}% 낮은 수준입니다."
        )
    else:
        base = f"{commodity_name} 가격은 기준 평균 {int(avg_reference_price):,}원과 유사한 수준입니다."

    flow = {
        "up": "최근 흐름은 완만한 상승세가 이어지고 있습니다.",
        "down": "최근 흐름은 조정 국면에 가깝습니다.",
        "unstable": "최근 흐름은 단기 변동성이 큰 편입니다.",
    }[trend_direction]

    macro_parts = []
    if macro_weight["diesel"] > 0 and diesel_context["delta_pct"] >= 2:
        macro_parts.append(
            f"경유 평균가가 최근 기준보다 {diesel_context['delta_pct']:.1f}% 높아 물류비 부담이 남아 있습니다."
        )
    if macro_weight["usd"] > 0 and usd_context["delta_pct"] >= 1:
        macro_parts.append(
            f"달러 환율도 최근 기준보다 {usd_context['delta_pct']:.1f}% 높아 외생 원가 압력이 있습니다."
        )
    if not macro_parts and volatility_pct >= 10:
        macro_parts.append("급격한 가격 흔들림이 있는 구간이라 발주 시점을 나눠 보는 편이 안전합니다.")
    if not macro_parts:
        macro_parts.append("외부 비용 변수는 비교적 안정적이지만 단기 시세 변화는 계속 확인해야 합니다.")

    return " ".join([base, flow, *macro_parts])


def _serialize_trend(entries: list[dict]) -> list[dict]:
    compressed = _compress_series(entries)
    return [
        {
            "date": entry["stat_date"].isoformat(),
            "price": float(entry["price_per_kg"]),
        }
        for entry in compressed
    ]


def _build_commodity_payload(
    *, code: str, meta: dict, entries: list[dict], diesel_context: dict, usd_context: dict
) -> dict:
    latest = entries[-1]
    current_price = float(latest["price_per_kg"])
    reference_prices = [float(entry["price_per_kg"]) for entry in entries]
    avg_reference_price = _mean(reference_prices)
    delta_pct = _round(_pct_change(current_price, avg_reference_price), 1)

    comparison_index = max(0, len(entries) - 29)
    comparison_price = float(entries[comparison_index]["price_per_kg"])
    momentum_pct = _round(_pct_change(current_price, comparison_price), 1)

    recent_window = reference_prices[-30:] if len(reference_prices) >= 30 else reference_prices
    volatility_pct = _round(
        _pct_change(max(recent_window), _mean(recent_window)) if recent_window else 0.0,
        1,
    )

    rocket_raw = PriceForensics.detect_rocket_feather(
        [{"avg_price_current": float(entry["price_per_kg"])} for entry in entries[-90:]]
    )
    rocket_feather = _normalize_rocket_feather(rocket_raw)

    risk_score = _score_market_risk(
        delta_pct=delta_pct,
        momentum_pct=momentum_pct,
        volatility_pct=volatility_pct,
        rocket_feather=rocket_feather,
        diesel_context=diesel_context,
        usd_context=usd_context,
        macro_weight=meta["macro_weight"],
    )
    risk_level = _risk_level_from(risk_score, delta_pct)
    trend_direction = _infer_trend_direction(delta_pct, momentum_pct, volatility_pct)
    summary = _build_summary(
        commodity_name=meta["name"],
        avg_reference_price=avg_reference_price,
        delta_pct=delta_pct,
        trend_direction=trend_direction,
        volatility_pct=volatility_pct,
        diesel_context=diesel_context,
        usd_context=usd_context,
        macro_weight=meta["macro_weight"],
    )

    return {
        "item_code": code,
        "item_name": meta["name"],
        "emoji": meta["emoji"],
        "en_name": meta["en"],
        "unit": "kg 환산",
        "subLabel": f"{latest['variety_name']} · {latest['grade_name']}",
        "current_price": round(current_price),
        "avg_3year": int(round(avg_reference_price)),
        "price_delta_pct": delta_pct,
        "greedflation_risk": risk_level,
        "riskScore": risk_score,
        "trendDirection": trend_direction,
        "rocket_feather": rocket_raw,
        "rocketFeather": rocket_feather,
        "trend": _serialize_trend(entries),
        "note": summary,
        "latest_date": latest["stat_date"].isoformat(),
        "market_context": {
            "current_price": round(current_price),
            "avg_reference_price": int(round(avg_reference_price)),
            "delta_pct": delta_pct,
            "momentum_pct": momentum_pct,
            "volatility_pct": volatility_pct,
            "diesel": diesel_context,
            "usd": usd_context,
        },
        "macro_context": {
            "diesel": diesel_context,
            "usd": usd_context,
        },
    }


def load_market_commodity_cards(requested_date: date_type | None) -> list[dict]:
    target_date = resolve_target_date(requested_date)
    if target_date is None:
        return []

    price_rows = _fetch_standard_prices(target_date)
    if not price_rows:
        return []

    diesel_context = _build_macro_context(
        _fetch_macro_series("diesel_daily_prices", "price_date", "avg_price", target_date)
    )
    usd_context = _build_macro_context(
        _fetch_macro_series("usd_daily_rates", "rate_date", "base_rate", target_date)
    )

    groups: dict[str, list] = defaultdict(list)
    for row in price_rows:
        groups[row["item_name"]].append(row)

    result = []
    for code, meta in COMMODITY_META.items():
        entries = groups.get(meta["db_name"], [])
        if not entries:
            continue
        result.append(
            _build_commodity_payload(
                code=code,
                meta=meta,
                entries=entries,
                diesel_context=diesel_context,
                usd_context=usd_context,
            )
        )

    return sorted(
        result,
        key=lambda item: (
            -int(item["riskScore"]),
            -abs(float(item["price_delta_pct"])),
            item["item_name"],
        ),
    )
