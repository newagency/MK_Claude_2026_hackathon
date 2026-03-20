import time
import logging
from collections import OrderedDict

from fastapi import APIRouter, Query
from app.services.news.fetcher import fetch_news_by_date, filter_relevant
from app.services.news.matcher import match_news

logger = logging.getLogger(__name__)
router = APIRouter()

_cache: OrderedDict[str, dict] = OrderedDict()
_CACHE_MAX = 30
_CACHE_TTL = 600


def _get_cached(date: str) -> dict | None:
    entry = _cache.get(date)
    if entry and time.time() - entry["ts"] < _CACHE_TTL:
        _cache.move_to_end(date)
        return entry["data"]
    _cache.pop(date, None)
    return None


def _put_cache(date: str, data: dict):
    _cache[date] = {"data": data, "ts": time.time()}
    while len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)


@router.get("/news/daily")
def get_daily_news(date: str = Query(..., description="YYYY-MM-DD")):
    """
    해당 날짜의 뉴스를 가져오고, 소상공인 품목에 매칭되는 기사를 분석합니다.
    """
    cached = _get_cached(date)
    if cached:
        logger.info("cache hit: %s", date)
        return cached

    all_articles = fetch_news_by_date(date)
    filtered = filter_relevant(all_articles, date)
    matches = match_news(filtered)

    result = {
        "date": date,
        "total_articles": len(all_articles),
        "filtered_count": len(filtered),
        "matches": matches,
    }
    _put_cache(date, result)
    return result
