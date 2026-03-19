from fastapi import APIRouter, Query
from app.services.news.fetcher import fetch_news_by_date, filter_relevant
from app.services.news.matcher import match_news

router = APIRouter()


@router.get("/news/daily")
async def get_daily_news(date: str = Query(..., description="YYYY-MM-DD")):
    """
    해당 날짜의 뉴스를 가져오고, 소상공인 품목에 매칭되는 기사를 분석합니다.

    Returns:
        {
            "date": "2025-03-15",
            "total_articles": 520,
            "filtered_count": 34,
            "matches": [ ... ]
        }
    """
    all_articles = fetch_news_by_date(date)
    filtered = filter_relevant(all_articles, date)
    matches = match_news(filtered)

    return {
        "date": date,
        "total_articles": len(all_articles),
        "filtered_count": len(filtered),
        "matches": matches,
    }
