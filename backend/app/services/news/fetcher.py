"""
DB에서 날짜별 뉴스를 가져오고, 소분류 + 키워드 OR 필터를 적용합니다.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from .config import TRACKED_COMMODITIES, RELEVANT_SMALL_CODES


def _connect():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        dbname=os.getenv("DB_NAME", "sosang"),
        user=os.getenv("DB_USER", "sosang"),
        password=os.getenv("DB_PASSWORD", "sosang"),
    )


def fetch_news_by_date(date_str: str) -> list[dict]:
    """
    특정 날짜의 뉴스 기사를 가져옵니다.
    date_str: "2025-03-15" 형식
    """
    conn = _connect()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        """
        SELECT a.article_id, a.title, a.summary, a.main_category,
               a.keywords, a.article_url, a.service_daytime
        FROM news_articles a
        WHERE a.service_date = %s
        ORDER BY a.service_daytime
        """,
        (date_str,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return rows


def _get_category_article_ids(date_str: str) -> set[int]:
    """관련 소분류에 속하는 기사 ID를 DB에서 가져옵니다."""
    if not RELEVANT_SMALL_CODES:
        return set()
    conn = _connect()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT a.article_id
        FROM news_articles a
        JOIN news_article_categories ac ON a.article_id = ac.article_id
        WHERE a.service_date = %s
          AND ac.code_id = ANY(%s)
        """,
        (date_str, RELEVANT_SMALL_CODES),
    )
    ids = {r[0] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return ids


def filter_relevant(articles: list[dict], date_str: str) -> list[dict]:
    """
    LLM에 보내기 전 1차 필터 (OR 조건):
    - 소분류가 RELEVANT_SMALL_CODES에 속하거나
    - 제목/요약에 추적 품목 키워드가 포함된 기사
    """
    cat_ids = _get_category_article_ids(date_str)

    all_keywords = []
    for c in TRACKED_COMMODITIES:
        all_keywords.extend(c["keywords"])

    seen = set()
    result = []
    for art in articles:
        aid = art["article_id"]
        if aid in seen:
            continue

        in_category = aid in cat_ids
        text = f"{art.get('title', '')} {art.get('summary', '')}"
        keyword_hit = any(kw in text for kw in all_keywords)

        if in_category or keyword_hit:
            seen.add(aid)
            result.append(art)

    return result
