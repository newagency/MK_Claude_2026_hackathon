from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Query

from app.services.commodity_market import load_market_commodity_cards
from app.services.risk.pipeline import load_or_create_risk_snapshots

router = APIRouter()

UI_RISK_TO_CARD = {
    "stable": "low",
    "caution": "medium",
    "high": "high",
}


def _overlay_snapshot(base_card: dict, snapshot: dict) -> dict:
    risk_level = UI_RISK_TO_CARD.get(snapshot["risk_tier"], base_card.get("greedflation_risk", "low"))
    next_card = dict(base_card)
    next_card["riskScore"] = int(snapshot["risk_score"])
    next_card["greedflation_risk"] = risk_level
    next_card["risk_tier"] = snapshot["risk_tier"]
    next_card["action_policy_tier"] = snapshot["action_policy_tier"]
    next_card["score_breakdown"] = snapshot["score_breakdown"]
    next_card["trendSummary"] = snapshot.get("trend_summary") or snapshot["scm_risk_summary"] or base_card.get("note", "")
    next_card["note"] = next_card["trendSummary"]
    next_card["action_guides"] = snapshot["action_guides"]
    next_card["evidence_refs"] = snapshot["evidence_refs"]
    next_card["relevance_judgment_summary"] = snapshot.get("relevance_judgment_summary", "")
    next_card["relevance_version"] = snapshot.get("relevance_version", "")
    next_card["validation_issues"] = snapshot.get("validation_issues", [])
    next_card["analysis_versions"] = {
        "scorer_version": snapshot["scorer_version"],
        "policy_version": snapshot["policy_version"],
        "prompt_version": snapshot["prompt_version"],
        "relevance_version": snapshot.get("relevance_version", ""),
        "analysis_version": snapshot["analysis_version"],
        "trend_summary_prompt_version": snapshot.get("trend_summary_prompt_version", ""),
        "trend_summary_model": snapshot.get("trend_summary_model", ""),
    }
    return next_card


@router.get("/commodities")
def get_commodities_overview(
    date: date_type | None = Query(None, description="YYYY-MM-DD"),
):
    requested_date = date if isinstance(date, date_type) else None
    market_cards = load_market_commodity_cards(requested_date)
    if not market_cards:
        return []

    target_date = max((card.get("latest_date") or "" for card in market_cards), default="")
    snapshots = load_or_create_risk_snapshots(target_date) if target_date else []
    snapshot_by_code = {snapshot["commodity_id"]: snapshot for snapshot in snapshots}

    merged = []
    for card in market_cards:
        snapshot = snapshot_by_code.get(card["item_code"])
        merged.append(_overlay_snapshot(card, snapshot) if snapshot else card)

    return sorted(
        merged,
        key=lambda item: (
            -int(item.get("riskScore", 0)),
            -abs(float(item.get("price_delta_pct", 0))),
            item.get("item_name", ""),
        ),
    )
