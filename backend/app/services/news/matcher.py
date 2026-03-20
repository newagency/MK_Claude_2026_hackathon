"""
LLM 기반 뉴스 ↔ 품목 매칭 모듈

핵심 로직:
1. 키워드 필터를 통과한 뉴스를 배치로 묶어 LLM에 전송
2. LLM이 가격 변동과 확실히 관련된 기사만 품목에 매칭
3. severity 임계값 미만은 제외
"""

import json
import os
from anthropic import Anthropic
from dotenv import load_dotenv
from .config import (
    TRACKED_COMMODITIES,
    BATCH_SIZE,
    MODEL,
    SYSTEM_PROMPT,
    MIN_SEVERITY,
)

load_dotenv()

DIRECT_KEYWORDS = [
    "공급 차질",
    "수입 금지",
    "수입 제한",
    "작황 부진",
    "질병",
    "살처분",
    "단가 인상",
    "검역",
    "부족",
]

PROXY_KEYWORDS = [
    "환율",
    "원달러",
    "유가",
    "운임",
    "물류비",
    "관세",
    "통상",
    "에너지",
]


def _keyword_matches(article: dict) -> list[str]:
    text = f"{article.get('title', '')} {article.get('summary', '')}"
    matched = []
    for commodity in TRACKED_COMMODITIES:
        if any(keyword in text for keyword in commodity["keywords"]):
            matched.append(commodity["name"])
    return matched


def _heuristic_impact_and_severity(article: dict) -> tuple[str, int]:
    text = f"{article.get('title', '')} {article.get('summary', '')}"
    has_direct = any(keyword in text for keyword in DIRECT_KEYWORDS)
    has_proxy = any(keyword in text for keyword in PROXY_KEYWORDS)

    if has_direct:
        return "up", 7
    if has_proxy:
        return "unstable", 4
    return "unstable", 3


def _heuristic_reason(article: dict, matched: list[str], severity: int) -> str:
    joined = ", ".join(matched)
    return f"{joined} 관련 키워드가 기사 제목/요약에 직접 등장했고, 현재 기사 강도를 {severity}/10으로 추정했습니다."


def _heuristic_match_batch(articles: list[dict]) -> list[dict]:
    results = []
    for article in articles:
        matched = _keyword_matches(article)
        if not matched:
            continue
        impact, severity = _heuristic_impact_and_severity(article)
        if severity < MIN_SEVERITY:
            continue
        results.append({
            "article_id": article.get("article_id"),
            "title": article.get("title", ""),
            "summary": article.get("summary", ""),
            "article_url": article.get("article_url", ""),
            "matched_commodities": matched,
            "reason": _heuristic_reason(article, matched, severity),
            "impact": impact,
            "severity": severity,
        })
    return results


def _build_system_prompt() -> str:
    commodity_list = ", ".join(c["name"] for c in TRACKED_COMMODITIES)
    return SYSTEM_PROMPT.format(commodity_list=commodity_list)


def _build_user_message(articles: list[dict]) -> str:
    lines = []
    for art in articles:
        lines.append(
            f"[ID:{art['article_id']}] {art['title']}\n"
            f"요약: {art.get('summary', '') or '없음'}"
        )
    return "\n---\n".join(lines)


def _call_llm(articles: list[dict]) -> list[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return _heuristic_match_batch(articles)

    client = Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=_build_system_prompt(),
            messages=[
                {"role": "user", "content": _build_user_message(articles)},
            ],
        )
    except Exception:
        return _heuristic_match_batch(articles)

    raw = response.content[0].text.strip()

    # JSON 배열 추출 (LLM이 마크다운 코드블록으로 감쌀 수 있음)
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return _heuristic_match_batch(articles)


def match_news(articles: list[dict]) -> list[dict]:
    """
    뉴스 기사 목록을 LLM으로 분석하여 품목 매칭 결과를 반환합니다.

    Returns:
        [
            {
                "article_id": int,
                "title": str,
                "summary": str,
                "article_url": str,
                "matched_commodities": ["식용유", ...],
                "reason": str,
                "impact": "up" | "down" | "unstable",
                "severity": int
            }
        ]
    """
    if not articles:
        return []

    article_map = {art["article_id"]: art for art in articles}
    all_matches = []

    for i in range(0, len(articles), BATCH_SIZE):
        batch = articles[i : i + BATCH_SIZE]
        raw_matches = _call_llm(batch)
        if not raw_matches:
            raw_matches = _heuristic_match_batch(batch)

        for m in raw_matches:
            if not isinstance(m, dict):
                continue
            if m.get("severity", 0) < MIN_SEVERITY:
                continue

            aid = m.get("article_id")
            src = article_map.get(aid, {})

            all_matches.append({
                "article_id": aid,
                "title": src.get("title", ""),
                "summary": src.get("summary", ""),
                "article_url": src.get("article_url", ""),
                "matched_commodities": m.get("matched_commodities", []),
                "reason": m.get("reason", ""),
                "impact": m.get("impact", "unstable"),
                "severity": m.get("severity", 0),
            })

    all_matches.sort(key=lambda x: x["severity"], reverse=True)
    return all_matches
