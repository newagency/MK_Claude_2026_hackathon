# 뉴스 → 공급망 리스크 분석 파이프라인

> 날짜 하나를 입력하면, 그날의 매일경제 뉴스에서 **소상공인 식재료 6개 품목**에 영향을 주는 기사를 자동으로 골라내고, 품목별 **공급망(SCM) 리스크 브리프**까지 생성합니다.

---

## 1. 전체 처리 흐름

```
날짜 입력 (예: 2025-10-02)
│
▼
┌─────────────────────────────────────────────────────┐
│  ① DB 조회  ──────────────────────── fetcher.py     │
│  해당일 전체 기사 로드                               │
│  예: 653건                                          │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  ② 1차 필터  ─────────────────────── fetcher.py     │
│  카테고리(소분류) OR 키워드 매칭                       │
│  예: 653건 → 32건                                   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  ③ LLM 매칭 (기사별 짧은 분석)  ──── matcher.py     │
│  Claude Sonnet  ·  25건씩 배치  ·  JSON 직접 출력    │
│  "이 기사가 6개 품목 중 어디에 영향?" + 한줄 reason    │
│  severity < 3 은 제외                                │
│  예: 32건 → 9건 매칭                                 │
│                                                     │
│  ───── GET /api/v1/news/daily?date=  응답 ─────     │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  ④ 품목별 그룹핑  ────────────────── briefing.py     │
│  쌀: 3건, 돼지: 1건, 사과: 2건                       │
│  계란·천일염·피마늘: 0건 → 건너뜀 (억지 분석 없음)     │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  ⑤ LLM SCM 브리프 (품목별 1회씩)  ── briefing.py    │
│  Claude Haiku  ·  tool-use 구조화 출력               │
│  기사 title + reason + summary 전문을 함께 전달       │
│                                                     │
│  쌀  3건 종합 → SCM 신호 + 리스크 티어 + 행동 가이드  │
│  사과 2건 종합 → ...                                 │
│  돼지 1건 종합 → ...                                 │
│                                                     │
│  ───── GET /api/v1/news/brief?date=  응답 ─────     │
└──────────────────────┬──────────────────────────────┘
                       ▼
           최종: 기사별 한줄 분석
                + 품목별 SCM 일일 브리프
```

---

## 2. API 엔드포인트

| 엔드포인트 | 단계 | 설명 | LLM |
|-----------|------|------|-----|
| `GET /api/v1/news/daily?date=2025-10-02` | ①②③ | 기사별 한줄 분석 반환 | Claude Sonnet |
| `GET /api/v1/news/brief?date=2025-10-02` | ④⑤ | 품목별 SCM 일일 브리프 | Claude Haiku |

- ③의 matcher 결과는 **메모리 캐시를 공유**합니다.
  `/brief`가 `/daily` 이후에 호출되면 ①②③을 다시 실행하지 않습니다.
- 캐시 TTL: **10분**, 최대 30개 날짜 보관.
- 프론트엔드는 날짜 변경 시 `/daily`와 `/brief`를 **동시에 프리페치**합니다.

---

## 3. 추적 품목 (6개)

| 코드 | 품목 | 기준 규격 | 선정 이유 | 1차 필터 키워드 |
|------|------|----------|----------|----------------|
| `egg` | 계란 | 특란 30구 · 일반란 | 가장 대중적인 기준 ("계란 한 판") | 계란, 달걀, 특란, 산란계, 조류독감, AI, 가금 |
| `pork` | 돼지 | 삼겹살 · 100g | 외식/가계 물가 상징 ('금겹살') | 돼지, 삼겹살, 돈육, 돈가, 금겹살, 양돈 |
| `apple` | 사과 | 후지 · 상품 · 10개 | 국민 과일, 체감 물가 바로미터 | 사과, 후지, 부사, 과일값, 과수 |
| `rice` | 쌀 | 20kg · 상품 | 주식(主食)의 척도, 20kg 포대 기준 | 쌀, 미가, 양곡, 수확량, 작황 |
| `salt` | 천일염 | 천일염 · 상품 · 5kg | 비상시 사재기 지표 (오염수, 김장) | 천일염, 소금, 소금값, 오염수, 김장 |
| `garlic` | 피마늘 | 난지(대서) · 상품 · 10kg | 선행 지표, 김장 시즌 필수 | 마늘, 피마늘, 난지, 대서, 김장, 마늘값 |

---

## 4. 단계별 상세

### ① DB 조회 — `fetcher.fetch_news_by_date()`

- `news_articles` 테이블에서 `service_date = '2025-10-02'` 조건으로 전체 기사 로드
- 반환 필드: `article_id`, `title`, `summary`, `main_category`, `keywords`, `article_url`, `service_daytime`

### ② 1차 필터 — `fetcher.filter_relevant()`

두 가지 조건의 **OR** 결합으로 LLM에 보낼 후보를 추린다:

| 조건 | 소스 | 예시 |
|------|------|------|
| **카테고리 매칭** | `news_article_categories.small_code_id` ∈ `RELEVANT_SMALL_CODES` | MK100315(농림축산업), MK101604(식품/음식료), MK100106(생활경제) 등 17개 |
| **키워드 매칭** | `title + summary` 텍스트에 6개 품목 키워드 포함 여부 | "쌀 20㎏에 6만원 돌파" → `쌀` 키워드 hit |

> 이 단계에서 "사과(apology)"처럼 동음이의어 오탐이 통과할 수 있지만, ③에서 LLM이 걸러냅니다.

### ③ LLM 매칭 — `matcher.match_news()`

**역할**: 1차 필터를 통과한 기사 중, 6개 추적 품목 가격에 **확실히** 영향을 주는 기사만 골라서 한줄 reason을 붙인다.

| 항목 | 값 |
|------|-----|
| **LLM** | Claude Sonnet (`claude-sonnet-4-20250514`) |
| **배치 크기** | 25건 |
| **출력 형식** | JSON 직접 출력 (tool-use 미사용) |
| **최소 severity** | 3 미만은 결과에서 제외 |

**프롬프트 핵심 규칙**:
1. 가격 변동과 **확실히** 연관된 기사만 매칭 — 간접적/애매한 것은 무시
2. 하나의 기사가 여러 품목에 영향을 줄 수 있음
3. 매칭이 없으면 빈 배열 `[]` 반환

**예시 — LLM에 보내는 메시지** (기사 3건 배치):
```
[ID:20251002001] 쌀 20㎏에 6만원 돌파 … 정부 시장격리 '부메랑'
요약: 정부의 시장격리 정책이 오히려 공급 부족을 심화시켜 쌀값이 20kg당 6만원을 돌파했다.
---
[ID:20251002002] 9월 소비자물가 2.1% 상승…두 달 만에 다시 2%대
요약: 통계청이 발표한 9월 소비자물가지수가 전년 동기 대비 2.1% 상승하며 2개월 만에 2%대로 복귀했다.
---
[ID:20251002003] '불닭볶음면' 바람불자 식품업계 매운맛 경쟁
요약: 삼양식품 불닭볶음면의 글로벌 성공에 다른 식품업체들도 매운맛 제품 출시를 늘리고 있다.
```

**예시 — LLM 응답**:
```json
[
  {
    "article_id": 20251002001,
    "matched_commodities": ["쌀"],
    "reason": "시장격리 정책 부메랑으로 쌀 20kg 6만원 돌파, 소상공인 식재료 원가 직접 상승",
    "impact": "up",
    "severity": 9
  },
  {
    "article_id": 20251002002,
    "matched_commodities": ["계란", "돼지", "사과"],
    "reason": "소비자물가 2%대 복귀, 식품류 전반적 가격 상승 압력 시사",
    "impact": "up",
    "severity": 4
  }
]
```
> ID `20251002003`은 6개 품목 가격에 직접 영향이 없어 매칭되지 않음

**최종 API 응답** (`GET /api/v1/news/daily?date=2025-10-02`):
```json
{
  "date": "2025-10-02",
  "total_articles": 653,
  "filtered_count": 32,
  "matches": [
    {
      "article_id": 20251002001,
      "title": "쌀 20㎏에 6만원 돌파 … 정부 시장격리 '부메랑'",
      "summary": "정부의 시장격리 정책이 오히려 공급 부족을 심화시켜...",
      "article_url": "https://www.mk.co.kr/news/economy/...",
      "matched_commodities": ["쌀"],
      "reason": "시장격리 정책 부메랑으로 쌀 20kg 6만원 돌파, 소상공인 식재료 원가 직접 상승",
      "impact": "up",
      "severity": 9
    },
    {
      "article_id": 20251002002,
      "title": "9월 소비자물가 2.1% 상승…두 달 만에 다시 2%대",
      "summary": "통계청이 발표한 9월 소비자물가지수가...",
      "article_url": "https://www.mk.co.kr/news/economy/...",
      "matched_commodities": ["계란", "돼지", "사과"],
      "reason": "소비자물가 2%대 복귀, 식품류 전반적 가격 상승 압력 시사",
      "impact": "up",
      "severity": 4
    }
  ]
}
```

---

### ④ 품목별 그룹핑 — `briefing._group_by_commodity()`

③의 matches를 품목 이름(`matched_commodities`) 기준으로 그룹핑한다.
하나의 기사가 여러 품목에 매칭되었으면 각 품목 그룹에 중복 포함된다.

```
입력: matches 9건

출력:
  쌀     → [ID:001, ID:005, ID:007]      3건
  돼지   → [ID:002]                       1건
  사과   → [ID:002, ID:009]              2건
  계란   → [ID:002]                       1건
  천일염 → []                             0건 → 건너뜀
  피마늘 → []                             0건 → 건너뜀
```

### ⑤ LLM SCM 브리프 — `briefing.generate_briefs()`

**역할**: 품목별로 매칭된 기사를 종합하여, 공급망(SCM) 관점의 리스크 분석을 **구조화된 JSON**으로 생성한다.

| 항목 | 값 |
|------|-----|
| **LLM** | Claude Haiku (`claude-3-5-haiku-20241022`) |
| **호출 방식** | 품목당 1회 호출 |
| **출력 강제** | Anthropic tool-use (`tool_choice: {type: "tool"}`) |
| **출력 스키마** | `SCMBriefAnalysis` Pydantic 모델 → JSON Schema |
| **토큰 전략** | title + reason + **전체 summary** 전송 (오탐 방지를 위해 충분한 컨텍스트 제공) |

**프롬프트 시스템 메시지** (`config.SCM_BRIEF_SYSTEM_PROMPT`) 핵심:
1. SCM 5단계에 신호를 매핑
2. direct(직접) / proxy(간접) 신호 분류
3. T0~T4 리스크 티어 판정
4. Rocket & Feather 그리드플레이션 감사
5. 근거 부족 시 보수적으로 낮은 티어 배정

**예시 — LLM에 보내는 메시지** (쌀, 3건 종합):
```
품목: 쌀
날짜: 2025-10-02
관련 기사 (3건):

1. [up / severity:9] 쌀 20㎏에 6만원 돌파 … 정부 시장격리 '부메랑'
   매칭 이유: 시장격리 정책 부메랑으로 쌀 20kg 6만원 돌파, 소상공인 식재료 원가 직접 상승
   요약: 정부의 시장격리 정책이 오히려 공급 부족을 심화시켜 쌀값이 20kg당 6만원을 돌파했다. 시장격리는 가격 안정을 위해 정부가 시장에서 쌀을 사들이는 정책인데, 오히려 유통 물량이 줄어 가격이 역으로 올랐다는 지적이다.

2. [up / severity:8] 8월 11%, 9월 15.9%…대책 없이 오르는 쌀값, 정부의 해명은
   매칭 이유: 쌀값 상승률 가속화(8월 11%→9월 15.9%), 정부 대책 부재로 추가 상승 우려
   요약: 쌀값 상승률이 8월 11%에서 9월 15.9%로 가속화되고 있다. 정부는 시장 수급에 문제가 없다는 입장이지만 현장에서는 체감 가격이 크게 올랐다는 반응이다.

3. [up / severity:8] "마지노선 넘은 쌀값, 일본 따라가나"…부메랑 돼 돌아온 정부 오판
   매칭 이유: 쌀값 사상 최고치 기록, 일본처럼 구조적 가격 상승 전환 가능성 경고
   요약: 국내 쌀값이 사상 최고치를 경신하며 일본형 구조적 고미가 시대로 진입할 수 있다는 경고가 나왔다. 재배면적 감소와 기후변화가 맞물리며 장기적 공급 감소가 우려된다.
```

**예시 — LLM 응답 (tool-use 구조화 출력)**:
```json
{
  "trend_summary": "쌀값이 20kg 6만원을 돌파하며 전월 대비 15.9% 급등, 정부 정책 실패와 구조적 공급 감소가 겹쳐 당분간 고가 기조가 이어질 전망입니다.",
  "signals": [
    {
      "signal_type": "direct",
      "label": "시장격리 부메랑으로 유통 물량 감소",
      "scm_stage": "distribution_logistics",
      "description": "정부 시장격리로 도매 유통량이 줄어 발주 리드타임이 늘어날 수 있습니다."
    },
    {
      "signal_type": "direct",
      "label": "쌀값 15.9% 급등 가속화",
      "scm_stage": "store_procurement",
      "description": "쌀 20kg 6만원 돌파로 발주 단가가 이미 크게 올랐으며, 추가 상승 시 메뉴 원가 비중이 급격히 높아집니다."
    },
    {
      "signal_type": "proxy",
      "label": "구조적 재배면적 감소 + 기후변화",
      "scm_stage": "upstream_production",
      "description": "재배면적 축소와 기후 리스크가 장기적 공급 감소를 시사하며, 가격 하방 반전이 어려울 수 있습니다."
    }
  ],
  "risk_tier": {
    "tier": "T3",
    "label": "선제 대응 필요",
    "reason": "direct 신호 2건(유통 감소 + 가격 급등)이 동시에 확인되고, 상승 가속화(8월→9월)가 진행 중이어서 단순 모니터링으로는 부족합니다."
  },
  "action_items": [
    {
      "title": "발주 시점 앞당기기",
      "content": "현재 거래처에 1~2주분 쌀 물량을 미리 확보하세요. 시장격리로 유통 물량이 줄어 납품 지연 가능성이 있습니다.",
      "urgency": "즉시"
    },
    {
      "title": "메뉴 믹스 조정 검토",
      "content": "쌀 원가 비중이 높은 메뉴(덮밥, 볶음밥 등)의 가격 또는 구성을 검토하세요. 밀가루 대체 메뉴(면, 빵) 비중 확대도 고려할 수 있습니다.",
      "urgency": "1주내"
    },
    {
      "title": "산지 직거래 타진",
      "content": "농협 직거래 장터 또는 인근 RPC(미곡종합처리장) 직배송 가격을 확인하세요. 유통 단계를 줄이면 kg당 200~500원 절감이 가능합니다.",
      "urgency": "1주내"
    }
  ],
  "greedflation_flag": false,
  "greedflation_note": "정부 시장격리 정책에 따른 유통 물량 감소와 실제 수급 불균형이 원인이므로, 현재 가격 상승은 수급 반영으로 판단됩니다."
}
```

**최종 API 응답** (`GET /api/v1/news/brief?date=2025-10-02`):
```json
{
  "date": "2025-10-02",
  "commodity_count": 3,
  "briefs": [
    {
      "commodity_code": "rice",
      "commodity_name": "쌀",
      "date": "2025-10-02",
      "trend_summary": "쌀값이 20kg 6만원을 돌파하며 ...",
      "signals": [ ... ],
      "risk_tier": { "tier": "T3", "label": "선제 대응 필요", "reason": "..." },
      "action_items": [ ... ],
      "greedflation_flag": false,
      "greedflation_note": "...",
      "related_article_ids": [20251002001, 20251002005, 20251002007]
    },
    {
      "commodity_code": "apple",
      "commodity_name": "사과",
      "date": "2025-10-02",
      "trend_summary": "...",
      "signals": [ ... ],
      "risk_tier": { "tier": "T1", "label": "주의 관찰", "reason": "..." },
      "action_items": [ ... ],
      "greedflation_flag": false,
      "greedflation_note": "해당없음",
      "related_article_ids": [20251002002, 20251002009]
    },
    {
      "commodity_code": "pork",
      "commodity_name": "돼지",
      "date": "2025-10-02",
      "trend_summary": "...",
      "signals": [ ... ],
      "risk_tier": { "tier": "T1", "label": "주의 관찰", "reason": "..." },
      "action_items": [ ... ],
      "greedflation_flag": false,
      "greedflation_note": "해당없음",
      "related_article_ids": [20251002002]
    }
  ]
}
```

> `briefs` 배열은 `risk_tier` 내림차순(T4 → T0)으로 정렬됩니다.

---

## 5. SCM 핵심 개념

### 5.1 공급망 5단계

| # | 코드 | 한글 레이블 | 범위 |
|---|------|-----------|------|
| 1 | `upstream_production` | 원료·사육 | 원료 생산, 사육, 작황, 질병 (예: AI 살처분, 가뭄) |
| 2 | `import_processing` | 수입·가공 | 수입, 검역, 통관, 도축, 정제, 제분 (예: 환율, 수입 금지) |
| 3 | `distribution_logistics` | 유통·물류 | 냉장냉동 유통, 도매, 납품, 운송 (예: 유가, 해상운임) |
| 4 | `store_procurement` | 발주·재고 | 점포 발주, 리드타임, 재고, 대체 공급처 (예: 납품가 인상) |
| 5 | `store_operations` | 매장·운영 | 메뉴 운영, 프로모션, 포장, 고객 대응 (예: 가격표 변경) |

### 5.2 신호(Signal) 분류

| 유형 | 설명 | 예시 |
|------|------|------|
| **direct** | 해당 품목 가격에 **직접** 영향 | AI 살처분, 산지 작황 피해, 단가 인상 통보, 수입 금지 |
| **proxy** | **간접적**으로 가격에 영향 | 환율 변동, 유가 상승, 해상 운임, 통상 정책, 에너지 비용 |

### 5.3 리스크 티어 (T0 ~ T4)

| 티어 | 레이블 | 판정 기준 | 소상공인 행동 수준 |
|------|--------|----------|------------------|
| **T0** | 무시 | 오탐이거나 관련성 매우 낮음 | — |
| **T1** | 모니터링 | proxy만 있거나 영향 불확실 | 뉴스 추적, 주간 체크 |
| **T2** | 저위험 대응 | direct 신호 있으나 영향 제한적 | 공급처 시세 문의, 재고 점검, 대체품 확인 |
| **T3** | 선제 대응 | direct + 가격 전가 진행 중 | 발주 앞당기기, 프로모션 강도 완화, 메뉴 믹스 조정 |
| **T4** | 긴급 검토 | 공급 차질 확실 + 대규모 영향 | 가격 인상 결정, 대량 선발주, 공급처 전면 전환 |

### 5.4 그리드플레이션 감사 (Rocket & Feather)

도매·유통 단계에서 **부당한 가격 전가**(원재료보다 빠르게 가격 올리기)를 감지합니다.

- 도매 인상 속도 > 원재료 상승 속도 → `greedflation_flag: true`
- proxy 신호**만**으로 직접 가격 전가 시도 → `greedflation_flag: true`
- 명확한 원가 상승 요인이 확인됨 → `greedflation_flag: false`

---

## 6. 프론트엔드 연동

### 화면 구성

```
┌────────────────────────────────────────┐
│  NavBar  (날짜 선택 + 탭)               │
├────────────────────────────────────────┤
│  RiskDashboard                         │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │ 계란  │ │ 돼지  │ │ 사과  │  ← 6개   │
│  │      │ │      │ │      │   카드    │
│  └──────┘ └──────┘ └──────┘           │
│  ┌──────┐ ┌──────┐ ┌──────┐           │
│  │  쌀  │ │천일염 │ │피마늘 │           │
│  └──────┘ └──────┘ └──────┘           │
│                                        │
│  [카드 클릭 시 모달]                      │
│  ┌──────────────────────────────────┐  │
│  │  CommodityDetailModal            │  │
│  │  ┌─ 관련 뉴스 ────────────────┐  │  │
│  │  │ 기사 제목 + 한줄분석 + 링크  │  │  │
│  │  │ 기사 제목 + 한줄분석 + 링크  │  │  │
│  │  └────────────────────────────┘  │  │
│  │  ┌─ 공급망(SCM) 분석 ─────────┐  │  │
│  │  │ Risk Tier 배지 + 이유       │  │  │
│  │  │ Signal 카드들               │  │  │
│  │  │ Action Item 카드들          │  │  │
│  │  │ 그리드플레이션 경고 (있을 때)  │  │  │
│  │  └────────────────────────────┘  │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

### 데이터 흐름

1. **날짜 변경** → `RiskDashboard`의 `useEffect`가 `/api/v1/news/daily`와 `/api/v1/news/brief`를 **동시 호출**
2. **카드 클릭** → `activeCommodityId` 설정 → 이미 프리페치된 데이터에서 해당 품목 필터링
3. **모달 표시** → `CommodityDetailModal`에 뉴스 매칭 + SCM 브리프 전달
4. 데이터 로딩 중에는 각 섹션에 **스피너** 표시

---

## 7. 캐싱 전략

| 캐시 키 | 저장 내용 | 공유 |
|---------|----------|------|
| `match:{date}` | ①②③ 파이프라인 결과 (fetch → filter → match) | `/daily`와 `/brief` 양쪽에서 재사용 |
| `daily:{date}` | `/news/daily` 최종 응답 | — |
| `brief:{date}` | `/news/brief` 최종 응답 | — |

- **TTL**: 600초 (10분)
- **LRU**: 최대 30개 날짜, 초과 시 가장 오래된 항목 제거

---

## 8. Pydantic 출력 스키마 (`analysis.py`)

```
SCMBriefAnalysis (tool-use로 LLM이 생성)
├── trend_summary: str          "사장님이 3초 안에 파악하는 한 문장"
├── signals: List[SCMSignal]
│   ├── signal_type: "direct" | "proxy"
│   ├── label: str              "AI 살처분 확대"
│   ├── scm_stage: SCM_STAGE    "upstream_production"
│   └── description: str        소상공인 관점 한 문장
├── risk_tier: RiskTier
│   ├── tier: "T0"~"T4"
│   ├── label: str              "선제 대응 필요"
│   └── reason: str             판정 근거
├── action_items: List[ActionItem]
│   ├── title: str              "발주 시점 조정" (4~8자)
│   ├── content: str            구체적 실행 방법 (2~3문장)
│   └── urgency: "즉시" | "1주내" | "모니터링"
├── greedflation_flag: bool
└── greedflation_note: str

CommodityDailyBrief (API 응답용 = SCMBriefAnalysis + 메타데이터)
├── commodity_code: str         "egg"
├── commodity_name: str         "계란"
├── date: str                   "2025-10-02"
├── (... SCMBriefAnalysis 필드 전부 ...)
└── related_article_ids: List[int]
```

---

## 9. 추천 테스트 날짜

| 날짜 | 총 기사 | 관련 기사 | 특징 |
|------|--------|----------|------|
| **2025-10-02** | 653건 | 32건 | **쌀값 폭등** (20kg 6만원 돌파, 15.9% 상승, 정부 정책 실패) + 소비자물가 2%대 복귀 + 식품업계/유통 뉴스 다수. 6개 품목 중 4~5개에 매칭 기대 |
| 2025-12-25 | 396건 | 30건 | **조류독감(AI) 계란값 급등** (한 판 7000원, 살처분 300만 마리, 에그플레이션) + 고환율 물가 경고 |
| 2025-03-20 | 740건 | — | 6개 품목 키워드 **모두** 매칭되는 유일한 날짜 (5/28 이전) |

> 디폴트 날짜는 `2025-10-02`로 설정되어 있습니다 (`App.jsx`).

---

## 10. 관련 파일 목록

| 파일 | 역할 |
|------|------|
| `backend/app/api/news.py` | API 라우터 — `/news/daily`, `/news/brief` + 캐시 관리 |
| `backend/app/services/news/fetcher.py` | DB 조회 (`fetch_news_by_date`) + 1차 필터 (`filter_relevant`) |
| `backend/app/services/news/matcher.py` | LLM 기사별 매칭 — Claude Sonnet, 25건 배치, JSON 출력 |
| `backend/app/services/news/config.py` | 품목·키워드·프롬프트 설정 (matcher + briefing 모두) |
| `backend/app/services/llm/briefing.py` | LLM 품목별 SCM 브리프 생성 — Claude Haiku, tool-use |
| `backend/app/schemas/analysis.py` | Pydantic 스키마 — `SCMSignal`, `RiskTier`, `ActionItem`, `SCMBriefAnalysis`, `CommodityDailyBrief` |
| `frontend/src/pages/RiskDashboard.jsx` | 대시보드 UI — 카드 6개 + `CommodityDetailModal` |
| `frontend/src/components/NavBar.jsx` | 날짜 선택 + 탭 네비게이션 |
| `frontend/src/data/mockCommodities.js` | 목업 데이터 (API 응답 전 fallback) |
| `SCM_AND_SERVICE_GRAPHS.md` | SCM 설계 원본 문서 (SCOR-lite 기반) |
