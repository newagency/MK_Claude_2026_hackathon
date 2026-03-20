from __future__ import annotations

from app.services.risk.config import (
    ACTION_POLICY_THRESHOLDS,
    COMMODITY_REGISTRY,
    POLICY_TO_UI_TIER,
    SCORE_WEIGHTS,
    STAGE_CRITICALITY,
    UI_TIER_THRESHOLDS,
)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(value, high))


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _normalize(value: float, scale: float) -> float:
    if scale <= 0:
        return 0.0
    return _clamp(value / scale, 0.0, 1.0)


def _extract_feature_vector(
    *,
    commodity_code: str,
    matches: list[dict],
    brief: dict | None,
    market_card: dict,
) -> dict:
    registry = COMMODITY_REGISTRY[commodity_code]
    exposure = registry["store_exposure"]
    dependency = exposure["dependency"]
    usage_frequency = exposure["usage_frequency"]
    substitutability = exposure["substitutability"]
    store_exposure = _clamp((dependency * 0.45) + (usage_frequency * 0.35) + ((1 - substitutability) * 0.20), 0.0, 1.0)

    signals = (brief or {}).get("signals", [])
    direct_count = sum(1 for signal in signals if signal.get("signal_type") == "direct")
    proxy_count = sum(1 for signal in signals if signal.get("signal_type") == "proxy")
    total_signal_count = direct_count + proxy_count
    signal_directness = direct_count / total_signal_count if total_signal_count else 0.0

    stage_scores = [
        STAGE_CRITICALITY.get(signal.get("scm_stage"), 0.25)
        for signal in signals
    ]
    supply_stage_criticality = max(stage_scores) if stage_scores else 0.25

    corroboration_count = _normalize(len({match.get("article_id") for match in matches if match.get("article_id")}), 4)
    source_confidence = _clamp(0.35 + (corroboration_count * 0.35) + (0.15 if signals else 0.0), 0.20, 0.95)
    recency_decay = 1.0

    severity_scores = [float(match.get("severity", 0)) for match in matches]
    severity = _normalize(_mean(severity_scores), 10.0)

    price_delta = abs(float(market_card.get("price_delta_pct", 0)))
    volatility_pct = abs(float((market_card.get("market_context") or {}).get("volatility_pct", 0)))
    price_confirmation = _clamp((price_delta / 15.0) * 0.7 + (volatility_pct / 25.0) * 0.3, 0.0, 1.0)

    if not matches and price_confirmation < 0.45:
        source_confidence = min(source_confidence, 0.35)
        severity = min(severity, 0.20)

    return {
        "signal_directness": round(signal_directness, 4),
        "source_confidence": round(source_confidence, 4),
        "recency_decay": round(recency_decay, 4),
        "corroboration_count": round(corroboration_count, 4),
        "price_confirmation": round(price_confirmation, 4),
        "supply_stage_criticality": round(supply_stage_criticality, 4),
        "store_exposure": round(store_exposure, 4),
        "severity": round(severity, 4),
    }


def _compute_score_breakdown(feature_vector: dict) -> dict:
    contributions = {}
    total = 0.0
    for feature_name, raw_value in feature_vector.items():
        weight = SCORE_WEIGHTS[feature_name]
        contribution = round(raw_value * weight * 100, 2)
        contributions[feature_name] = {
            "raw": raw_value,
            "weight": weight,
            "contribution": contribution,
        }
        total += contribution

    proxy_only = feature_vector["signal_directness"] == 0.0 and feature_vector["severity"] < 0.45
    if proxy_only:
        total = min(total, 42.0)

    if (
        feature_vector["signal_directness"] >= 0.6
        and feature_vector["corroboration_count"] >= 0.5
        and feature_vector["store_exposure"] >= 0.55
    ):
        total = max(total, 72.0)

    total = round(_clamp(total, 0.0, 100.0), 2)
    return {
        "features": contributions,
        "total": total,
    }


def _risk_tier_from_score(score: float) -> str:
    if score <= UI_TIER_THRESHOLDS["stable_max"]:
        return "stable"
    if score <= UI_TIER_THRESHOLDS["caution_max"]:
        return "caution"
    return "high"


def _policy_tier_from_score(score: float) -> str:
    if score <= ACTION_POLICY_THRESHOLDS["T0"]:
        return "T0"
    if score <= ACTION_POLICY_THRESHOLDS["T1"]:
        return "T1"
    if score <= ACTION_POLICY_THRESHOLDS["T2"]:
        return "T2"
    if score <= ACTION_POLICY_THRESHOLDS["T3"]:
        return "T3"
    return "T4"


def _merge_ui_tiers(score_tier: str, policy_tier: str) -> str:
    tier_order = {"stable": 0, "caution": 1, "high": 2}
    policy_ui_tier = POLICY_TO_UI_TIER[policy_tier]
    return score_tier if tier_order[score_tier] >= tier_order[policy_ui_tier] else policy_ui_tier


def _default_action_guides(commodity_name: str, policy_tier: str) -> list[dict]:
    urgency = "모니터링" if policy_tier == "T2" else "1주내" if policy_tier == "T3" else "즉시"
    return [
        {
            "title": "공급처 단가 확인",
            "content": f"{commodity_name} 최근 단가와 다음 발주 리드타임을 공급처에 다시 확인하세요.",
            "urgency": urgency,
        },
        {
            "title": "재고 소진 속도 점검",
            "content": f"{commodity_name} 현재 재고와 일평균 사용량을 비교해 선발주 필요 여부를 판단하세요.",
            "urgency": urgency,
        },
        {
            "title": "대체 규격 검토",
            "content": f"{commodity_name} 규격 변경이나 발주 분산으로 단기 변동 리스크를 줄일 수 있는지 점검하세요.",
            "urgency": "모니터링" if policy_tier == "T2" else urgency,
        },
    ]


def _action_guides_for(policy_tier: str, brief: dict | None, commodity_name: str) -> list[dict]:
    if policy_tier in {"T0", "T1"}:
        return []
    action_items = list((brief or {}).get("action_items", []))[:3]
    return action_items if action_items else _default_action_guides(commodity_name, policy_tier)


def _validation_issues(risk_tier: str, action_guides: list[dict], risk_score: int, policy_tier: str) -> list[str]:
    issues = []
    if risk_tier == "stable" and action_guides:
        issues.append("stable_tier_has_action_guides")
    if risk_tier == "high" and not action_guides:
        issues.append("high_tier_missing_action_guides")
    if risk_score >= 70 and policy_tier in {"T0", "T1"}:
        issues.append("high_score_with_low_policy_tier")
    if risk_score <= 39 and policy_tier in {"T3", "T4"}:
        issues.append("low_score_with_high_policy_tier")
    return issues


def score_market_sensitive_snapshot(
    *,
    page_date: str,
    commodity_code: str,
    commodity_name: str,
    commodity_type: str,
    brief: dict | None,
    matches: list[dict],
    market_card: dict,
    store_profile_key: str,
    store_context_hash: str,
    scorer_version: str,
    policy_version: str,
    prompt_version: str,
    analysis_version: str,
    source_window_days: int,
) -> dict:
    feature_vector = _extract_feature_vector(
        commodity_code=commodity_code,
        matches=matches,
        brief=brief,
        market_card=market_card,
    )
    score_breakdown = _compute_score_breakdown(feature_vector)
    risk_score = int(round(score_breakdown["total"]))
    score_tier = _risk_tier_from_score(risk_score)
    policy_tier = _policy_tier_from_score(risk_score)
    risk_tier = _merge_ui_tiers(score_tier, policy_tier)

    evidence_refs = [
        {
            "article_id": match.get("article_id"),
            "title": match.get("title", ""),
            "impact": match.get("impact", "unstable"),
            "severity": match.get("severity", 0),
            "reason": match.get("reason", ""),
        }
        for match in matches[:8]
    ]

    signal_snapshot = list((brief or {}).get("signals", []))
    action_guides = _action_guides_for(policy_tier, brief, commodity_name)
    scm_risk_summary = (
        (brief or {}).get("trend_summary")
        or market_card.get("note")
        or f"{commodity_name} 관련 공급망 신호가 제한적이어서 관찰 중심으로 판단했습니다."
    )
    validation_issues = _validation_issues(risk_tier, action_guides, risk_score, policy_tier)

    return {
        "page_date": page_date,
        "commodity_id": commodity_code,
        "commodity_name": commodity_name,
        "commodity_lane": COMMODITY_REGISTRY[commodity_code]["lane"],
        "commodity_type": commodity_type,
        "risk_score": risk_score,
        "risk_tier": risk_tier,
        "action_policy_tier": policy_tier,
        "score_breakdown": score_breakdown,
        "action_guides": action_guides,
        "scm_risk_summary": scm_risk_summary,
        "evidence_refs": evidence_refs,
        "signal_snapshot": signal_snapshot,
        "related_article_ids": [match.get("article_id") for match in matches if match.get("article_id")],
        "store_profile_key": store_profile_key,
        "store_context_hash": store_context_hash,
        "scorer_version": scorer_version,
        "policy_version": policy_version,
        "prompt_version": prompt_version,
        "analysis_version": analysis_version,
        "source_window_days": source_window_days,
        "validation_issues": validation_issues,
    }


def snapshot_to_brief(snapshot: dict) -> dict:
    tier_label = {
        "stable": "안정",
        "caution": "주의",
        "high": "고위험",
    }[snapshot["risk_tier"]]
    return {
        "commodity_code": snapshot["commodity_id"],
        "commodity_name": snapshot["commodity_name"],
        "date": snapshot["page_date"],
        "trend_summary": snapshot.get("trend_summary") or snapshot["scm_risk_summary"],
        "signals": snapshot.get("signal_snapshot", []),
        "risk_tier": {
            "tier": snapshot["action_policy_tier"],
            "label": tier_label,
            "reason": f"설명 가능한 score {snapshot['risk_score']}점과 정책 {snapshot['action_policy_tier']} 기준으로 판정했습니다.",
        },
        "action_items": snapshot.get("action_guides", []),
        "greedflation_flag": False,
        "greedflation_note": "해당없음",
        "related_article_ids": snapshot.get("related_article_ids", []),
        "risk_score": snapshot["risk_score"],
        "ui_risk_tier": snapshot["risk_tier"],
        "score_breakdown": snapshot.get("score_breakdown", {}),
        "relevance_judgment_summary": snapshot.get("relevance_judgment_summary", ""),
        "analysis_versions": {
            "scorer_version": snapshot.get("scorer_version", ""),
            "policy_version": snapshot.get("policy_version", ""),
            "prompt_version": snapshot.get("prompt_version", ""),
            "relevance_version": snapshot.get("relevance_version", ""),
            "analysis_version": snapshot.get("analysis_version", ""),
            "trend_summary_prompt_version": snapshot.get("trend_summary_prompt_version", ""),
            "trend_summary_model": snapshot.get("trend_summary_model", ""),
        },
        "validation_issues": snapshot.get("validation_issues", []),
    }
