-- sosang news schema
-- auto-executed on first `docker-compose up db`

CREATE TABLE IF NOT EXISTS news_categories (
    small_code_id   VARCHAR(20) PRIMARY KEY,
    small_code_nm   TEXT        NOT NULL,
    middle_code_id  VARCHAR(20),
    middle_code_nm  TEXT,
    large_code_id   VARCHAR(20),
    large_code_nm   TEXT,
    seq             INT
);

CREATE TABLE IF NOT EXISTS news_articles (
    article_id      BIGINT      PRIMARY KEY,
    title           TEXT        NOT NULL,
    sub_title       TEXT        NOT NULL DEFAULT '',
    body            TEXT        NOT NULL DEFAULT '',
    summary         TEXT        NOT NULL DEFAULT '',
    article_url     TEXT        NOT NULL DEFAULT '',
    service_date    DATE,
    service_daytime TIMESTAMP,
    reg_dt          TIMESTAMP,
    mod_dt          TIMESTAMP,
    main_category   VARCHAR(20) REFERENCES news_categories(small_code_id),
    keywords        TEXT        NOT NULL DEFAULT '',
    writers         TEXT        NOT NULL DEFAULT '',
    lang            VARCHAR(10) NOT NULL DEFAULT 'KR',
    pub_div         VARCHAR(5)  NOT NULL DEFAULT 'W',
    pub_date        VARCHAR(8)  NOT NULL DEFAULT '',
    pub_section     VARCHAR(10) NOT NULL DEFAULT '',
    pub_page        INT,
    like_count      INT         NOT NULL DEFAULT 0,
    reply_count     INT         NOT NULL DEFAULT 0,
    keyword_list    JSONB       NOT NULL DEFAULT '[]',
    images          JSONB       NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS news_article_categories (
    article_id      BIGINT      NOT NULL REFERENCES news_articles(article_id) ON DELETE CASCADE,
    code_id         VARCHAR(20) NOT NULL,
    code_nm         TEXT        NOT NULL DEFAULT '',
    large_code_id   VARCHAR(20),
    large_code_nm   TEXT,
    middle_code_id  VARCHAR(20),
    middle_code_nm  TEXT,
    small_code_id   VARCHAR(20),
    small_code_nm   TEXT,
    PRIMARY KEY (article_id, code_id)
);

CREATE TABLE IF NOT EXISTS news_comments (
    comment_id      BIGINT      PRIMARY KEY,
    article_id      BIGINT      NOT NULL REFERENCES news_articles(article_id) ON DELETE CASCADE,
    parent_id       BIGINT      NOT NULL DEFAULT 0,
    author          TEXT        NOT NULL DEFAULT '',
    content         TEXT        NOT NULL DEFAULT '',
    like_count      INT         NOT NULL DEFAULT 0,
    hate_count      INT         NOT NULL DEFAULT 0,
    created_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_service_date    ON news_articles(service_date);
CREATE INDEX IF NOT EXISTS idx_articles_main_category   ON news_articles(main_category);
CREATE INDEX IF NOT EXISTS idx_articles_service_daytime ON news_articles(service_daytime);
CREATE INDEX IF NOT EXISTS idx_article_categories_code  ON news_article_categories(code_id);
CREATE INDEX IF NOT EXISTS idx_comments_article         ON news_comments(article_id);
