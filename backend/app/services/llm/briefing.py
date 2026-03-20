"""
품목별 SCM 일일 브리프 생성 모듈

흐름:
  matcher 결과 (품목별 매칭 기사)
    → 품목별 그룹핑
    → 기사가 있는 품목만 LLM 호출
    → tool-use로 SCMBriefAnalysis 스키마에 맞춰 구조화 출력
    → commodity_code / date / article_ids 메타데이터 부착
    → risk_tier 내림차순 정렬

SCM_AND_SERVICE_GRAPHS.md §7의
  Signal → Commodity Mapping → Store Relevance → Risk Tier → Action Policy
파이프라인을 LLM 한 번 호출로 수행한다.
"""

import os
import logging
from anthropic import Anthropic
from dotenv import load_dotenv

from app.schemas.analysis import SCMBriefAnalysis, CommodityDailyBrief
from app.services.news.config import (
    TRACKED_COMMODITIES,
    SCM_BRIEF_MODEL,
    SCM_BRIEF_SYSTEM_PROMPT,
)

load_dotenv()
logger = logging.getLogger(__name__)

_TIER_PRIORITY = {"T0": 0, "T1": 1, "T2": 2, "T3": 3, "T4": 4}


def _group_by_commodity(matches: list[dict]) -> dict[str, list[dict]]:
    """매칭 결과를 품목별로 그룹핑. 같은 기사가 여러 품목에 매칭될 수 있다."""
    groups: dict[str, list[dict]] = {}
    for m in matches:
        for name in m.get("matched_commodities", []):
            groups.setdefault(name, []).append(m)
    return groups


def _find_commodity_code(name: str) -> str:
    for c in TRACKED_COMMODITIES:
        if c["name"] == name:
            return c["code"]
    return name


def _build_user_message(commodity_name: str, articles: list[dict], date: str) -> str:
    """LLM에 보낼 유저 메시지 — title + reason + 전체 summary (오탐 방지를 위해 충분한 컨텍스트 제공)"""
    lines = [
        f"품목: {commodity_name}",
        f"날짜: {date}",
        f"관련 기사 ({len(articles)}건):",
        "",
    ]
    for i, art in enumerate(articles, 1):
        impact = art.get("impact", "?")
        severity = art.get("severity", "?")
        title = art.get("title", "제목없음")
        reason = art.get("reason", "")
        summary = art.get("summary", "") or ""

        lines.append(f"{i}. [{impact} / severity:{severity}] {title}")
        if reason:
            lines.append(f"   매칭 이유: {reason}")
        if summary:
            lines.append(f"   요약: {summary}")
        lines.append("")

    return "\n".join(lines)


def generate_briefs(matches: list[dict], date: str) -> list[dict]:
    """
    matcher 결과를 받아 품목별 SCM 일일 브리프를 생성한다.
    매칭 기사가 없는 품목은 건너뛴다 (억지로 분석을 만들지 않음).

    Returns: CommodityDailyBrief를 dict로 변환한 리스트 (risk_tier 내림차순)
    """
    groups = _group_by_commodity(matches)
    if not groups:
        return []

    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    tool_schema = SCMBriefAnalysis.model_json_schema()
    briefs: list[dict] = []

    for commodity_name, articles in groups.items():
        code = _find_commodity_code(commodity_name)
        article_ids = list({a["article_id"] for a in articles if a.get("article_id")})

        try:
            response = client.messages.create(
                model=SCM_BRIEF_MODEL,
                max_tokens=2000,
                system=SCM_BRIEF_SYSTEM_PROMPT,
                messages=[
                    {"role": "user", "content": _build_user_message(commodity_name, articles, date)},
                ],
                tools=[{
                    "name": "record_scm_brief",
                    "description": "품목별 SCM 일일 리스크 브리프를 구조화된 형식으로 기록합니다.",
                    "input_schema": tool_schema,
                }],
                tool_choice={"type": "tool", "name": "record_scm_brief"},
            )

            analysis_data = response.content[0].input

            brief = CommodityDailyBrief(
                commodity_code=code,
                commodity_name=commodity_name,
                date=date,
                related_article_ids=article_ids,
                **analysis_data,
            )
            briefs.append(brief.model_dump())

        except Exception as e:
            logger.warning("brief generation failed for %s: %s", commodity_name, e)
            continue

    briefs.sort(
        key=lambda b: _TIER_PRIORITY.get(b.get("risk_tier", {}).get("tier", "T0"), 0),
        reverse=True,
    )
    return briefs
