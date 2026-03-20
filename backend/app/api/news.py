import time
import logging
from collections import OrderedDict

from fastapi import APIRouter, Query
from app.services.risk.pipeline import (
    load_or_create_brief_response,
    load_or_create_daily_news_analysis,
)
from app.services.risk.config import (
    ANALYSIS_VERSION,
    MATCHER_VERSION,
    RELEVANCE_VERSION,
    SCORER_VERSION,
    TREND_SUMMARY_PROMPT_VERSION,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_cache: OrderedDict[str, dict] = OrderedDict()
_CACHE_MAX = 30
_CACHE_TTL = 600


def _get_cached(key: str) -> dict | None:
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < _CACHE_TTL:
        _cache.move_to_end(key)
        return entry["data"]
    _cache.pop(key, None)
    return None


def _put_cache(key: str, data: dict):
    _cache[key] = {"data": data, "ts": time.time()}
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


def _run_match_pipeline(date: str) -> dict:
    """DB snapshot miss 시에만 daily news analysis를 생성한다."""
    cache_key = f"match:{date}:{MATCHER_VERSION}:{RELEVANCE_VERSION}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    result = load_or_create_daily_news_analysis(date)
    _put_cache(cache_key, result)
    return result


@router.get("/news/daily")
def get_daily_news(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Step 1: 뉴스별 짧은 분석 (한줄 reason)
    기사를 가져와서 품목에 매칭하고, 기사별 한줄 분석을 반환합니다.
    """
    cache_key = f"daily:{date}:{MATCHER_VERSION}:{RELEVANCE_VERSION}"
    cached = _get_cached(cache_key)
    if cached:
        logger.info("daily cache hit: %s", date)
        return cached

    result = _run_match_pipeline(date)
    _put_cache(cache_key, result)
    return result


@router.get("/news/brief")
def get_daily_briefs(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Step 2: 품목별 SCM 일일 브리프
    그날의 매칭 기사를 품목별로 종합하여 공급망 리스크 분석을 생성합니다.
    매칭 기사가 없는 품목은 건너뜁니다 (억지 분석 없음).
    """
    cache_key = f"brief:{date}:{SCORER_VERSION}:{ANALYSIS_VERSION}:{RELEVANCE_VERSION}:{TREND_SUMMARY_PROMPT_VERSION}"
    cached = _get_cached(cache_key)
    if cached:
        logger.info("brief cache hit: %s", date)
        return cached

    result = load_or_create_brief_response(date)
    _put_cache(cache_key, result)
    return result
