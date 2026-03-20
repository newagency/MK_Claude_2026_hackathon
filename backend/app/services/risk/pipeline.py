from __future__ import annotations

from datetime import date as date_type

from app.services.commodity_market import load_market_commodity_cards
from app.services.llm.briefing import generate_briefs
from app.services.llm.trend_summary import generate_trend_summary
from app.services.news.fetcher import fetch_news_by_date, filter_relevant
from app.services.news.relevance import (
    aggregate_daily_matches,
    load_or_create_relevance_rows,
    summarize_relevance_judgment,
    top_relevance_rows_for_commodity,
)
from app.services.risk.config import (
    ANALYSIS_VERSION,
    COMMODITY_REGISTRY,
    DEFAULT_STORE_CONTEXT_HASH,
    DEFAULT_STORE_PROFILE_KEY,
    MARKET_SENSITIVE_CODES,
    MATCHER_VERSION,
    POLICY_VERSION,
    PROMPT_VERSION,
    RELEVANCE_VERSION,
    SCORER_VERSION,
    TREND_SUMMARY_PROMPT_VERSION,
)
from app.services.risk.repository import (
    load_daily_news_cache,
    load_risk_snapshots,
    upsert_daily_news_cache,
    upsert_risk_snapshots,
)
from app.services.risk.scoring import score_market_sensitive_snapshot, snapshot_to_brief


def _parse_page_date(page_date: str) -> date_type:
    return date_type.fromisoformat(page_date)


def _impact_from_relevance_row(row: dict) -> str:
    if row.get("signal_type") == "direct":
        return "up"
    if float(row.get("relevance_score", 0)) >= 0.55:
        return "unstable"
    return "down"


def _build_selected_matches_for_briefing(relevance_rows: list[dict]) -> list[dict]:
    matches = []
    for commodity_code in MARKET_SENSITIVE_CODES:
        commodity_name = COMMODITY_REGISTRY[commodity_code]["name"]
        for row in top_relevance_rows_for_commodity(relevance_rows, commodity_code):
            matches.append(
                {
                    "article_id": row["article_id"],
                    "title": row.get("article_title", ""),
                    "summary": row.get("article_summary", ""),
                    "article_url": row.get("article_url", ""),
                    "matched_commodities": [commodity_name],
                    "reason": row.get("judgment_reason", ""),
                    "impact": _impact_from_relevance_row(row),
                    "severity": int(row.get("severity", 0)),
                }
            )
    return matches


def _cached_snapshot_complete(snapshot: dict | None) -> bool:
    if not snapshot:
        return False
    has_required_guides = snapshot.get("risk_tier") == "stable" or bool(snapshot.get("action_guides"))
    return (
        snapshot.get("relevance_version") == RELEVANCE_VERSION
        and snapshot.get("trend_summary_prompt_version") == TREND_SUMMARY_PROMPT_VERSION
        and bool(snapshot.get("trend_summary"))
        and has_required_guides
    )


def load_or_create_daily_news_analysis(
    page_date: str,
    *,
    store_profile_key: str = DEFAULT_STORE_PROFILE_KEY,
) -> dict:
    cached = load_daily_news_cache(
        page_date=page_date,
        store_profile_key=store_profile_key,
        matcher_version=MATCHER_VERSION,
        prompt_version=RELEVANCE_VERSION,
    )
    if cached:
        return cached

    all_articles = fetch_news_by_date(page_date)
    filtered = filter_relevant(all_articles, page_date)
    relevance_rows = load_or_create_relevance_rows(page_date, store_profile_key=store_profile_key)
    matches = aggregate_daily_matches(relevance_rows)

    upsert_daily_news_cache(
        page_date=page_date,
        store_profile_key=store_profile_key,
        matcher_version=MATCHER_VERSION,
        prompt_version=RELEVANCE_VERSION,
        total_articles=len(all_articles),
        filtered_count=len(filtered),
        matches=matches,
    )

    return {
        "date": page_date,
        "total_articles": len(all_articles),
        "filtered_count": len(filtered),
        "matches": matches,
    }


def load_or_create_risk_snapshots(
    page_date: str,
    *,
    store_profile_key: str = DEFAULT_STORE_PROFILE_KEY,
    store_context_hash: str = DEFAULT_STORE_CONTEXT_HASH,
) -> list[dict]:
    requested_date = _parse_page_date(page_date)
    market_cards = load_market_commodity_cards(requested_date)
    expected_codes = {card["item_code"] for card in market_cards if card["item_code"] in MARKET_SENSITIVE_CODES}

    cached = load_risk_snapshots(
        page_date=page_date,
        store_profile_key=store_profile_key,
        scorer_version=SCORER_VERSION,
        analysis_version=ANALYSIS_VERSION,
    )
    cached_by_code = {row["commodity_id"]: row for row in cached}
    if expected_codes and all(_cached_snapshot_complete(cached_by_code.get(code)) for code in expected_codes):
        return cached

    load_or_create_daily_news_analysis(page_date, store_profile_key=store_profile_key)
    relevance_rows = load_or_create_relevance_rows(page_date, store_profile_key=store_profile_key)
    selected_matches = _build_selected_matches_for_briefing(relevance_rows)
    briefs = generate_briefs(selected_matches, page_date)
    brief_by_code = {brief["commodity_code"]: brief for brief in briefs}

    scored_rows = []
    for market_card in market_cards:
        commodity_code = market_card["item_code"]
        if commodity_code not in MARKET_SENSITIVE_CODES:
            continue

        commodity_name = market_card["item_name"]
        commodity_type = COMMODITY_REGISTRY[commodity_code]["commodity_type"]
        evidence_rows = top_relevance_rows_for_commodity(relevance_rows, commodity_code)
        matches_for_item = [
            {
                "article_id": row["article_id"],
                "title": row.get("article_title", ""),
                "summary": row.get("article_summary", ""),
                "article_url": row.get("article_url", ""),
                "matched_commodities": [commodity_name],
                "reason": row.get("judgment_reason", ""),
                "impact": _impact_from_relevance_row(row),
                "severity": int(row.get("severity", 0)),
            }
            for row in evidence_rows
        ]
        brief = brief_by_code.get(commodity_code)

        snapshot = score_market_sensitive_snapshot(
            page_date=page_date,
            commodity_code=commodity_code,
            commodity_name=commodity_name,
            commodity_type=commodity_type,
            brief=brief,
            matches=matches_for_item,
            market_card=market_card,
            store_profile_key=store_profile_key,
            store_context_hash=store_context_hash,
            scorer_version=SCORER_VERSION,
            policy_version=POLICY_VERSION,
            prompt_version=PROMPT_VERSION,
            analysis_version=ANALYSIS_VERSION,
            source_window_days=1,
        )
        trend_summary, trend_summary_model, trend_summary_prompt_version = generate_trend_summary(
            commodity_name=commodity_name,
            page_date=page_date,
            risk_score=int(snapshot["risk_score"]),
            risk_tier=snapshot["risk_tier"],
            market_context=market_card.get("market_context", {}),
            evidence_rows=evidence_rows,
        )
        snapshot["trend_summary"] = trend_summary
        snapshot["trend_summary_model"] = trend_summary_model
        snapshot["trend_summary_prompt_version"] = trend_summary_prompt_version
        snapshot["relevance_judgment_summary"] = summarize_relevance_judgment(evidence_rows)
        snapshot["relevance_version"] = RELEVANCE_VERSION
        scored_rows.append(snapshot)

    upsert_risk_snapshots(scored_rows)
    return load_risk_snapshots(
        page_date=page_date,
        store_profile_key=store_profile_key,
        scorer_version=SCORER_VERSION,
        analysis_version=ANALYSIS_VERSION,
    )


def load_or_create_brief_response(
    page_date: str,
    *,
    store_profile_key: str = DEFAULT_STORE_PROFILE_KEY,
) -> dict:
    snapshots = load_or_create_risk_snapshots(page_date, store_profile_key=store_profile_key)
    briefs = [snapshot_to_brief(snapshot) for snapshot in snapshots]
    return {
        "date": page_date,
        "commodity_count": len(briefs),
        "briefs": briefs,
        "versions": {
            "matcher_version": MATCHER_VERSION,
            "prompt_version": PROMPT_VERSION,
            "scorer_version": SCORER_VERSION,
            "policy_version": POLICY_VERSION,
            "analysis_version": ANALYSIS_VERSION,
            "relevance_version": RELEVANCE_VERSION,
            "trend_summary_prompt_version": TREND_SUMMARY_PROMPT_VERSION,
        },
    }
