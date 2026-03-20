from pydantic import BaseModel, Field
from typing import List, Literal


# ── 기존: 개별 기사 분석 (architect.py용) ──────────────────────

class CausalStep(BaseModel):
    step: int
    label: str
    description: str


class EconomicAnalysis(BaseModel):
    commodity: str = Field(..., description="The primary food item affected (e.g., White Onion, Broiler Chicken)")
    impact_severity: int = Field(..., ge=0, le=10, description="0 (None) to 10 (Critical)")
    causal_chain: List[CausalStep] = Field(..., description="The multi-hop journey from news to kitchen")
    time_lag_days: str = Field(..., description="Estimated days until this hits the SME invoice")
    greedflation_score: float = Field(..., description="Likelihood of unjustified price padding (0.0 - 10.0)")
    fair_price_rationale: str = Field(..., description="Logic for what the price SHOULD be")
    counter_arguments: List[str] = Field(..., description="Specific talking points for the owner to use with distributors")


# ── 신규: SCM 일일 브리프 (briefing.py용) ──────────────────────
#
#  SCM 문서 §7의 Signal → Relevance → Risk Tier → Action 흐름을
#  LLM 구조화 출력으로 구현한다.

SCM_STAGE = Literal[
    "upstream_production",
    "import_processing",
    "distribution_logistics",
    "store_procurement",
    "store_operations",
]

RISK_TIER = Literal["T0", "T1", "T2", "T3", "T4"]


class SCMSignal(BaseModel):
    """공급망에서 감지된 개별 신호 (SCM 문서 §3-5의 direct/proxy 분류)"""
    signal_type: Literal["direct", "proxy"] = Field(
        ...,
        description="direct=품목 가격에 직접 영향(살처분, 단가 인상, 수입 금지) / proxy=간접 영향(환율, 유가, 운임, 정책)",
    )
    label: str = Field(
        ...,
        description="신호 한줄 요약 — 예: 'AI 살처분 확대', '원/달러 환율 1,450원 돌파'",
    )
    scm_stage: SCM_STAGE = Field(
        ...,
        description="이 신호가 영향을 주는 공급망 단계",
    )
    description: str = Field(
        ...,
        description="이 신호가 해당 품목 가격에 어떻게 연결되는지 소상공인 관점 한 문장",
    )


class RiskTier(BaseModel):
    """SCM 문서 §7의 T0~T4 리스크 정책 분류"""
    tier: RISK_TIER = Field(
        ...,
        description="T0=무시 / T1=모니터링 / T2=저위험 대응 / T3=중위험 대응 / T4=긴급 검토",
    )
    label: str = Field(
        ...,
        description="사장님이 이해할 수 있는 한국어 레이블 — 예: '주의 관찰', '선제 대응 필요'",
    )
    reason: str = Field(
        ...,
        description="이 티어로 판단한 핵심 근거 한 문장",
    )


class ActionItem(BaseModel):
    """리스크 티어에 대응하는 구체적 행동 가이드"""
    title: str = Field(
        ...,
        description="행동 항목 제목 (4~8자) — 예: '재고 점검', '발주 시점 조정'",
    )
    content: str = Field(
        ...,
        description="구체적인 실행 방법 (2~3문장, 소상공인이 바로 따라할 수 있게)",
    )
    urgency: Literal["즉시", "1주내", "모니터링"] = Field(
        ...,
        description="행동 긴급도",
    )


class SCMBriefAnalysis(BaseModel):
    """LLM이 생성하는 SCM 분석 부분 (tool-use 스키마)"""
    trend_summary: str = Field(
        ...,
        description="오늘의 한줄 총평 — 사장님이 3초 안에 상황을 파악할 수 있는 문장",
    )
    signals: List[SCMSignal] = Field(
        ...,
        description="오늘 기사에서 감지된 공급망 신호 목록 (기사에서 확인된 사실만, 추측 금지)",
    )
    risk_tier: RiskTier = Field(
        ...,
        description="신호를 종합한 오늘의 리스크 티어",
    )
    action_items: List[ActionItem] = Field(
        ...,
        description="리스크 티어 수준에 맞는 행동 가이드 (T1이면 모니터링, T4면 즉각 행동)",
    )
    greedflation_flag: bool = Field(
        ...,
        description="도매업체의 과잉 가격 전가(Rocket & Feather) 의심 여부",
    )
    greedflation_note: str = Field(
        ...,
        description="그리드플레이션 판단 근거 한 문장, 해당 없으면 '해당없음'",
    )


class CommodityDailyBrief(BaseModel):
    """최종 API 응답용 — LLM 분석 + 메타데이터"""
    commodity_code: str
    commodity_name: str
    date: str
    trend_summary: str
    signals: List[SCMSignal]
    risk_tier: RiskTier
    action_items: List[ActionItem]
    greedflation_flag: bool
    greedflation_note: str
    related_article_ids: List[int]
