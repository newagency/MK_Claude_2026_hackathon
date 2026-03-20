from __future__ import annotations

import os

import psycopg2
from psycopg2.extras import Json, RealDictCursor


def _connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "sosang"),
        user=os.getenv("DB_USER", "sosang"),
        password=os.getenv("DB_PASSWORD", "sosang"),
    )


def load_daily_news_cache(
    *,
    page_date: str,
    store_profile_key: str,
    matcher_version: str,
    prompt_version: str,
) -> dict | None:
    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT page_date, total_articles, filtered_count, matches_json
        FROM daily_news_analysis_cache
        WHERE page_date = %s
          AND store_profile_key = %s
          AND matcher_version = %s
          AND prompt_version = %s
        """,
        (page_date, store_profile_key, matcher_version, prompt_version),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    return {
        "date": row["page_date"].isoformat(),
        "total_articles": row["total_articles"],
        "filtered_count": row["filtered_count"],
        "matches": row["matches_json"] or [],
    }


def upsert_daily_news_cache(
    *,
    page_date: str,
    store_profile_key: str,
    matcher_version: str,
    prompt_version: str,
    total_articles: int,
    filtered_count: int,
    matches: list[dict],
) -> None:
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO daily_news_analysis_cache (
            page_date,
            store_profile_key,
            matcher_version,
            prompt_version,
            total_articles,
            filtered_count,
            matches_json
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (page_date, store_profile_key, matcher_version, prompt_version)
        DO UPDATE
        SET total_articles = EXCLUDED.total_articles,
            filtered_count = EXCLUDED.filtered_count,
            matches_json = EXCLUDED.matches_json,
            updated_at = NOW()
        """,
        (
            page_date,
            store_profile_key,
            matcher_version,
            prompt_version,
            total_articles,
            filtered_count,
            Json(matches),
        ),
    )
    conn.commit()
    cur.close()
    conn.close()


def load_risk_snapshots(
    *,
    page_date: str,
    store_profile_key: str,
    scorer_version: str,
    analysis_version: str,
) -> list[dict]:
    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT page_date,
               commodity_id,
               commodity_name,
               commodity_lane,
               commodity_type,
               risk_score,
               risk_tier,
               action_policy_tier,
               scorer_version,
               policy_version,
               prompt_version,
               analysis_version,
               score_breakdown,
               scm_risk_summary,
               trend_summary,
               trend_summary_prompt_version,
               trend_summary_model,
               evidence_refs,
               action_guides,
               signal_snapshot,
               related_article_ids,
               relevance_judgment_summary,
                source_window_days,
                store_profile_key,
               store_context_hash,
               relevance_version,
               validation_issues
        FROM commodity_risk_snapshots
        WHERE page_date = %s
          AND store_profile_key = %s
          AND scorer_version = %s
          AND analysis_version = %s
        ORDER BY risk_score DESC, commodity_id
        """,
        (page_date, store_profile_key, scorer_version, analysis_version),
    )
    rows = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()
    for row in rows:
        row["page_date"] = row["page_date"].isoformat()
    return rows


def upsert_risk_snapshots(rows: list[dict]) -> None:
    if not rows:
        return

    conn = _connect()
    cur = conn.cursor()
    for row in rows:
        cur.execute(
            """
            INSERT INTO commodity_risk_snapshots (
                page_date,
                commodity_id,
                commodity_name,
                commodity_lane,
                commodity_type,
                risk_score,
                risk_tier,
                action_policy_tier,
                score_breakdown,
                action_guides,
                scm_risk_summary,
                trend_summary,
                trend_summary_prompt_version,
                trend_summary_model,
                evidence_refs,
                signal_snapshot,
                related_article_ids,
                relevance_judgment_summary,
                store_profile_key,
                store_context_hash,
                scorer_version,
                policy_version,
                prompt_version,
                relevance_version,
                analysis_version,
                source_window_days,
                validation_issues
            )
            VALUES (
                %(page_date)s,
                %(commodity_id)s,
                %(commodity_name)s,
                %(commodity_lane)s,
                %(commodity_type)s,
                %(risk_score)s,
                %(risk_tier)s,
                %(action_policy_tier)s,
                %(score_breakdown)s,
                %(action_guides)s,
                %(scm_risk_summary)s,
                %(trend_summary)s,
                %(trend_summary_prompt_version)s,
                %(trend_summary_model)s,
                %(evidence_refs)s,
                %(signal_snapshot)s,
                %(related_article_ids)s,
                %(relevance_judgment_summary)s,
                %(store_profile_key)s,
                %(store_context_hash)s,
                %(scorer_version)s,
                %(policy_version)s,
                %(prompt_version)s,
                %(relevance_version)s,
                %(analysis_version)s,
                %(source_window_days)s,
                %(validation_issues)s
            )
            ON CONFLICT (
                page_date,
                commodity_id,
                store_profile_key,
                scorer_version,
                analysis_version
            )
            DO UPDATE
            SET commodity_name = EXCLUDED.commodity_name,
                commodity_lane = EXCLUDED.commodity_lane,
                commodity_type = EXCLUDED.commodity_type,
                risk_score = EXCLUDED.risk_score,
                risk_tier = EXCLUDED.risk_tier,
                action_policy_tier = EXCLUDED.action_policy_tier,
                score_breakdown = EXCLUDED.score_breakdown,
                action_guides = EXCLUDED.action_guides,
                scm_risk_summary = EXCLUDED.scm_risk_summary,
                trend_summary = EXCLUDED.trend_summary,
                trend_summary_prompt_version = EXCLUDED.trend_summary_prompt_version,
                trend_summary_model = EXCLUDED.trend_summary_model,
                evidence_refs = EXCLUDED.evidence_refs,
                signal_snapshot = EXCLUDED.signal_snapshot,
                related_article_ids = EXCLUDED.related_article_ids,
                relevance_judgment_summary = EXCLUDED.relevance_judgment_summary,
                store_context_hash = EXCLUDED.store_context_hash,
                policy_version = EXCLUDED.policy_version,
                prompt_version = EXCLUDED.prompt_version,
                relevance_version = EXCLUDED.relevance_version,
                source_window_days = EXCLUDED.source_window_days,
                validation_issues = EXCLUDED.validation_issues,
                updated_at = NOW()
            """,
            {
                **row,
                "score_breakdown": Json(row["score_breakdown"]),
                "action_guides": Json(row["action_guides"]),
                "evidence_refs": Json(row["evidence_refs"]),
                "signal_snapshot": Json(row["signal_snapshot"]),
                "validation_issues": Json(row.get("validation_issues", [])),
            },
        )
    conn.commit()
    cur.close()
    conn.close()


def load_relevance_rows(
    *,
    page_date: str,
    store_profile_key: str,
    relevance_version: str,
) -> list[dict]:
    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT page_date,
               article_id,
               commodity_id,
               commodity_name,
               store_profile_key,
               relevance_version,
               relevance_label,
               signal_type,
               signal_stage,
               relevance_score,
               severity,
               judgment_reason,
               candidate_features,
               article_title,
               article_summary,
               article_url,
               llm_refined
        FROM article_commodity_relevance_cache
        WHERE page_date = %s
          AND store_profile_key = %s
          AND relevance_version = %s
        ORDER BY article_id, relevance_score DESC
        """,
        (page_date, store_profile_key, relevance_version),
    )
    rows = [dict(row) for row in cur.fetchall()]
    cur.close()
    conn.close()
    for row in rows:
        row["page_date"] = row["page_date"].isoformat()
    return rows


def upsert_relevance_rows(rows: list[dict]) -> None:
    if not rows:
        return

    conn = _connect()
    cur = conn.cursor()
    for row in rows:
        cur.execute(
            """
            INSERT INTO article_commodity_relevance_cache (
                page_date,
                article_id,
                commodity_id,
                commodity_name,
                store_profile_key,
                relevance_version,
                relevance_label,
                signal_type,
                signal_stage,
                relevance_score,
                severity,
                judgment_reason,
                candidate_features,
                article_title,
                article_summary,
                article_url,
                llm_refined
            )
            VALUES (
                %(page_date)s,
                %(article_id)s,
                %(commodity_id)s,
                %(commodity_name)s,
                %(store_profile_key)s,
                %(relevance_version)s,
                %(relevance_label)s,
                %(signal_type)s,
                %(signal_stage)s,
                %(relevance_score)s,
                %(severity)s,
                %(judgment_reason)s,
                %(candidate_features)s,
                %(article_title)s,
                %(article_summary)s,
                %(article_url)s,
                %(llm_refined)s
            )
            ON CONFLICT (
                page_date,
                article_id,
                commodity_id,
                store_profile_key,
                relevance_version
            )
            DO UPDATE
            SET relevance_label = EXCLUDED.relevance_label,
                signal_type = EXCLUDED.signal_type,
                signal_stage = EXCLUDED.signal_stage,
                relevance_score = EXCLUDED.relevance_score,
                severity = EXCLUDED.severity,
                judgment_reason = EXCLUDED.judgment_reason,
                candidate_features = EXCLUDED.candidate_features,
                article_title = EXCLUDED.article_title,
                article_summary = EXCLUDED.article_summary,
                article_url = EXCLUDED.article_url,
                llm_refined = EXCLUDED.llm_refined,
                updated_at = NOW()
            """,
            {
                **row,
                "candidate_features": Json(row.get("candidate_features", {})),
            },
        )
    conn.commit()
    cur.close()
    conn.close()
