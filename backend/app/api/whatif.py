from __future__ import annotations

from datetime import date
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.whatif import (
    COMMODITY_CONFIG,
    load_baseline,
)

router = APIRouter()

SENSITIVITY_MATRIX: Dict[str, Dict[str, float]] = {
    "Egg": {"oil": 0.12, "fx": 0.45, "wage": 0.15},
    "Pork": {"oil": 0.10, "fx": 0.65, "wage": 0.25},
    "Rice": {"oil": 0.15, "fx": 0.10, "wage": 0.20},
    "Apple": {"oil": 0.60, "fx": 0.20, "wage": 0.40},
    "Salt": {"oil": 0.35, "fx": 0.05, "wage": 0.60},
    "Garlic": {"oil": 0.25, "fx": 0.40, "wage": 0.55},
}


class WhatIfRequest(BaseModel):
    target_date: date
    exchange_rate_krw: float = Field(..., ge=500, le=3000, description="USD/KRW 환율")
    oil_price_usd: float = Field(..., ge=200, le=3000, description="국내 경유 가격 (KRW/L)")
    min_wage_change_pct: float = Field(..., ge=-20, le=50, description="최저임금 변동률 (%)")


def _compute_summary(total_change_pct: float, oil_delta: float, fx_delta: float, wage_delta: float) -> str:
    trending = "상승" if total_change_pct > 0 else "하락" if total_change_pct < 0 else "보합"
    drivers = []
    if abs(oil_delta) > 0.01:
        drivers.append("유가")
    if abs(fx_delta) > 0.01:
        drivers.append("환율")
    if abs(wage_delta) > 0.01:
        drivers.append("인건비")

    if not drivers:
        return "거시 변수 변동이 거의 없어 가격이 큰 폭으로 움직이지 않을 것으로 예상됩니다."

    if total_change_pct > 0:
        return f"{', '.join(drivers)} 상승 영향으로 대부분 품목 가격이 {trending}할 전망입니다."
    if total_change_pct < 0:
        return f"{', '.join(drivers)} 하락 영향으로 비용 압력이 완화되어 가격이 {trending}세입니다."
    return "상반된 변수 영향이 상쇄되어 전체 가격 수준은 보합세를 보일 전망입니다."


def _calculate_predictions(
    baseline_prices: Dict[str, float | None],
    oil_delta: float,
    fx_delta: float,
    wage_delta: float,
) -> List[Dict[str, float | str]]:
    predictions = []
    for key, sens in SENSITIVITY_MATRIX.items():
        base_price = baseline_prices.get(key)
        if base_price is None:
            continue
        total_pct = (
            oil_delta * sens["oil"]
            + fx_delta * sens["fx"]
            + wage_delta * sens["wage"]
        )
        predicted = round(base_price * (1 + total_pct), 2)
        predictions.append(
            {
                "item": key,
                "label": COMMODITY_CONFIG[key]["label"],
                "base": round(base_price, 2),
                "predicted": predicted,
                "change_percent": round(total_pct * 100, 2),
            }
        )
    return predictions


@router.post("/what-if")
def run_what_if(req: WhatIfRequest):
    baseline = load_baseline(req.target_date)
    if baseline.base_diesel is None or baseline.base_fx is None:
        raise HTTPException(status_code=400, detail="선택한 날짜에 대한 유가/환율 정보가 부족합니다.")

    oil_delta = (req.oil_price_usd - baseline.base_diesel) / baseline.base_diesel
    fx_delta = (req.exchange_rate_krw - baseline.base_fx) / baseline.base_fx
    wage_delta = req.min_wage_change_pct / 100

    predictions = _calculate_predictions(baseline.current_prices, oil_delta, fx_delta, wage_delta)
    if not predictions:
        raise HTTPException(status_code=400, detail="해당 날짜에 대한 표준 가격 정보가 없습니다.")

    total_base = sum(item["base"] for item in predictions)
    total_pred = sum(item["predicted"] for item in predictions)
    total_change_pct = ((total_pred - total_base) / total_base) * 100 if total_base else 0

    summary = _compute_summary(total_change_pct, oil_delta, fx_delta, wage_delta)
    current_prices = {k: v for k, v in baseline.current_prices.items() if v is not None}

    prompt_context = {
        "target_date": req.target_date.strftime("%Y-%m-%d"),
        "base_diesel": round(baseline.base_diesel, 2),
        "base_fx": round(baseline.base_fx, 2),
        "base_wage": baseline.base_wage,
        "current_prices": current_prices,
    }
    # Placeholder for future Claude API integration.
    _ = prompt_context  # suppress lint warnings until real API call is wired

    return {
        "summary": summary,
        "data": predictions,
        "meta": {
            "target_date": req.target_date.strftime("%Y-%m-%d"),
            "base_diesel": baseline.base_diesel,
            "base_fx": baseline.base_fx,
            "base_wage": baseline.base_wage,
            "oil_delta": oil_delta,
            "fx_delta": fx_delta,
            "wage_delta": wage_delta,
        },
        "total_change_pct": round(total_change_pct, 2),
        "total_base": round(total_base, 2),
        "total_predicted": round(total_pred, 2),
    }
