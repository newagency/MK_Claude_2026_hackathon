from __future__ import annotations

import json
import os

from anthropic import Anthropic

from app.services.risk.config import (
    PRICE_LOOKBACK_WINDOW_DAYS,
    TREND_SUMMARY_MODEL,
    TREND_SUMMARY_PROMPT_VERSION,
)


def _fallback_summary(*, commodity_name: str, risk_tier: str, market_context: dict, evidence_rows: list[dict]) -> str:
    current_price = int(round(float(market_context.get("current_price", 0))))
    delta_pct = float(market_context.get("delta_pct", 0))
    momentum_pct = float(market_context.get("momentum_pct", 0))
    if delta_pct > 0:
        base = f"{commodity_name} 가격은 최근 기준 대비 {abs(delta_pct):.1f}% 높은 수준이며 현재 {current_price:,}원입니다."
    elif delta_pct < 0:
        base = f"{commodity_name} 가격은 최근 기준 대비 {abs(delta_pct):.1f}% 낮은 수준이며 현재 {current_price:,}원입니다."
    else:
        base = f"{commodity_name} 가격은 최근 기준과 유사하며 현재 {current_price:,}원입니다."

    if evidence_rows:
        first = evidence_rows[0]
        evidence_sentence = f"관련 기사에서는 {first['commodity_name']}에 대해 {first['signal_type']} 신호가 확인됐습니다."
    else:
        evidence_sentence = "관련 기사 근거는 제한적이어서 가격 흐름 중심으로 해석했습니다."

    tone = {
        "stable": "전반적으로 안정 구간으로 보이지만 단기 변동은 계속 확인해야 합니다.",
        "caution": "주의 구간이라 공급처 단가와 발주 타이밍을 함께 점검하는 편이 안전합니다.",
        "high": "고위험 구간으로 보고 공급 차질과 단가 변동을 선제적으로 확인할 필요가 있습니다.",
    }[risk_tier]
    if abs(momentum_pct) >= 5:
        tone = f"최근 {PRICE_LOOKBACK_WINDOW_DAYS}일 기준 변화율도 {momentum_pct:.1f}%로 커서 {tone}"

    return " ".join([base, evidence_sentence, tone])


def generate_trend_summary(
    *,
    commodity_name: str,
    page_date: str,
    risk_score: int,
    risk_tier: str,
    market_context: dict,
    evidence_rows: list[dict],
) -> tuple[str, str, str]:
    prompt_payload = {
        "page_date": page_date,
        "commodity_name": commodity_name,
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "price_context": {
            "current_price": market_context.get("current_price"),
            "avg_reference_price": market_context.get("avg_reference_price"),
            "delta_pct": market_context.get("delta_pct"),
            "momentum_pct": market_context.get("momentum_pct"),
            "volatility_pct": market_context.get("volatility_pct"),
            "lookback_days": PRICE_LOOKBACK_WINDOW_DAYS,
        },
        "evidence": [
            {
                "title": row.get("article_title", ""),
                "summary": row.get("article_summary", ""),
                "signal_type": row.get("signal_type", ""),
                "signal_stage": row.get("signal_stage", ""),
                "relevance_score": row.get("relevance_score", 0),
            }
            for row in evidence_rows
        ],
    }

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return (
            _fallback_summary(
                commodity_name=commodity_name,
                risk_tier=risk_tier,
                market_context=market_context,
                evidence_rows=evidence_rows,
            ),
            "fallback",
            TREND_SUMMARY_PROMPT_VERSION,
        )

    system = """
당신은 소상공인 식재료 카드용 trend summary 작성기다.
입력된 가격 요약과 선별된 관련 기사만 보고, 카드에 들어갈 짧은 한국어 요약 1~3문장을 작성하라.
규칙:
- 입력에 없는 사실을 추가하지 말 것
- stable이면 과도한 위기 표현 금지
- high면 위험이 보이지 않게 완화하지 말 것
- 기사 원문을 장황하게 복사하지 말고 핵심만 요약
- 출력은 평문 문자열만
"""
    try:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=TREND_SUMMARY_MODEL,
            max_tokens=220,
            system=system,
            messages=[{"role": "user", "content": json.dumps(prompt_payload, ensure_ascii=False)}],
        )
        content = response.content[0].text.strip()
        if content:
            return content, TREND_SUMMARY_MODEL, TREND_SUMMARY_PROMPT_VERSION
    except Exception:
        pass

    return (
        _fallback_summary(
            commodity_name=commodity_name,
            risk_tier=risk_tier,
            market_context=market_context,
            evidence_rows=evidence_rows,
        ),
        "fallback",
        TREND_SUMMARY_PROMPT_VERSION,
    )
