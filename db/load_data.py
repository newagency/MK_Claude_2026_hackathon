"""
뉴스 데이터 적재 스크립트

사용법:
    # 1) 카테고리 마스터 적재
    python load_data.py categories "/path/to/03.매경 뉴스 카테고리.json"

    # 2) 뉴스 기사 적재 (월별 폴더가 있는 상위 디렉토리)
    python load_data.py articles /path/to/2025

    # 3) 한 달만 적재
    python load_data.py articles /path/to/2025/01

환경변수 (기본값은 docker-compose 설정 기준):
    DB_HOST=localhost  DB_PORT=5432
    DB_NAME=sosang     DB_USER=sosang  DB_PASSWORD=sosang
"""

import json
import os
import sys
import glob
from datetime import datetime
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

DB_CFG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "dbname": os.getenv("DB_NAME", "sosang"),
    "user": os.getenv("DB_USER", "sosang"),
    "password": os.getenv("DB_PASSWORD", "sosang"),
}

BATCH_SIZE = 500


def connect():
    return psycopg2.connect(**DB_CFG)


def parse_timestamp(val: str):
    if not val:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f"):
        try:
            return datetime.strptime(val, fmt)
        except ValueError:
            continue
    return None


def empty_to_none(val):
    """빈 문자열 → None (DB에서 NULL)"""
    if val == "":
        return None
    return val


# ── 카테고리 적재 ──────────────────────────────────────────────

def load_categories(filepath: str):
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)

    rows = data.get("_DATA", data) if isinstance(data, dict) else data

    conn = connect()
    cur = conn.cursor()

    values = []
    for r in rows:
        values.append((
            r["SMALL_CODE_ID"],
            r["SMALL_CODE_NM"],
            empty_to_none(r.get("MIDDLE_CODE_ID")),
            empty_to_none(r.get("MIDDLE_CODE_NM")),
            empty_to_none(r.get("LARGE_CODE_ID")),
            empty_to_none(r.get("LARGE_CODE_NM")),
            r.get("SEQ"),
        ))

    execute_values(
        cur,
        """
        INSERT INTO news_categories
            (small_code_id, small_code_nm, middle_code_id, middle_code_nm,
             large_code_id, large_code_nm, seq)
        VALUES %s
        ON CONFLICT (small_code_id) DO UPDATE SET
            small_code_nm  = EXCLUDED.small_code_nm,
            middle_code_id = EXCLUDED.middle_code_id,
            middle_code_nm = EXCLUDED.middle_code_nm,
            large_code_id  = EXCLUDED.large_code_id,
            large_code_nm  = EXCLUDED.large_code_nm,
            seq            = EXCLUDED.seq
        """,
        values,
    )
    conn.commit()
    print(f"[categories] {len(values)}건 적재 완료")
    cur.close()
    conn.close()


# ── 뉴스 기사 적재 ─────────────────────────────────────────────

def parse_article(filepath: str) -> dict | None:
    with open(filepath, encoding="utf-8") as f:
        try:
            doc = json.load(f)
        except json.JSONDecodeError:
            return None

    art = doc.get("article", {})
    article_id = art.get("article_id")
    if article_id is None:
        return None

    sdt = parse_timestamp(art.get("service_daytime", ""))
    service_date = sdt.date() if sdt else None

    main_cat = empty_to_none(art.get("main_category", ""))

    return {
        "article_id": article_id,
        "title": art.get("title", ""),
        "sub_title": art.get("sub_title", ""),
        "body": doc.get("article_body", {}).get("body", ""),
        "summary": doc.get("article_summary", {}).get("summary", ""),
        "article_url": doc.get("article_url", ""),
        "service_date": service_date,
        "service_daytime": sdt,
        "reg_dt": parse_timestamp(art.get("reg_dt", "")),
        "mod_dt": parse_timestamp(art.get("mod_dt", "")),
        "main_category": main_cat,
        "keywords": art.get("keywords", ""),
        "writers": art.get("writers", ""),
        "lang": art.get("lang", "KR"),
        "pub_div": art.get("pub_div", "W"),
        "pub_date": art.get("pub_date", ""),
        "pub_section": art.get("pub_section", ""),
        "pub_page": art.get("pub_page"),
        "like_count": doc.get("share", {}).get("like_count", 0) or 0,
        "reply_count": doc.get("share", {}).get("reply_count", 0) or 0,
        "keyword_list": json.dumps(doc.get("keyword_list", []), ensure_ascii=False),
        "images": json.dumps(doc.get("images", []), ensure_ascii=False),
        "categories": doc.get("categories", []),
        "comments": doc.get("comments", []),
    }


def insert_batch(cur, articles: list):
    if not articles:
        return

    art_values = []
    cat_values = []
    comment_values = []

    for a in articles:
        art_values.append((
            a["article_id"], a["title"], a["sub_title"], a["body"],
            a["summary"], a["article_url"], a["service_date"],
            a["service_daytime"], a["reg_dt"], a["mod_dt"],
            a["main_category"], a["keywords"], a["writers"],
            a["lang"], a["pub_div"], a["pub_date"], a["pub_section"],
            a["pub_page"], a["like_count"], a["reply_count"],
            a["keyword_list"], a["images"],
        ))

        for c in a["categories"]:
            cat_values.append((
                a["article_id"],
                c.get("code_id", ""),
                c.get("code_nm", ""),
                empty_to_none(c.get("large_code_id")),
                c.get("large_code_nm", ""),
                empty_to_none(c.get("middle_code_id")),
                c.get("middle_code_nm", ""),
                empty_to_none(c.get("small_code_id")),
                c.get("small_code_nm", ""),
            ))

        for cm in a["comments"]:
            comment_values.append((
                cm["comment_id"],
                a["article_id"],
                cm.get("parent_id", 0),
                cm.get("author", ""),
                cm.get("content", ""),
                cm.get("like_count", 0) or 0,
                cm.get("hate_count", 0) or 0,
                parse_timestamp(cm.get("created_at", "")),
            ))

    execute_values(
        cur,
        """
        INSERT INTO news_articles
            (article_id, title, sub_title, body, summary, article_url,
             service_date, service_daytime, reg_dt, mod_dt,
             main_category, keywords, writers, lang, pub_div,
             pub_date, pub_section, pub_page,
             like_count, reply_count, keyword_list, images)
        VALUES %s
        ON CONFLICT (article_id) DO NOTHING
        """,
        art_values,
    )

    if cat_values:
        execute_values(
            cur,
            """
            INSERT INTO news_article_categories
                (article_id, code_id, code_nm,
                 large_code_id, large_code_nm,
                 middle_code_id, middle_code_nm,
                 small_code_id, small_code_nm)
            VALUES %s
            ON CONFLICT (article_id, code_id) DO NOTHING
            """,
            cat_values,
        )

    if comment_values:
        execute_values(
            cur,
            """
            INSERT INTO news_comments
                (comment_id, article_id, parent_id, author, content,
                 like_count, hate_count, created_at)
            VALUES %s
            ON CONFLICT (comment_id) DO NOTHING
            """,
            comment_values,
        )


def load_articles(data_dir: str):
    data_path = Path(data_dir)
    json_files = sorted(data_path.rglob("*.json"))

    if not json_files:
        print(f"[articles] {data_dir}에서 JSON 파일을 찾을 수 없습니다")
        sys.exit(1)

    print(f"[articles] {len(json_files)}개 파일 발견, 적재 시작...")

    conn = connect()
    cur = conn.cursor()

    batch = []
    loaded = 0
    skipped = 0

    for i, fp in enumerate(json_files, 1):
        article = parse_article(str(fp))
        if article is None:
            skipped += 1
            continue

        batch.append(article)

        if len(batch) >= BATCH_SIZE:
            insert_batch(cur, batch)
            conn.commit()
            loaded += len(batch)
            batch = []
            print(f"  ... {loaded:,}건 완료 ({i:,}/{len(json_files):,})", end="\r")

    if batch:
        insert_batch(cur, batch)
        conn.commit()
        loaded += len(batch)

    print(f"\n[articles] 완료: {loaded:,}건 적재, {skipped:,}건 스킵")
    cur.close()
    conn.close()


# ── main ───────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]
    path = sys.argv[2]

    if command == "categories":
        load_categories(path)
    elif command == "articles":
        load_articles(path)
    else:
        print(f"알 수 없는 명령: {command}")
        print("사용 가능: categories, articles")
        sys.exit(1)


if __name__ == "__main__":
    main()
