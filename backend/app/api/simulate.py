from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

# Baseline macro values (as of early 2026)
BASELINE_KRW = 1380.0   # USD/KRW
BASELINE_OIL = 75.0     # Brent crude (USD/barrel)

# Per-commodity sensitivity coefficients
# Each value = % cost change per 1% change in the macro variable
COMMODITIES = [
    {
        "name": "식용유",
        "base_monthly_cost": 180_000,
        "krw_sensitivity": 0.85,
        "oil_sensitivity": 0.40,
        "wage_sensitivity": 0.05,
        "driver": "환율 민감도 최상위 (100% 수입 의존)",
    },
    {
        "name": "밀가루",
        "base_monthly_cost": 120_000,
        "krw_sensitivity": 0.70,
        "oil_sensitivity": 0.30,
        "wage_sensitivity": 0.10,
        "driver": "흑해 물류 + 원/달러 환율 연동",
    },
    {
        "name": "닭고기",
        "base_monthly_cost": 350_000,
        "krw_sensitivity": 0.20,
        "oil_sensitivity": 0.25,
        "wage_sensitivity": 0.35,
        "driver": "국내 생산 주도, 인건비·사료비 연동",
    },
    {
        "name": "쌀",
        "base_monthly_cost": 80_000,
        "krw_sensitivity": 0.15,
        "oil_sensitivity": 0.20,
        "wage_sensitivity": 0.30,
        "driver": "정부 가격 통제, 국내 수급 안정",
    },
    {
        "name": "대파",
        "base_monthly_cost": 60_000,
        "krw_sensitivity": 0.10,
        "oil_sensitivity": 0.25,
        "wage_sensitivity": 0.20,
        "driver": "날씨·물류비 민감, 계절 변동 큼",
    },
]


class SimulateRequest(BaseModel):
    exchange_rate_krw: float = Field(default=1380.0, ge=1000, le=2000, description="USD/KRW 환율")
    oil_price_usd: float = Field(default=75.0, ge=30, le=200, description="브렌트유 (USD/배럴)")
    min_wage_change_pct: float = Field(default=0.0, ge=-10, le=30, description="최저임금 변동률 (%)")


@router.post("/simulate")
def simulate_impact(req: SimulateRequest):
    """
    Projects monthly ingredient cost changes based on macro variable shifts.
    Uses linear sensitivity coefficients calibrated to Korean food supply data.
    """
    krw_delta = (req.exchange_rate_krw - BASELINE_KRW) / BASELINE_KRW
    oil_delta = (req.oil_price_usd - BASELINE_OIL) / BASELINE_OIL
    wage_delta = req.min_wage_change_pct / 100

    results = []
    for c in COMMODITIES:
        impact = (
            c["krw_sensitivity"] * krw_delta
            + c["oil_sensitivity"] * oil_delta
            + c["wage_sensitivity"] * wage_delta
        )
        projected = int(c["base_monthly_cost"] * (1 + impact))
        results.append({
            "name": c["name"],
            "base_monthly_cost": c["base_monthly_cost"],
            "projected_monthly_cost": projected,
            "change_krw": projected - c["base_monthly_cost"],
            "change_pct": round(impact * 100, 1),
            "driver": c["driver"],
        })

    total_base = sum(c["base_monthly_cost"] for c in COMMODITIES)
    total_projected = sum(r["projected_monthly_cost"] for r in results)

    return {
        "inputs": {
            "exchange_rate_krw": req.exchange_rate_krw,
            "oil_price_usd": req.oil_price_usd,
            "min_wage_change_pct": req.min_wage_change_pct,
        },
        "commodities": results,
        "total_base_monthly": total_base,
        "total_projected_monthly": total_projected,
        "total_change_krw": total_projected - total_base,
        "total_change_pct": round((total_projected - total_base) / total_base * 100, 1),
    }
