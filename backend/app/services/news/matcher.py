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
    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=_build_system_prompt(),
        messages=[
            {"role": "user", "content": _build_user_message(articles)},
        ],
    )

    raw = response.content[0].text.strip()

    # JSON 배열 추출 (LLM이 마크다운 코드블록으로 감쌀 수 있음)
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


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
