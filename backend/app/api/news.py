import time
import logging
from collections import OrderedDict

from fastapi import APIRouter, Query
from app.services.news.fetcher import fetch_news_by_date, filter_relevant
from app.services.news.matcher import match_news
from app.services.llm.briefing import generate_briefs

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
    """fetch → filter → match. 결과를 캐시하여 daily/brief 양쪽에서 재사용."""
    cache_key = f"match:{date}"
    cached = _get_cached(cache_key)
    if cached:
        return cached

    all_articles = fetch_news_by_date(date)
    filtered = filter_relevant(all_articles, date)
    matches = match_news(filtered)

    result = {
        "total_articles": len(all_articles),
        "filtered_count": len(filtered),
        "matches": matches,
    }
    _put_cache(cache_key, result)
    return result


@router.get("/news/daily")
def get_daily_news(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Step 1: 뉴스별 짧은 분석 (한줄 reason)
    기사를 가져와서 품목에 매칭하고, 기사별 한줄 분석을 반환합니다.
    """
    cache_key = f"daily:{date}"
    cached = _get_cached(cache_key)
    if cached:
        logger.info("daily cache hit: %s", date)
        return cached

    pipeline = _run_match_pipeline(date)

    result = {
        "date": date,
        "total_articles": pipeline["total_articles"],
        "filtered_count": pipeline["filtered_count"],
        "matches": pipeline["matches"],
    }
    _put_cache(cache_key, result)
    return result


@router.get("/news/brief")
def get_daily_briefs(date: str = Query(..., description="YYYY-MM-DD")):
    """
    Step 2: 품목별 SCM 일일 브리프
    그날의 매칭 기사를 품목별로 종합하여 공급망 리스크 분석을 생성합니다.
    매칭 기사가 없는 품목은 건너뜁니다 (억지 분석 없음).
    """
    cache_key = f"brief:{date}"
    cached = _get_cached(cache_key)
    if cached:
        logger.info("brief cache hit: %s", date)
        return cached

    pipeline = _run_match_pipeline(date)
    briefs = generate_briefs(pipeline["matches"], date)

    result = {
        "date": date,
        "commodity_count": len(briefs),
        "briefs": briefs,
    }
    _put_cache(cache_key, result)
    return result
