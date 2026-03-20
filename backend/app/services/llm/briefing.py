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

DIRECT_HINTS = ["공급", "검역", "수입 제한", "수입 금지", "질병", "단가", "작황", "살처분"]
IMPORT_HINTS = ["수입", "통관", "검역", "환율", "관세", "통상"]
LOGISTICS_HINTS = ["유가", "운임", "물류", "납품", "도매", "냉장", "냉동"]


def _infer_stage(reason: str, title: str) -> str:
    text = f"{title} {reason}"
    if any(keyword in text for keyword in ["질병", "작황", "사육", "생산", "기후", "수확"]):
        return "upstream_production"
    if any(keyword in text for keyword in IMPORT_HINTS):
        return "import_processing"
    if any(keyword in text for keyword in LOGISTICS_HINTS):
        return "distribution_logistics"
    if any(keyword in text for keyword in ["발주", "재고", "리드타임"]):
        return "store_procurement"
    return "distribution_logistics"


def _fallback_signals(articles: list[dict]) -> list[dict]:
    signals = []
    for article in articles[:5]:
        reason = article.get("reason", "")
        title = article.get("title", "")
        direct = any(keyword in f"{title} {reason}" for keyword in DIRECT_HINTS)
        signals.append({
            "signal_type": "direct" if direct else "proxy",
            "label": title[:80] or "시장 신호 감지",
            "scm_stage": _infer_stage(reason, title),
            "description": reason or "관련 기사에서 가격 변동 신호를 감지했습니다.",
        })
    return signals


def _fallback_risk_tier(articles: list[dict], signals: list[dict]) -> dict:
    max_severity = max((int(article.get("severity", 0)) for article in articles), default=0)
    direct_count = sum(1 for signal in signals if signal["signal_type"] == "direct")

    if max_severity >= 8 and direct_count >= 1:
        return {"tier": "T4", "label": "긴급 검토", "reason": "고강도 직접 신호가 확인되어 사람 검토가 필요합니다."}
    if max_severity >= 6:
        return {"tier": "T3", "label": "선제 대응", "reason": "직접 또는 다수의 간접 신호가 누적되어 선제 대응이 필요합니다."}
    if max_severity >= 4:
        return {"tier": "T2", "label": "저위험 대응", "reason": "시장 신호가 있어 공급처 확인과 재고 점검이 필요합니다."}
    if articles:
        return {"tier": "T1", "label": "모니터링", "reason": "신호는 있으나 불확실성이 커 우선 모니터링이 적절합니다."}
    return {"tier": "T0", "label": "무시", "reason": "관련성이 낮아 운영 대응이 필요하지 않습니다."}


def _fallback_action_items(commodity_name: str, tier: str) -> list[dict]:
    if tier in {"T0", "T1"}:
        return []
    items = [
        {
            "title": "공급처 확인",
            "content": f"{commodity_name} 최근 단가와 다음 발주 리드타임을 공급처에 먼저 확인하세요.",
            "urgency": "1주내",
        },
        {
            "title": "재고 점검",
            "content": f"{commodity_name} 현재 재고와 일평균 사용량을 확인해 급한 선발주 필요 여부를 판단하세요.",
            "urgency": "1주내",
        },
        {
            "title": "대체안 검토",
            "content": f"{commodity_name} 대체 규격이나 발주 주기 조정으로 운영 리스크를 줄일 수 있는지 확인하세요.",
            "urgency": "모니터링" if tier == "T2" else "즉시",
        },
    ]
    return items


def _fallback_brief(commodity_name: str, code: str, articles: list[dict], date: str, article_ids: list[int]) -> dict:
    signals = _fallback_signals(articles)
    risk_tier = _fallback_risk_tier(articles, signals)
    tier = risk_tier["tier"]
    return CommodityDailyBrief(
        commodity_code=code,
        commodity_name=commodity_name,
        date=date,
        trend_summary=f"{commodity_name} 관련 공급망 신호를 감지했으며 현재 정책 티어는 {tier}입니다." if articles else f"{commodity_name} 관련 유의미한 공급망 신호가 적어 모니터링 중심으로 봅니다.",
        signals=signals,
        risk_tier=risk_tier,
        action_items=_fallback_action_items(commodity_name, tier),
        greedflation_flag=False,
        greedflation_note="해당없음",
        related_article_ids=article_ids,
    ).model_dump()


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

    api_key = os.getenv("ANTHROPIC_API_KEY")
    client = Anthropic(api_key=api_key) if api_key else None
    tool_schema = SCMBriefAnalysis.model_json_schema()
    briefs: list[dict] = []

    for commodity_name, articles in groups.items():
        code = _find_commodity_code(commodity_name)
        article_ids = list({a["article_id"] for a in articles if a.get("article_id")})

        if client is None:
            briefs.append(_fallback_brief(commodity_name, code, articles, date, article_ids))
            continue

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
            briefs.append(_fallback_brief(commodity_name, code, articles, date, article_ids))

    briefs.sort(
        key=lambda b: _TIER_PRIORITY.get(b.get("risk_tier", {}).get("tier", "T0"), 0),
        reverse=True,
    )
    return briefs
