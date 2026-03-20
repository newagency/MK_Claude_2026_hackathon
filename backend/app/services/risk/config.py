from __future__ import annotations

MATCHER_VERSION = "matcher_v2"
PROMPT_VERSION = "prompt_v2"
SCORER_VERSION = "risk_scorer_v1"
POLICY_VERSION = "action_policy_v1"
ANALYSIS_VERSION = "daily_snapshot_v1"
RELEVANCE_VERSION = "relevance_v3"
TREND_SUMMARY_PROMPT_VERSION = "trend_summary_v1"
TREND_SUMMARY_MODEL = "claude-sonnet-4-20250514"
RELEVANCE_LLM_MODEL = "claude-sonnet-4-20250514"

DEFAULT_STORE_PROFILE_KEY = "default"
DEFAULT_STORE_CONTEXT_HASH = "default:v1"
PRICE_LOOKBACK_WINDOW_DAYS = 14
MAX_ARTICLES_PER_COMMODITY = 4
RELEVANCE_BORDERLINE_MIN = 0.42
RELEVANCE_BORDERLINE_MAX = 0.68

UI_TIER_THRESHOLDS = {
    "stable_max": 39,
    "caution_max": 69,
}

ACTION_POLICY_THRESHOLDS = {
    "T0": 19,
    "T1": 39,
    "T2": 54,
    "T3": 74,
}

SCORE_WEIGHTS = {
    "signal_directness": 0.18,
    "source_confidence": 0.10,
    "recency_decay": 0.08,
    "corroboration_count": 0.12,
    "price_confirmation": 0.17,
    "supply_stage_criticality": 0.15,
    "store_exposure": 0.12,
    "severity": 0.18,
}

STAGE_CRITICALITY = {
    "upstream_production": 0.90,
    "import_processing": 0.85,
    "distribution_logistics": 0.75,
    "store_procurement": 0.70,
    "store_operations": 0.55,
}

POLICY_TO_UI_TIER = {
    "T0": "stable",
    "T1": "stable",
    "T2": "caution",
    "T3": "caution",
    "T4": "high",
}

COMMODITY_REGISTRY = {
    "egg": {
        "name": "계란",
        "lane": "market_sensitive",
        "commodity_type": "protein",
        "store_exposure": {
            "dependency": 0.72,
            "usage_frequency": 0.84,
            "substitutability": 0.42,
        },
    },
    "pork": {
        "name": "돼지",
        "lane": "market_sensitive",
        "commodity_type": "protein",
        "store_exposure": {
            "dependency": 0.68,
            "usage_frequency": 0.76,
            "substitutability": 0.38,
        },
    },
    "apple": {
        "name": "사과",
        "lane": "market_sensitive",
        "commodity_type": "produce",
        "store_exposure": {
            "dependency": 0.34,
            "usage_frequency": 0.28,
            "substitutability": 0.70,
        },
    },
    "rice": {
        "name": "쌀",
        "lane": "market_sensitive",
        "commodity_type": "grain",
        "store_exposure": {
            "dependency": 0.54,
            "usage_frequency": 0.62,
            "substitutability": 0.48,
        },
    },
    "salt": {
        "name": "천일염",
        "lane": "market_sensitive",
        "commodity_type": "seasoning",
        "store_exposure": {
            "dependency": 0.26,
            "usage_frequency": 0.64,
            "substitutability": 0.82,
        },
    },
    "garlic": {
        "name": "피마늘",
        "lane": "market_sensitive",
        "commodity_type": "produce",
        "store_exposure": {
            "dependency": 0.46,
            "usage_frequency": 0.58,
            "substitutability": 0.45,
        },
    },
    "packaging": {
        "name": "포장재",
        "lane": "reorder",
        "commodity_type": "ops_consumable",
        "store_exposure": {
            "dependency": 0.86,
            "usage_frequency": 0.96,
            "substitutability": 0.30,
        },
    },
    "sanitary": {
        "name": "위생 소모품",
        "lane": "reorder",
        "commodity_type": "ops_consumable",
        "store_exposure": {
            "dependency": 0.80,
            "usage_frequency": 0.92,
            "substitutability": 0.44,
        },
    },
    "locked_sku": {
        "name": "잠금 SKU",
        "lane": "compliance",
        "commodity_type": "compliance_locked",
        "store_exposure": {
            "dependency": 0.90,
            "usage_frequency": 0.72,
            "substitutability": 0.05,
        },
    },
}

MARKET_SENSITIVE_CODES = [
    code
    for code, meta in COMMODITY_REGISTRY.items()
    if meta["lane"] == "market_sensitive"
]
