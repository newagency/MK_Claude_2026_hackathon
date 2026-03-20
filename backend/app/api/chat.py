"""
뉴스 기반 AI 챗 엔드포인트
사용자가 그날의 뉴스에 대해 자유롭게 질문하면 LLM이 뉴스 컨텍스트를 참고하여 답변합니다.
"""
from __future__ import annotations

import os
import logging
from typing import Optional

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.news import _run_match_pipeline

load_dotenv()
logger = logging.getLogger(__name__)
router = APIRouter()

_client: Optional[Anthropic] = None


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


CHAT_MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """\
당신은 소상공인 식재료 리스크 관리 AI 어시스턴트 '소상'입니다.
사장님들이 오늘의 뉴스를 보고 궁금한 점을 물어보면, 아래 제공되는 뉴스 데이터를 근거로 정확하고 실용적으로 답변합니다.

## 성격
- 친근하지만 전문적인 톤 (존댓말 사용)
- 답변은 간결하게, 핵심부터 말하기
- 추측은 "~가능성이 있습니다" 등으로 명확히 표기
- 구체적인 액션 아이템을 포함하기

## 규칙
1. 제공된 뉴스 데이터에 근거한 답변만 하세요
2. 뉴스에 없는 내용은 "오늘 뉴스에서는 해당 정보를 확인하기 어렵습니다"라고 답변
3. 가격 영향 분석 시 품목별 공급망 단계를 고려하세요
4. 액션 아이템은 소상공인 관점에서 실행 가능한 것만 제안
5. 모든 답변은 한국어로
"""


class ChatRequest(BaseModel):
    message: str
    date: str
    conversation_history: list[dict] = []


def _build_news_context(date: str) -> str:
    """해당 날짜의 매칭된 뉴스를 컨텍스트 문자열로 구성."""
    try:
        pipeline = _run_match_pipeline(date)
        matches = pipeline.get("matches", [])
    except Exception:
        logger.exception("Failed to load news for chat context")
        return "뉴스 데이터를 불러올 수 없습니다."

    if not matches:
        return "해당 날짜에 매칭된 뉴스가 없습니다."

    lines = [f"## {date} 뉴스 분석 결과 ({len(matches)}건)\n"]
    for i, m in enumerate(matches, 1):
        impact = m.get("impact", "?")
        severity = m.get("severity", "?")
        commodities = ", ".join(m.get("matched_commodities", []))
        title = m.get("title", "제목없음")
        summary = m.get("summary", "") or ""
        reason = m.get("reason", "")

        lines.append(f"### 뉴스 {i}: {title}")
        lines.append(f"- 영향: {impact} / 심각도: {severity}")
        lines.append(f"- 관련 품목: {commodities}")
        if reason:
            lines.append(f"- 분석: {reason}")
        if summary:
            lines.append(f"- 요약: {summary}")
        lines.append("")

    return "\n".join(lines)


@router.post("/news/chat")
def chat_with_news(req: ChatRequest):
    client = _get_client()
    news_context = _build_news_context(req.date)

    messages = []
    for msg in req.conversation_history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    user_msg = req.message
    if not messages:
        user_msg = f"[오늘의 뉴스 데이터]\n{news_context}\n\n---\n사장님 질문: {user_msg}"
    messages.append({"role": "user", "content": user_msg})

    try:
        response = client.messages.create(
            model=CHAT_MODEL,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages,
        )
        answer = response.content[0].text
    except Exception as e:
        logger.exception("Chat LLM call failed")
        answer = f"죄송합니다, 일시적인 오류가 발생했습니다. ({type(e).__name__})"

    return {"answer": answer, "news_count": len(_run_match_pipeline(req.date).get("matches", []))}
