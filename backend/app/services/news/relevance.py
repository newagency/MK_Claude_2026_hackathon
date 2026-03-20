from __future__ import annotations

import json
import os

from anthropic import Anthropic

from app.services.news.config import TRACKED_COMMODITIES
from app.services.news.fetcher import fetch_news_by_date, filter_relevant
from app.services.risk.config import (
    DEFAULT_STORE_PROFILE_KEY,
    MARKET_SENSITIVE_CODES,
    MAX_ARTICLES_PER_COMMODITY,
    RELEVANCE_BORDERLINE_MAX,
    RELEVANCE_BORDERLINE_MIN,
    RELEVANCE_LLM_MODEL,
    RELEVANCE_VERSION,
)
from app.services.risk.repository import load_relevance_rows, upsert_relevance_rows
from app.services.commodity_market import COMMODITY_META

PROXY_SIGNAL_KEYWORDS = {
    "fx": ["환율", "원달러", "달러", "외환"],
    "fuel": ["유가", "경유", "휘발유", "에너지"],
    "logistics": ["운임", "물류", "해상", "선적", "납품", "도매"],
    "trade": ["관세", "통상", "무역", "수입", "통관", "검역"],
}

SUPPLY_CONTEXT_KEYWORDS = [
    "가격",
    "물가",
    "단가",
    "원가",
    "수급",
    "공급",
    "재고",
    "발주",
    "납품",
    "도매",
    "소매",
    "유통",
    "물류",
    "운임",
    "배송",
    "수입",
    "통관",
    "검역",
    "관세",
    "작황",
    "수확",
    "살처분",
]

DIRECT_SIGNAL_KEYWORDS = [
    "공급 차질",
    "수입 금지",
    "수입 제한",
    "단가 인상",
    "질병",
    "살처분",
    "작황 부진",
    "검역 강화",
    "수확량 감소",
]

STAGE_HINTS = {
    "upstream_production": ["질병", "살처분", "작황", "수확", "생산", "사육", "기후"],
    "import_processing": ["수입", "통관", "검역", "관세", "정제", "제분"],
    "distribution_logistics": ["운임", "물류", "납품", "도매", "유통", "냉동", "냉장"],
    "store_procurement": ["발주", "재고", "리드타임", "공급처"],
    "store_operations": ["메뉴", "프로모션", "운영", "고객", "포장"],
}

HARD_NEGATIVE_KEYWORDS = {
    "apple": ["사과문", "사과드", "사과하", "대국민 사과", "공식 사과"],
    "garlic": ["마늘주사"],
}

GLOBAL_PROXY_NEGATIVE_KEYWORDS = [
    "골든크로스",
    "주가",
    "상장",
    "실적",
    "투자자",
    "우선협상대상자",
    "틱톡",
    "사칭",
    "계정",
    "반도체",
]


def _commodity_map() -> dict[str, dict]:
    return {entry["code"]: entry for entry in TRACKED_COMMODITIES if entry["code"] in MARKET_SENSITIVE_CODES}


def _text_parts(article: dict) -> tuple[str, str, str]:
    title = article.get("title", "") or ""
    summary = article.get("summary", "") or ""
    return title, summary, f"{title} {summary}"


def _detect_proxy_types(text: str) -> set[str]:
    hits = set()
    for proxy_type, keywords in PROXY_SIGNAL_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            hits.add(proxy_type)
    return hits


def _supply_context_hits(text: str) -> int:
    return sum(1 for keyword in SUPPLY_CONTEXT_KEYWORDS if keyword in text)


def _stage_from_text(text: str) -> str:
    for stage, keywords in STAGE_HINTS.items():
        if any(keyword in text for keyword in keywords):
            return stage
    return "distribution_logistics"


def _impact_from_text(text: str) -> str:
    if any(keyword in text for keyword in ["하락", "완화", "안정", "감소", "공급 확대"]):
        return "down"
    if any(keyword in text for keyword in ["급등", "상승", "인상", "차질", "부족", "불안"]):
        return "up"
    return "unstable"


def _candidate_codes(article: dict) -> list[str]:
    title, summary, text = _text_parts(article)
    candidates = set()
    commodity_map = _commodity_map()
    supply_context_hits = _supply_context_hits(text)
    has_proxy_context = bool(_detect_proxy_types(text))
    proxy_context_allowed = supply_context_hits >= 1 and not any(keyword in text for keyword in GLOBAL_PROXY_NEGATIVE_KEYWORDS)

    for code, commodity in commodity_map.items():
        if any(keyword in title or keyword in summary for keyword in commodity["keywords"]):
            candidates.add(code)

    proxy_types = _detect_proxy_types(text)
    if has_proxy_context and proxy_context_allowed:
        for code in commodity_map:
            macro_weight = COMMODITY_META.get(code, {}).get("macro_weight", {})
            if "fx" in proxy_types and macro_weight.get("usd", 0) >= 0.1:
                candidates.add(code)
            if {"fuel", "logistics"} & proxy_types and macro_weight.get("diesel", 0) >= 0.5:
                candidates.add(code)
            if "trade" in proxy_types and macro_weight.get("usd", 0) >= 0.05:
                candidates.add(code)

    return sorted(candidates)


def _cheap_score_candidate(article: dict, commodity: dict) -> dict:
    title, summary, text = _text_parts(article)
    code = commodity["code"]
    hard_negatives = HARD_NEGATIVE_KEYWORDS.get(code, [])
    supply_context_hits = _supply_context_hits(text)
    if any(negative in text for negative in hard_negatives):
        return {
            "commodity_id": code,
            "commodity_name": commodity["name"],
            "relevance_label": "unrelated",
            "signal_type": "no_signal",
            "signal_stage": "",
            "relevance_score": 0.0,
            "severity": 0,
            "judgment_reason": "하드 네거티브 키워드에 해당해 무관 기사로 판정했습니다.",
            "candidate_features": {"hard_negative": True},
            "llm_refined": False,
        }
    if supply_context_hits == 0 and any(keyword in text for keyword in GLOBAL_PROXY_NEGATIVE_KEYWORDS):
        return {
            "commodity_id": code,
            "commodity_name": commodity["name"],
            "relevance_label": "unrelated",
            "signal_type": "no_signal",
            "signal_stage": "",
            "relevance_score": 0.0,
            "severity": 0,
            "judgment_reason": "공급망·가격 문맥이 없는 비시장 기사로 판정했습니다.",
            "candidate_features": {"global_proxy_negative": True},
            "llm_refined": False,
        }

    title_hits = sum(1 for keyword in commodity["keywords"] if keyword in title)
    summary_hits = sum(1 for keyword in commodity["keywords"] if keyword in summary)
    direct_signal_hits = sum(1 for keyword in DIRECT_SIGNAL_KEYWORDS if keyword in text)
    proxy_types = _detect_proxy_types(text)
    stage = _stage_from_text(text)

    exact_score = min(1.0, title_hits * 0.28 + summary_hits * 0.18)
    proxy_score = 0.0
    macro_weight = COMMODITY_META.get(code, {}).get("macro_weight", {})
    proxy_gate = supply_context_hits >= 1
    if proxy_gate and "fx" in proxy_types:
        proxy_score += 0.35 * max(macro_weight.get("usd", 0), 0.1)
    if proxy_gate and "trade" in proxy_types:
        proxy_score += 0.25 * max(macro_weight.get("usd", 0), 0.1)
    if proxy_gate and "fuel" in proxy_types:
        proxy_score += 0.35 * max(macro_weight.get("diesel", 0), 0.2)
    if proxy_gate and "logistics" in proxy_types:
        proxy_score += 0.30 * max(macro_weight.get("diesel", 0), 0.2)

    direct_bonus = min(0.25, direct_signal_hits * 0.08) if exact_score > 0 else 0.0
    candidate_score = round(min(1.0, exact_score + proxy_score + direct_bonus), 4)

    if exact_score >= 0.42 or (exact_score >= 0.25 and direct_signal_hits >= 1):
        label = "direct"
        signal_type = "direct"
    elif proxy_score >= 0.12:
        label = "proxy"
        signal_type = "proxy"
    else:
        label = "unrelated"
        signal_type = "no_signal"

    severity = 0
    if label != "unrelated":
        severity = max(3, min(10, int(round((candidate_score * 6) + (2 if label == "direct" else 0)))))

    reason = (
        f"{commodity['name']} 키워드 hit(title={title_hits}, summary={summary_hits})와 "
        f"proxy 신호 {sorted(proxy_types)}를 기준으로 {label}로 판정했습니다."
    )
    return {
        "commodity_id": code,
        "commodity_name": commodity["name"],
        "relevance_label": label,
        "signal_type": signal_type,
        "signal_stage": stage if label != "unrelated" else "",
        "relevance_score": candidate_score,
        "severity": severity,
        "judgment_reason": reason,
        "candidate_features": {
            "title_hits": title_hits,
            "summary_hits": summary_hits,
            "supply_context_hits": supply_context_hits,
            "direct_signal_hits": direct_signal_hits,
            "proxy_types": sorted(proxy_types),
            "exact_score": round(exact_score, 4),
            "proxy_score": round(proxy_score, 4),
        },
        "llm_refined": False,
    }


def _llm_refine(article: dict, candidates: list[dict]) -> list[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or not candidates:
        return candidates

    title, summary, _ = _text_parts(article)
    client = Anthropic(api_key=api_key)
    prompt = {
        "article_title": title,
        "article_summary": summary,
        "candidates": [
            {
                "commodity_id": candidate["commodity_id"],
                "commodity_name": candidate["commodity_name"],
                "stage_hint": candidate["signal_stage"],
                "cheap_label": candidate["relevance_label"],
                "cheap_score": candidate["relevance_score"],
            }
            for candidate in candidates
        ],
    }

    system = """
당신은 기사-상품 연관성 판정기다.
기사 제목/요약과 후보 상품 목록을 보고 각 후보를 direct / proxy / unrelated 중 하나로 판정하라.
- direct: 해당 상품 가격이나 공급에 직접 연결되는 기사
- proxy: 환율/유가/물류 등 간접 비용 신호
- unrelated: 해당 상품과 실질적 관련 없음
반드시 JSON 배열만 반환하라.
형식:
[
  {
    "commodity_id": "rice",
    "label": "direct|proxy|unrelated",
    "score": 0.0,
    "reason": "한 문장",
    "signal_stage": "upstream_production|import_processing|distribution_logistics|store_procurement|store_operations"
  }
]
"""
    try:
        response = client.messages.create(
            model=RELEVANCE_LLM_MODEL,
            max_tokens=800,
            system=system,
            messages=[{"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        parsed = json.loads(raw)
    except Exception:
        return candidates

    by_code = {candidate["commodity_id"]: dict(candidate) for candidate in candidates}
    for row in parsed if isinstance(parsed, list) else []:
        code = row.get("commodity_id")
        if code not in by_code:
            continue
        label = row.get("label")
        if label not in {"direct", "proxy", "unrelated"}:
            continue
        by_code[code]["relevance_label"] = label
        by_code[code]["signal_type"] = "direct" if label == "direct" else "proxy" if label == "proxy" else "no_signal"
        by_code[code]["signal_stage"] = row.get("signal_stage") or by_code[code]["signal_stage"]
        by_code[code]["relevance_score"] = round(float(row.get("score", by_code[code]["relevance_score"])), 4)
        by_code[code]["judgment_reason"] = row.get("reason", by_code[code]["judgment_reason"])
        by_code[code]["llm_refined"] = True
        if label == "unrelated":
            by_code[code]["severity"] = 0
        else:
            by_code[code]["severity"] = max(3, min(10, int(round(by_code[code]["relevance_score"] * 10))))
    return list(by_code.values())


def _build_relevance_rows_for_article(article: dict) -> list[dict]:
    commodity_map = _commodity_map()
    candidates = [
        _cheap_score_candidate(article, commodity_map[code])
        for code in _candidate_codes(article)
    ]
    borderline = [
        candidate
        for candidate in candidates
        if RELEVANCE_BORDERLINE_MIN <= candidate["relevance_score"] <= RELEVANCE_BORDERLINE_MAX
    ]
    refined_codes = {candidate["commodity_id"] for candidate in borderline}
    refined = _llm_refine(article, borderline) if borderline else []
    refined_map = {row["commodity_id"]: row for row in refined}

    rows = []
    for candidate in candidates:
        merged = refined_map.get(candidate["commodity_id"], candidate)
        rows.append({
            "page_date": article["service_daytime"].date().isoformat() if article.get("service_daytime") else article.get("service_date", ""),
            "article_id": article["article_id"],
            "commodity_id": merged["commodity_id"],
            "commodity_name": merged["commodity_name"],
            "store_profile_key": DEFAULT_STORE_PROFILE_KEY,
            "relevance_version": RELEVANCE_VERSION,
            "relevance_label": merged["relevance_label"],
            "signal_type": merged["signal_type"],
            "signal_stage": merged["signal_stage"],
            "relevance_score": merged["relevance_score"],
            "severity": merged["severity"],
            "judgment_reason": merged["judgment_reason"],
            "candidate_features": merged["candidate_features"],
            "article_title": article.get("title", ""),
            "article_summary": article.get("summary", ""),
            "article_url": article.get("article_url", ""),
            "llm_refined": merged.get("llm_refined", False),
        })
    return rows


def load_or_create_relevance_rows(
    page_date: str,
    *,
    store_profile_key: str = DEFAULT_STORE_PROFILE_KEY,
) -> list[dict]:
    cached = load_relevance_rows(
        page_date=page_date,
        store_profile_key=store_profile_key,
        relevance_version=RELEVANCE_VERSION,
    )
    if cached:
        return cached

    articles = filter_relevant(fetch_news_by_date(page_date), page_date)
    rows = []
    for article in articles:
        article.setdefault("service_date", page_date)
        rows.extend(_build_relevance_rows_for_article(article))

    upsert_relevance_rows(rows)
    return load_relevance_rows(
        page_date=page_date,
        store_profile_key=store_profile_key,
        relevance_version=RELEVANCE_VERSION,
    )


def aggregate_daily_matches(relevance_rows: list[dict]) -> list[dict]:
    grouped = {}
    for row in relevance_rows:
        if row["relevance_label"] == "unrelated":
            continue
        article = grouped.setdefault(
            row["article_id"],
            {
                "article_id": row["article_id"],
                "title": row["article_title"],
                "summary": row["article_summary"],
                "article_url": row["article_url"],
                "matched_commodities": [],
                "reason_parts": [],
                "impact": _impact_from_text(f"{row['article_title']} {row['article_summary']}"),
                "severity": 0,
            },
        )
        article["matched_commodities"].append(row["commodity_name"])
        article["reason_parts"].append(row["judgment_reason"])
        article["severity"] = max(article["severity"], int(row["severity"]))

    matches = []
    for article in grouped.values():
        matches.append({
            "article_id": article["article_id"],
            "title": article["title"],
            "summary": article["summary"],
            "article_url": article["article_url"],
            "matched_commodities": sorted(set(article["matched_commodities"])),
            "reason": " / ".join(article["reason_parts"][:2]),
            "impact": article["impact"],
            "severity": article["severity"],
        })

    matches.sort(key=lambda item: item["severity"], reverse=True)
    return matches


def top_relevance_rows_for_commodity(relevance_rows: list[dict], commodity_code: str) -> list[dict]:
    rows = [
        row
        for row in relevance_rows
        if row["commodity_id"] == commodity_code and row["relevance_label"] != "unrelated"
    ]
    rows.sort(
        key=lambda row: (
            0 if row["relevance_label"] == "direct" else 1,
            -float(row["relevance_score"]),
            -int(row["severity"]),
        )
    )
    return rows[:MAX_ARTICLES_PER_COMMODITY]


def summarize_relevance_judgment(rows: list[dict]) -> str:
    if not rows:
        return "관련 기사 근거가 부족해 직접 신호는 제한적으로 확인됐습니다."

    direct = sum(1 for row in rows if row["relevance_label"] == "direct")
    proxy = sum(1 for row in rows if row["relevance_label"] == "proxy")
    stages = sorted({row["signal_stage"] for row in rows if row["signal_stage"]})
    if direct > 0:
        return f"직접 신호 {direct}건과 간접 신호 {proxy}건이 확인됐고, 주요 영향 단계는 {', '.join(stages[:2]) or 'distribution_logistics'}입니다."
    return f"직접 신호는 약하고 간접 신호 {proxy}건이 확인돼 모니터링 중심 판정이 적절합니다."
