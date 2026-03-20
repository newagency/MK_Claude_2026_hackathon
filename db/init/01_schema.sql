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

-- standard commodity prices (filtered 최고가만 유지)
CREATE TABLE IF NOT EXISTS standard_prices (
    id              BIGSERIAL   PRIMARY KEY,
    stat_date       DATE        NOT NULL,
    item_name       TEXT        NOT NULL,
    variety_name    TEXT        NOT NULL,
    grade_name      TEXT        NOT NULL,
    price_per_kg    NUMERIC(12,2) NOT NULL,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (stat_date, item_name, variety_name, grade_name)
);

CREATE INDEX IF NOT EXISTS idx_standard_prices_date_item
    ON standard_prices(stat_date, item_name);

-- opinet 자동차경유 일별 평균가
CREATE TABLE IF NOT EXISTS diesel_daily_prices (
    id              BIGSERIAL    PRIMARY KEY,
    price_date      DATE         NOT NULL,
    product_code    TEXT         NOT NULL,
    product_name    TEXT         NOT NULL,
    avg_price       NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (price_date, product_code)
);

CREATE INDEX IF NOT EXISTS idx_diesel_prices_date
    ON diesel_daily_prices(price_date);

-- USD 환율 (휴일 포함, 직전 영업일 보정)
CREATE TABLE IF NOT EXISTS usd_daily_rates (
    id              BIGSERIAL    PRIMARY KEY,
    rate_date       DATE         NOT NULL UNIQUE,
    currency_name   TEXT         NOT NULL,
    base_rate       NUMERIC(12,4) NOT NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usd_rates_date
    ON usd_daily_rates(rate_date);

-- daily matched news cache (DB-first replay)
CREATE TABLE IF NOT EXISTS daily_news_analysis_cache (
    id                 BIGSERIAL PRIMARY KEY,
    page_date          DATE        NOT NULL,
    store_profile_key  TEXT        NOT NULL DEFAULT 'default',
    matcher_version    TEXT        NOT NULL,
    prompt_version     TEXT        NOT NULL,
    total_articles     INT         NOT NULL DEFAULT 0,
    filtered_count     INT         NOT NULL DEFAULT 0,
    matches_json       JSONB       NOT NULL DEFAULT '[]',
    created_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (page_date, store_profile_key, matcher_version, prompt_version)
);

CREATE INDEX IF NOT EXISTS idx_daily_news_cache_page
    ON daily_news_analysis_cache(page_date, store_profile_key);

-- commodity risk snapshots (explainable, versioned, idempotent upsert)
CREATE TABLE IF NOT EXISTS commodity_risk_snapshots (
    id                  BIGSERIAL PRIMARY KEY,
    page_date           DATE        NOT NULL,
    commodity_id        TEXT        NOT NULL,
    commodity_name      TEXT        NOT NULL,
    commodity_lane      TEXT        NOT NULL,
    commodity_type      TEXT        NOT NULL,
    risk_score          INT         NOT NULL,
    risk_tier           TEXT        NOT NULL,
    action_policy_tier  TEXT        NOT NULL,
    score_breakdown     JSONB       NOT NULL DEFAULT '{}',
    action_guides       JSONB       NOT NULL DEFAULT '[]',
    scm_risk_summary    TEXT        NOT NULL DEFAULT '',
    trend_summary       TEXT        NOT NULL DEFAULT '',
    trend_summary_prompt_version TEXT NOT NULL DEFAULT '',
    trend_summary_model TEXT        NOT NULL DEFAULT '',
    evidence_refs       JSONB       NOT NULL DEFAULT '[]',
    signal_snapshot     JSONB       NOT NULL DEFAULT '[]',
    related_article_ids BIGINT[]    NOT NULL DEFAULT '{}',
    relevance_judgment_summary TEXT NOT NULL DEFAULT '',
    store_profile_key   TEXT        NOT NULL DEFAULT 'default',
    store_context_hash  TEXT        NOT NULL DEFAULT 'default:v1',
    scorer_version      TEXT        NOT NULL,
    policy_version      TEXT        NOT NULL,
    prompt_version      TEXT        NOT NULL,
    relevance_version   TEXT        NOT NULL DEFAULT '',
    analysis_version    TEXT        NOT NULL,
    source_window_days  INT         NOT NULL DEFAULT 1,
    validation_issues   JSONB       NOT NULL DEFAULT '[]',
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (page_date, commodity_id, store_profile_key, scorer_version, analysis_version)
);

CREATE INDEX IF NOT EXISTS idx_risk_snapshots_page
    ON commodity_risk_snapshots(page_date, store_profile_key, risk_score DESC);

CREATE TABLE IF NOT EXISTS article_commodity_relevance_cache (
    id                  BIGSERIAL PRIMARY KEY,
    page_date           DATE        NOT NULL,
    article_id          BIGINT      NOT NULL REFERENCES news_articles(article_id) ON DELETE CASCADE,
    commodity_id        TEXT        NOT NULL,
    commodity_name      TEXT        NOT NULL,
    store_profile_key   TEXT        NOT NULL DEFAULT 'default',
    relevance_version   TEXT        NOT NULL,
    relevance_label     TEXT        NOT NULL,
    signal_type         TEXT        NOT NULL,
    signal_stage        TEXT        NOT NULL DEFAULT '',
    relevance_score     NUMERIC(8,4) NOT NULL DEFAULT 0,
    severity            INT         NOT NULL DEFAULT 0,
    judgment_reason     TEXT        NOT NULL DEFAULT '',
    candidate_features  JSONB       NOT NULL DEFAULT '{}',
    article_title       TEXT        NOT NULL DEFAULT '',
    article_summary     TEXT        NOT NULL DEFAULT '',
    article_url         TEXT        NOT NULL DEFAULT '',
    llm_refined         BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (page_date, article_id, commodity_id, store_profile_key, relevance_version)
);

CREATE INDEX IF NOT EXISTS idx_article_relevance_page
    ON article_commodity_relevance_cache(page_date, commodity_id, relevance_label);

ALTER TABLE commodity_risk_snapshots
    ADD COLUMN IF NOT EXISTS trend_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE commodity_risk_snapshots
    ADD COLUMN IF NOT EXISTS trend_summary_prompt_version TEXT NOT NULL DEFAULT '';
ALTER TABLE commodity_risk_snapshots
    ADD COLUMN IF NOT EXISTS trend_summary_model TEXT NOT NULL DEFAULT '';
ALTER TABLE commodity_risk_snapshots
    ADD COLUMN IF NOT EXISTS relevance_judgment_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE commodity_risk_snapshots
    ADD COLUMN IF NOT EXISTS relevance_version TEXT NOT NULL DEFAULT '';
ALTER TABLE commodity_risk_snapshots
    ADD COLUMN IF NOT EXISTS validation_issues JSONB NOT NULL DEFAULT '[]';
