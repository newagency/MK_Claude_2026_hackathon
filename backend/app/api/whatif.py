from __future__ import annotations

import json
import logging
from datetime import date
from typing import Dict, List, Optional

from anthropic import Anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.whatif import (
    COMMODITY_CONFIG,
    load_baseline,
    BASE_MIN_WAGE,
)

router = APIRouter()
logger = logging.getLogger(__name__)

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


@router.get("/what-if/baseline")
def get_baseline(date: date):
    baseline = load_baseline(date)
    if baseline.base_diesel is None or baseline.base_fx is None:
        raise HTTPException(status_code=404, detail="해당 날짜의 기준 유가/환율 데이터를 찾을 수 없습니다.")
    return {
        "target_date": date.strftime("%Y-%m-%d"),
        "exchange_rate_krw": baseline.base_fx,
        "oil_price_krw": baseline.base_diesel,
        "min_wage": baseline.base_wage,
        "commodities": {k: v for k, v in baseline.current_prices.items() if v is not None},
    }


def _build_prompt(
    target_date: str,
    base_diesel: float,
    base_fx: float,
    base_wage: float,
    current_prices: Dict[str, float],
    oil_delta_pct: float,
    fx_delta_pct: float,
    wage_delta_pct: float,
) -> str:
    return f"""
# Role: Expert Economic Analyst & Commodity Price Predictor

# Context:
You are analyzing the South Korean food commodity market based on 2025 historical data. 
Your task is to predict price changes when the user adjusts "Oil Prices", "Exchange Rates (USD/KRW)", and "Minimum Wage" via a dashboard toolbar.

# Baseline Data (Reference Point: {target_date}):
- Reference Diesel Price: {base_diesel} KRW
- Reference FX Rate (USD/KRW): {base_fx} KRW
- Reference Minimum Wage: {base_wage} KRW
- Current Market Prices: {current_prices}

# Sensitivity Matrix (Derived from Regression Analysis):
The following coefficients represent the % change in item price for every 1% change in the factor.
- Egg: {{ "oil": 0.12, "fx": 0.45, "wage": 0.15 }}
- Pork: {{ "oil": 0.10, "fx": 0.65, "wage": 0.25 }}
- Rice: {{ "oil": 0.15, "fx": 0.10, "wage": 0.20 }}
- Apple: {{ "oil": 0.60, "fx": 0.20, "wage": 0.40 }}
- Salt: {{ "oil": 0.35, "fx": 0.05, "wage": 0.60 }}
- Garlic: {{ "oil": 0.25, "fx": 0.40, "wage": 0.55 }}

# Calculation Logic:
Predicted_Price = Base_Price * (1 + (Oil_Delta * oil_sens) + (FX_Delta * fx_sens) + (Wage_Delta * wage_sens))
*Delta = (New_Value - Base_Value) / Base_Value

# User Input (Toolbar Adjustments):
- Oil Price Change: {oil_delta_pct}%
- FX Rate Change: {fx_delta_pct}%
- Minimum Wage Change: {wage_delta_pct}%

# Instructions:
1. Apply the formula to each commodity based on the User Input.
2. Provide a brief economic rationale (1-2 sentences) for the overall trend.
3. Return the result STRICTLY in the following JSON format for bar chart visualization.

# Output Format (JSON):
{{
  "summary": "Brief explanation of why prices moved this way in Korean.",
  "data": [
    {{ "item": "Egg", "base": {current_prices.get('Egg', 0)}, "predicted": 0, "change_percent": 0.0 }},
    {{ "item": "Pork", "base": {current_prices.get('Pork', 0)}, "predicted": 0, "change_percent": 0.0 }},
    {{ "item": "Rice", "base": {current_prices.get('Rice', 0)}, "predicted": 0, "change_percent": 0.0 }},
    {{ "item": "Apple", "base": {current_prices.get('Apple', 0)}, "predicted": 0, "change_percent": 0.0 }},
    {{ "item": "Salt", "base": {current_prices.get('Salt', 0)}, "predicted": 0, "change_percent": 0.0 }},
    {{ "item": "Garlic", "base": {current_prices.get('Garlic', 0)}, "predicted": 0, "change_percent": 0.0 }}
  ]
}}
"""


def _call_claude(prompt: str) -> Optional[dict]:
    client = Anthropic()
    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            start = raw.find("{")
            end = raw.rfind("}")
            if start != -1 and end != -1 and end > start:
                candidate = raw[start : end + 1]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass
            logger.warning("Claude output parse failed: %s", raw[:200])
            return None
    except Exception as exc:
        logger.warning("Claude call failed: %s", exc)
        return None


def _fallback_predictions(
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

    current_prices = {k: v for k, v in baseline.current_prices.items() if v is not None}
    if not current_prices:
        raise HTTPException(status_code=400, detail="해당 날짜에 대한 표준 가격 정보가 없습니다.")

    prompt = _build_prompt(
        target_date=req.target_date.strftime("%Y-%m-%d"),
        base_diesel=round(baseline.base_diesel, 2),
        base_fx=round(baseline.base_fx, 2),
        base_wage=BASE_MIN_WAGE,
        current_prices=current_prices,
        oil_delta_pct=round(oil_delta * 100, 2),
        fx_delta_pct=round(fx_delta * 100, 2),
        wage_delta_pct=req.min_wage_change_pct,
    )

    claude_result = _call_claude(prompt)
    if claude_result and "data" in claude_result:
        predictions = []
        for entry in claude_result["data"]:
            item_key = entry.get("item")
            base_price = current_prices.get(item_key)
            if base_price is None:
                continue
            predictions.append(
                {
                    "item": item_key,
                    "label": COMMODITY_CONFIG.get(item_key, {}).get("label", item_key),
                    "base": round(base_price, 2),
                    "predicted": entry.get("predicted", base_price),
                    "change_percent": entry.get("change_percent", 0),
                }
            )
        summary = claude_result.get("summary")
    else:
        predictions = _fallback_predictions(baseline.current_prices, oil_delta, fx_delta, wage_delta)
        summary = "LLM 호출 실패로 회귀 분석 기반 추정치를 사용했습니다."

    if not predictions:
        raise HTTPException(status_code=400, detail="LLM 결과를 해석할 수 없습니다.")

    total_base = sum(item["base"] for item in predictions)
    total_pred = sum(item["predicted"] for item in predictions)
    total_change_pct = ((total_pred - total_base) / total_base) * 100 if total_base else 0

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
