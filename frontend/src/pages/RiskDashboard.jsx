import { useEffect, useRef, useState } from "react";
import {
  Droplets,
  Beef,
  Wheat,
  Sprout,
  Package,
  Apple,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Newspaper,
  Loader2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  X,
} from "lucide-react";

const RISK = {
  high: { label: "고위험", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  medium: { label: "주의", color: "var(--risk-med)", bg: "var(--risk-med-bg)" },
  low: { label: "안정", color: "var(--risk-low)", bg: "var(--risk-low-bg)" },
};

const RISK_ICONS = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: CheckCircle2,
};

const COMMODITY_ICONS = {
  식용유: Droplets,
  닭고기: Beef,
  쌀: Wheat,
  대파: Sprout,
  밀가루: Package,
  고구마: Apple,
};

const IMPACT_STYLE = {
  up: { label: "상승 압력", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  down: { label: "하락 요인", color: "var(--risk-low)", bg: "var(--risk-low-bg)" },
  unstable: { label: "불안정", color: "var(--risk-med)", bg: "var(--risk-med-bg)" },
};

const FALLBACK_PRIORITY = {
  high: 90,
  medium: 60,
  low: 30,
};

const MOCK_COMMODITY_SUMMARIES = [
  {
    id: "431",
    commodityName: "식용유",
    currentPrice: 189000,
    priceUnit: "18L",
    trendDirection: "up",
    trendSummary:
      "원달러 환율과 국제 원유가가 동시에 오르면서 수입 식용유 원가가 단기간에 빠르게 반영되고 있습니다.",
    riskLevel: "high",
    riskScore: 91,
    avgReferencePrice: 142000,
    priceDeltaPct: 33.1,
    chartData: [
      { date: "2026.02.20", price: 152000 },
      { date: "2026.02.27", price: 159000 },
      { date: "2026.03.06", price: 167000 },
      { date: "2026.03.13", price: 176000 },
      { date: "2026.03.20", price: 189000 },
    ],
    note: "수입 원재료 비중이 높아 환율 전가 속도가 빠릅니다.",
    rocketFeather: { isFeather: true, asymmetryRatio: 3.4 },
  },
  {
    id: "115",
    commodityName: "밀가루",
    currentPrice: 128000,
    priceUnit: "20kg",
    trendDirection: "up",
    trendSummary:
      "흑해 물류 차질과 곡물 선물가 상승이 겹치며 제분 원가가 높아졌고, 재고 교체 주기와 함께 인상 압력이 커졌습니다.",
    riskLevel: "high",
    riskScore: 84,
    avgReferencePrice: 104000,
    priceDeltaPct: 23.1,
    chartData: [
      { date: "2026.02.20", price: 108000 },
      { date: "2026.02.27", price: 111000 },
      { date: "2026.03.06", price: 116000 },
      { date: "2026.03.13", price: 121000 },
      { date: "2026.03.20", price: 128000 },
    ],
    note: "운송비와 제분사 조달 원가 상승이 동시에 반영되는 구간입니다.",
    rocketFeather: { isFeather: false, asymmetryRatio: 1.4 },
  },
  {
    id: "312",
    commodityName: "닭고기",
    currentPrice: 372000,
    priceUnit: "20kg",
    trendDirection: "up",
    trendSummary:
      "사료비와 냉장물류비가 누적되고, 외식 성수기 수요가 앞당겨지면서 도매 시세가 단단하게 올라온 상태입니다.",
    riskLevel: "high",
    riskScore: 77,
    avgReferencePrice: 324000,
    priceDeltaPct: 14.8,
    chartData: [
      { date: "2026.02.20", price: 331000 },
      { date: "2026.02.27", price: 338000 },
      { date: "2026.03.06", price: 348000 },
      { date: "2026.03.13", price: 361000 },
      { date: "2026.03.20", price: 372000 },
    ],
    note: "외식 수요가 붙는 시점이라 단기 협상력이 약해질 수 있습니다.",
    rocketFeather: { isFeather: true, asymmetryRatio: 2.2 },
  },
  {
    id: "215",
    commodityName: "대파",
    currentPrice: 7400,
    priceUnit: "1kg",
    trendDirection: "unstable",
    trendSummary:
      "출하량과 날씨 변수에 따라 가격이 크게 흔들리고 있어 단기 체감 변동성이 큰 품목입니다.",
    riskLevel: "medium",
    riskScore: 64,
    avgReferencePrice: 6700,
    priceDeltaPct: 10.4,
    chartData: [
      { date: "2026.02.20", price: 6200 },
      { date: "2026.02.27", price: 6900 },
      { date: "2026.03.06", price: 6500 },
      { date: "2026.03.13", price: 7100 },
      { date: "2026.03.20", price: 7400 },
    ],
    note: "단기 고점 가능성은 있으나 기상 변수에 따라 급락도 가능합니다.",
  },
  {
    id: "111",
    commodityName: "쌀",
    currentPrice: 81200,
    priceUnit: "20kg",
    trendDirection: "down",
    trendSummary:
      "정부 비축과 국내 수급이 안정적이라 가격 흐름이 비교적 완만하며, 급격한 상승 압력은 제한적입니다.",
    riskLevel: "low",
    riskScore: 31,
    avgReferencePrice: 83000,
    priceDeltaPct: -2.2,
    chartData: [
      { date: "2026.02.20", price: 84200 },
      { date: "2026.02.27", price: 83800 },
      { date: "2026.03.06", price: 82600 },
      { date: "2026.03.13", price: 81900 },
      { date: "2026.03.20", price: 81200 },
    ],
    note: "급격한 가격 리스크보다 재고 회전율 관리가 더 중요합니다.",
  },
  {
    id: "211",
    commodityName: "고구마",
    currentPrice: 26800,
    priceUnit: "10kg",
    trendDirection: "low",
    trendSummary:
      "산지 공급이 안정적이고 대체재 가격도 비슷하게 움직여 과도한 가격 전가 가능성은 크지 않습니다.",
    riskLevel: "low",
    riskScore: 24,
    avgReferencePrice: 26100,
    priceDeltaPct: 2.7,
    chartData: [
      { date: "2026.02.20", price: 25400 },
      { date: "2026.02.27", price: 25800 },
      { date: "2026.03.06", price: 26000 },
      { date: "2026.03.13", price: 26400 },
      { date: "2026.03.20", price: 26800 },
    ],
    note: "메뉴 판가에 바로 반영하기보다는 발주 주기 최적화가 우선입니다.",
  },
];

const MOCK_HIGH_RISK_DETAILS = {
  "431": {
    actionGuides: [
      {
        title: "선계약 단가 확인",
        content:
          "현재 공급 단가가 최근 4주 평균보다 얼마나 높은지 먼저 묻고, 동일 규격 기준 직전 발주 단가와 차이를 숫자로 비교하세요.",
      },
      {
        title: "대체 브랜드 협상",
        content:
          "메뉴 품질에 영향이 적은 범위에서 대체 브랜드와 혼합 사용 가능성을 확인하고, 최소 발주량 조건을 함께 재협상하세요.",
      },
      {
        title: "판가 반영 시점 분리",
        content:
          "식용유 인상분은 즉시 전가하지 말고, 2주 단위로 실제 사용량과 재고 소진 속도를 확인한 뒤 메뉴별로 분리 반영하세요.",
      },
    ],
    riskEvidence: [
      {
        newsTitle: "국제 유가 반등과 원달러 환율 재상승으로 수입 식용유 원가 압박 확대",
        newsDate: "2026-03-18",
        newsSummary:
          "원유 선물가와 원달러 환율이 같은 시기에 오르면서 정제유·식용유 수입업체의 매입 원가가 단기간에 빠르게 높아졌습니다.",
        reasoningToRisk:
          "식용유는 수입 비중이 높아 환율과 국제 시세가 함께 오르면 도매업체가 단가 인상 근거로 즉시 활용할 가능성이 큽니다.",
      },
      {
        newsTitle: "해상 운임 상승으로 식품 원재료 수입 물류비 재차 확대",
        newsDate: "2026-03-14",
        newsSummary:
          "동남아 노선 운임이 반등하면서 식품 원재료의 컨테이너 단가가 높아졌고, 대형 수입사부터 가격 조정을 검토하고 있습니다.",
        reasoningToRisk:
          "도입 원가가 오른 상황에서 물류비까지 붙으면 공급업체가 안전마진을 넓게 잡기 쉬워져 소상공인 체감 인상폭이 더 커질 수 있습니다.",
      },
    ],
  },
  "115": {
    actionGuides: [
      {
        title: "제분사 고시가 추적",
        content:
          "도매상이 제시한 가격이 실제 제분사 고시가 인상률과 일치하는지 확인하고, 운송비를 포함한 세부 항목을 따로 받아두세요.",
      },
      {
        title: "발주 시점 분산",
        content:
          "한 번에 큰 물량을 잡기보다 1주 단위 분할 발주로 평균 매입단가를 낮추고, 단기 급등 구간 노출을 줄이세요.",
      },
      {
        title: "메뉴 원가 방어",
        content:
          "튀김가루, 소스류처럼 밀가루 연동 비중이 높은 부재료까지 묶어서 원가표를 업데이트하고, 판가 조정은 세트 메뉴부터 검토하세요.",
      },
    ],
    riskEvidence: [
      {
        newsTitle: "흑해 곡물 물류 지연으로 밀 선물가 급등",
        newsDate: "2026-03-16",
        newsSummary:
          "주요 곡물 수출 경로의 물류 차질로 밀 선물가가 급등했고, 제분업계는 향후 수입 원가 상승을 예고했습니다.",
        reasoningToRisk:
          "수입 밀 가격 상승은 국내 제분가와 도매 밀가루 가격으로 이어지며, 재고가 교체되는 시점부터 체감 가격이 빠르게 올라갑니다.",
      },
      {
        newsTitle: "제분업계, 에너지비 상승 반영 검토",
        newsDate: "2026-03-12",
        newsSummary:
          "전력비와 포장재 비용이 동시에 오르면서 밀가루 제조단가 부담이 누적되고 있다는 보도가 나왔습니다.",
        reasoningToRisk:
          "원재료와 제조비가 동시에 오르면 도매업체가 폭넓은 가격 조정을 시도할 가능성이 커져 협상 근거를 미리 준비할 필요가 있습니다.",
      },
    ],
  },
  "312": {
    actionGuides: [
      {
        title: "규격별 단가 분리",
        content:
          "순살, 냉장육, 절단육을 구분해 단가를 따로 받아보면 공급업체가 전체 품목에 동일 인상률을 적용하는지 바로 확인할 수 있습니다.",
      },
      {
        title: "사료비 전가 검증",
        content:
          "사료비 상승을 이유로 인상한다면 최근 2개월 도매 시세와 함께 실제 농가·도계장 반영 시점을 물어 근거를 좁히세요.",
      },
      {
        title: "프로모션 기간 조정",
        content:
          "원가 급등 주간에는 할인 행사보다 객단가 방어가 우선입니다. 세트 할인은 유지하되, 사이드 증정 프로모션은 일시 축소하세요.",
      },
    ],
    riskEvidence: [
      {
        newsTitle: "국제 곡물가 상승으로 배합사료 비용 부담 확대",
        newsDate: "2026-03-19",
        newsSummary:
          "배합사료 업체들이 원료 옥수수와 대두박 가격 상승을 반영해 공급 단가 인상을 검토하고 있다는 내용이 보도됐습니다.",
        reasoningToRisk:
          "사료비는 닭고기 원가의 핵심 요소라 시차를 두고 도계·도매 가격으로 전이될 수 있어 소매 가격 압박이 이어질 가능성이 큽니다.",
      },
      {
        newsTitle: "외식 성수기 대비 냉장육 수요 선반영",
        newsDate: "2026-03-11",
        newsSummary:
          "학교 개학과 봄철 외식 수요 회복 기대가 반영되며 냉장육 매입이 선행되고 있다는 소식이 나왔습니다.",
        reasoningToRisk:
          "수요가 먼저 붙는 시기에는 도매상이 가격을 공격적으로 유지하기 쉬워, 단기 하락 신호가 보여도 실제 매입가는 늦게 내려올 수 있습니다.",
      },
    ],
  },
  "215": {
    actionGuides: [
      {
        title: "주간 시세 체크",
        content:
          "대파는 날씨 변수 영향이 커서 일주일만 지나도 단가가 크게 바뀔 수 있습니다. 고정 단가보다 주간 확인 체계를 두세요.",
      },
      {
        title: "손질 규격 분리",
        content:
          "손질 여부에 따라 실제 체감 원가가 달라지므로, 규격과 수율을 분리해 비교해야 불필요한 인상을 막을 수 있습니다.",
      },
      {
        title: "대체 메뉴 준비",
        content:
          "변동성이 커질 때는 garnish 양을 줄이거나 대체 채소를 검토해 고객 체감은 유지하면서 폐기 비용을 줄이세요.",
      },
    ],
    riskEvidence: [
      {
        newsTitle: "기상 변동성 확대로 일부 채소류 출하량 불안",
        newsDate: "2026-03-17",
        newsSummary:
          "일교차와 강수 영향으로 일부 산지의 채소류 출하량이 예상보다 줄어 단기 시세 변동성이 커지고 있다는 기사입니다.",
        reasoningToRisk:
          "대파는 날씨에 민감해 도매 시세가 갑자기 치솟을 수 있고, 도매상의 일괄 인상 제안이 실제 위험보다 크게 제시될 가능성도 있습니다.",
      },
    ],
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const normalizeRiskLevel = (value) => {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "low";
};

const formatPrice = (value) => `${Math.round(toNumber(value)).toLocaleString()}원`;

const formatDateLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  }
  if (/^\d{4}$/.test(raw)) {
    return `${raw.slice(0, 2)}.${raw.slice(2, 4)}`;
  }
  return raw.replaceAll("-", ".");
};

const normalizeChartData = (entries) => {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry, index) => {
      if (entry == null) {
        return null;
      }

      const rawDate = entry.date ?? entry.search_date ?? entry.label ?? `P${index + 1}`;
      const rawPrice = entry.price ?? entry.avg_price_current ?? entry.value ?? 0;

      return {
        date: formatDateLabel(rawDate),
        price: toNumber(rawPrice),
      };
    })
    .filter(Boolean);
};

const inferTrendDirection = ({ trendDirection, priceDeltaPct, chartData }) => {
  if (trendDirection === "up" || trendDirection === "down" || trendDirection === "unstable") {
    return trendDirection;
  }

  const delta = toNumber(priceDeltaPct);
  if (Math.abs(delta) >= 8) {
    return delta > 0 ? "up" : "down";
  }

  if (chartData.length >= 3) {
    const recent = chartData.slice(-3).map((point) => point.price);
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    if (max - min > Math.max(600, recent[recent.length - 1] * 0.08)) {
      return "unstable";
    }
  }

  return delta > 0 ? "up" : delta < 0 ? "down" : "unstable";
};

const buildTrendSummary = ({ commodityName, avgReferencePrice, priceDeltaPct, note, rocketFeather }) => {
  if (note) {
    return note;
  }

  const delta = toNumber(priceDeltaPct);
  const directionText = delta > 0 ? "높은 수준" : delta < 0 ? "낮은 수준" : "유사한 수준";
  const baseText = `${commodityName} 가격은 3년 평균 ${Math.round(toNumber(avgReferencePrice)).toLocaleString()}원 대비 ${Math.abs(delta).toFixed(1)}% ${directionText}입니다.`;

  if (rocketFeather?.is_feather) {
    return `${baseText} 최근 상승 속도가 하락 속도보다 ${toNumber(rocketFeather.asymmetry_ratio ?? rocketFeather.asymmetryRatio, 2).toFixed(1)}배 빨라 유통 단계의 과잉 전가 여부도 함께 점검해야 합니다.`;
  }

  return `${baseText} 최근 수급과 물류 변수에 대한 민감도가 커진 구간입니다.`;
};

const inferRiskScore = ({ riskScore, riskLevel, priceDeltaPct, rocketFeather }) => {
  if (Number.isFinite(Number(riskScore))) {
    return Number(riskScore);
  }

  const base = {
    high: 78,
    medium: 54,
    low: 28,
  }[normalizeRiskLevel(riskLevel)];

  const deltaBoost = Math.min(14, Math.abs(toNumber(priceDeltaPct)) / 2);
  const featherBoost = rocketFeather?.is_feather ? 6 : 0;
  return Math.round(base + deltaBoost + featherBoost);
};

const normalizeActionGuides = (guides) => {
  if (!Array.isArray(guides)) {
    return [];
  }

  return guides
    .map((guide) => ({
      title: String(guide?.title ?? "").trim(),
      content: String(guide?.content ?? "").trim(),
    }))
    .filter((guide) => guide.title && guide.content);
};

const normalizeRiskEvidence = (evidence) => {
  if (!Array.isArray(evidence)) {
    return [];
  }

  return evidence
    .map((entry) => ({
      newsTitle: String(entry?.newsTitle ?? "").trim(),
      newsDate: String(entry?.newsDate ?? "").trim(),
      newsSummary: String(entry?.newsSummary ?? "").trim(),
      reasoningToRisk: String(entry?.reasoningToRisk ?? "").trim(),
    }))
    .filter((entry) => entry.newsTitle && entry.newsSummary && entry.reasoningToRisk);
};

const buildFallbackDetail = (item) => ({
  actionGuides: [
    {
      title: "단가 근거 요청",
      content:
        `${item.commodityName} 인상분이 실제 도매 시세와 일치하는지 확인하기 위해 최근 2주 견적과 직전 발주 단가를 함께 비교하세요.`,
    },
    {
      title: "발주 주기 조정",
      content:
        `${item.commodityName} 재고 회전 속도에 맞춰 발주 시점을 쪼개면 급등 구간 노출을 줄이고 평균 매입단가를 완화할 수 있습니다.`,
    },
    {
      title: "메뉴 원가 분리",
      content:
        `${item.commodityName} 비중이 큰 메뉴만 선별해 원가표를 다시 계산하고, 전체 메뉴에 동일하게 가격을 전가하지 마세요.`,
    },
  ],
  riskEvidence: [
    {
      newsTitle: `${item.commodityName} 원가 상승 압력 점검 필요`,
      newsDate: item.chartData[item.chartData.length - 1]?.date ?? "최근",
      newsSummary: item.trendSummary,
      reasoningToRisk:
        `${item.commodityName}는 현재 ${Math.abs(toNumber(item.priceDeltaPct)).toFixed(1)}% 수준의 편차를 보이고 있어, 협상 없이 수용하면 실제 체감 원가가 빠르게 높아질 수 있습니다.`,
    },
  ],
});

const ensureThreeActionGuides = (guides, commodityName) => {
  const normalized = normalizeActionGuides(guides);

  if (normalized.length >= 3) {
    return normalized.slice(0, 3);
  }

  const fallback = buildFallbackDetail({
    commodityName,
    chartData: [],
    priceDeltaPct: 0,
    trendSummary: `${commodityName} 가격 변동에 대한 기본 대응 가이드입니다.`,
  }).actionGuides;

  return [...normalized, ...fallback].slice(0, 3);
};

const ensureEvidence = (evidence, item) => {
  const normalized = normalizeRiskEvidence(evidence);
  if (normalized.length > 0) {
    return normalized;
  }
  return buildFallbackDetail(item).riskEvidence;
};

const normalizeCommodity = (raw, index) => {
  const chartData = normalizeChartData(raw.chartData ?? raw.trend);
  const riskLevel = normalizeRiskLevel(raw.riskLevel ?? raw.greedflation_risk);
  const rocketFeather = raw.rocketFeather ?? raw.rocket_feather ?? null;
  const priceDeltaPct = toNumber(raw.priceDeltaPct ?? raw.price_delta_pct);
  const avgReferencePrice = toNumber(raw.avgReferencePrice ?? raw.avg_3year);
  const commodityName = String(raw.commodityName ?? raw.item_name ?? raw.name ?? `품목 ${index + 1}`);
  const currentPrice = toNumber(raw.currentPrice ?? raw.current_price);
  const trendSummary = buildTrendSummary({
    commodityName,
    avgReferencePrice,
    priceDeltaPct,
    note: raw.trendSummary ?? raw.note,
    rocketFeather,
  });

  return {
    id: String(raw.id ?? raw.item_code ?? raw.itemId ?? index),
    commodityName,
    currentPrice,
    priceUnit: String(raw.priceUnit ?? raw.unit ?? "원"),
    trendDirection: inferTrendDirection({
      trendDirection: raw.trendDirection,
      priceDeltaPct,
      chartData,
    }),
    trendSummary,
    riskLevel,
    riskScore: inferRiskScore({
      riskScore: raw.riskScore ?? raw.risk_score,
      riskLevel,
      priceDeltaPct,
      rocketFeather,
    }),
    chartData,
    actionGuides: normalizeActionGuides(raw.actionGuides),
    riskEvidence: normalizeRiskEvidence(raw.riskEvidence),
    avgReferencePrice,
    priceDeltaPct,
    note: String(raw.note ?? "").trim(),
    rocketFeather,
    originalIndex: index,
  };
};

const mergeCommodityDetail = (item, detail) => ({
  ...item,
  actionGuides: ensureThreeActionGuides(detail?.actionGuides ?? item.actionGuides, item.commodityName),
  riskEvidence: ensureEvidence(detail?.riskEvidence ?? item.riskEvidence, item),
});

const getSortPriority = (item) => {
  if (Number.isFinite(item.riskScore)) {
    return item.riskScore;
  }
  return FALLBACK_PRIORITY[item.riskLevel] ?? 0;
};

const sortCommodityCards = (items) =>
  [...items].sort((left, right) => {
    const priorityGap = getSortPriority(right) - getSortPriority(left);
    if (priorityGap !== 0) {
      return priorityGap;
    }
    return left.originalIndex - right.originalIndex;
  });

const buildMockDashboardViewModel = () => {
  const normalized = MOCK_COMMODITY_SUMMARIES.map((entry, index) => normalizeCommodity(entry, index));
  const merged = normalized.map((item) =>
    item.riskLevel === "high" ? mergeCommodityDetail(item, MOCK_HIGH_RISK_DETAILS[item.id]) : item
  );
  return sortCommodityCards(merged);
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("요청 시간 초과")), ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

const fetchCommoditySummaries = async (signal) => {
  const response = await fetch("/api/v1/commodities", { signal });
  if (!response.ok) {
    throw new Error("서버 오류");
  }
  return response.json();
};

const fetchHighRiskCommodityDetails = async (ids, signal) => {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const detailMap = {};
  ids.forEach((id) => {
    detailMap[id] = MOCK_HIGH_RISK_DETAILS[id] ?? null;
  });
  return detailMap;
};

const loadDashboardViewModel = async (signal) => {
  let summaryRaw;

  try {
    summaryRaw = await withTimeout(fetchCommoditySummaries(signal), 1500);
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }
    summaryRaw = buildMockDashboardViewModel();
    return summaryRaw;
  }

  const normalized = summaryRaw.map((entry, index) => normalizeCommodity(entry, index));
  const highRiskIds = normalized.filter((item) => item.riskLevel === "high").map((item) => item.id);
  const detailMap = await fetchHighRiskCommodityDetails(highRiskIds, signal);
  const merged = normalized.map((item) =>
    item.riskLevel === "high" ? mergeCommodityDetail(item, detailMap[item.id]) : item
  );

  return sortCommodityCards(merged);
};

const StatBadge = ({ level, label }) => {
  const risk = RISK[level] ?? RISK.low;
  const Icon = RISK_ICONS[level] ?? CheckCircle2;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold"
      style={{ color: risk.color, background: risk.bg }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {label}
    </span>
  );
};

const HoverTrendChart = ({ data, color, label }) => {
  const chartRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(data.length - 1);
  const [isHovering, setIsHovering] = useState(false);

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div
        className="h-28 rounded-xl flex items-center justify-center text-xs"
        style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)" }}
      >
        추이 데이터 없음
      </div>
    );
  }

  const width = 320;
  const height = 112;
  const paddingX = 14;
  const paddingTop = 12;
  const paddingBottom = 18;
  const max = Math.max(...data.map((point) => point.price));
  const min = Math.min(...data.map((point) => point.price));
  const range = max - min || 1;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const points = data.map((point, index) => {
    const ratio = data.length === 1 ? 0.5 : index / (data.length - 1);
    return {
      ...point,
      x: paddingX + ratio * innerWidth,
      y: paddingTop + ((max - point.price) / range) * innerHeight,
    };
  });

  const safeIndex = clamp(activeIndex, 0, points.length - 1);
  const activePoint = points[safeIndex];
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
  const tooltipLeft = clamp((activePoint.x / width) * 100, 12, 88);

  const updateHoverPoint = (clientX) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextRatio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nextIndex = Math.round(nextRatio * (points.length - 1));
    setActiveIndex(clamp(nextIndex, 0, points.length - 1));
  };

  return (
    <div
      ref={chartRef}
      className="relative h-28 rounded-xl"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={(event) => {
        setIsHovering(true);
        updateHoverPoint(event.clientX);
      }}
      onFocus={() => {
        setIsHovering(true);
        setActiveIndex(points.length - 1);
      }}
      onBlur={() => setIsHovering(false)}
      tabIndex={0}
      role="img"
      aria-label={`${label} 가격 추이 그래프`}
    >
      {isHovering && (
        <div
          className="absolute top-2 z-10 px-3 py-2 rounded-lg text-xs font-semibold pointer-events-none"
          style={{
            left: `${tooltipLeft}%`,
            transform: tooltipLeft > 70 ? "translateX(-100%)" : "translateX(-8%)",
            background: "rgba(255,255,255,0.96)",
            color: "var(--text-h)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div>{activePoint.date}</div>
          <div style={{ color }}>{formatPrice(activePoint.price)}</div>
        </div>
      )}

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id={`trend-fill-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <line
          x1={paddingX}
          y1={height - paddingBottom}
          x2={width - paddingX}
          y2={height - paddingBottom}
          stroke="var(--border)"
          strokeWidth="1"
        />
        <path d={areaPath} fill={`url(#trend-fill-${label})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3.5" fill={color} />

        {isHovering && (
          <>
            <line
              x1={activePoint.x}
              y1={paddingTop}
              x2={activePoint.x}
              y2={height - paddingBottom}
              stroke={color}
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#ffffff" stroke={color} strokeWidth="2.5" />
          </>
        )}
      </svg>
    </div>
  );
};

const CommodityCard = ({ item, onOpenGuide }) => {
  const risk = RISK[item.riskLevel] ?? RISK.low;
  const Icon = COMMODITY_ICONS[item.commodityName] ?? Package;
  const isClickable = item.riskLevel === "high";
  const isUp = item.priceDeltaPct > 0;
  const CardTag = isClickable ? "button" : "div";

  return (
    <CardTag
      type={isClickable ? "button" : undefined}
      onClick={isClickable ? () => onOpenGuide(item.id) : undefined}
      className={`rounded-2xl overflow-hidden flex flex-col text-left transition-all duration-200 ${
        isClickable ? "cursor-pointer hover:-translate-y-1" : ""
      }`}
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${isClickable ? "rgba(239, 68, 68, 0.18)" : "var(--border)"}`,
        boxShadow: isClickable ? "0 10px 28px rgba(239, 68, 68, 0.10)" : "var(--shadow-sm)",
        borderLeft: `4px solid ${risk.color}`,
      }}
      aria-haspopup={isClickable ? "dialog" : undefined}
    >
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: risk.bg }}
            >
              <Icon size={20} strokeWidth={2} style={{ color: risk.color }} />
            </div>
            <div>
              <p className="font-bold leading-tight" style={{ color: "var(--text-h)" }}>
                {item.commodityName}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text)", opacity: 0.7 }}>
                {item.priceUnit}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <StatBadge level={item.riskLevel} label={risk.label} />
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: "var(--bg-subtle)", color: "var(--text-h)", border: "1px solid var(--border)" }}
            >
              Risk {item.riskScore}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text)", opacity: 0.6 }}>
            현재 경락가
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
              {item.currentPrice.toLocaleString()}
            </span>
            <span className="text-sm" style={{ color: "var(--text)" }}>
              원
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="flex items-center text-sm font-bold" style={{ color: risk.color }}>
              {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="ml-0.5">{Math.abs(item.priceDeltaPct).toFixed(1)}%</span>
            </span>
            <span className="text-xs" style={{ color: "var(--text)", opacity: 0.65 }}>
              3년 평균 {item.avgReferencePrice.toLocaleString()}원 대비
            </span>
          </div>
        </div>

        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold" style={{ color: "var(--text-h)" }}>
              최근 가격 동향
            </p>
           
          </div>
          <HoverTrendChart data={item.chartData} color={risk.color} label={item.commodityName} />
        </div>

        <div
          className="rounded-xl p-3"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1.5"
            style={{ color: "var(--text)", opacity: 0.7 }}
          >
            Price Context
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{
              color: "var(--text-h)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.trendSummary}
          </p>
        </div>

        {item.rocketFeather?.is_feather && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}
          >
            <AlertTriangle size={14} />
            <span>
              하락 대비 {toNumber(item.rocketFeather.asymmetry_ratio ?? item.rocketFeather.asymmetryRatio, 0).toFixed(1)}배 속도로 상승
            </span>
          </div>
        )}

        {isClickable && (
          <div
            className="mt-auto flex items-center justify-between px-3 py-2 rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(248,250,252,0.6))",
              border: "1px solid rgba(239,68,68,0.16)",
              color: "var(--risk-high)",
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <ShieldCheck size={14} />
              행동 가이드 보기
            </div>
            <ChevronRight size={14} />
          </div>
        )}

        {!isClickable && item.note && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text)", opacity: 0.65 }}>
            {item.note}
          </p>
        )}
      </div>
    </CardTag>
  );
};

const ActionGuideCard = ({ guide, index }) => (
  <article
    className="rounded-2xl p-5 min-h-[220px] flex flex-col"
    style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)" }}
  >
    <div
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black mb-4"
      style={{ background: "rgba(79,70,229,0.08)", color: "#4f46e5" }}
    >
      {index + 1}
    </div>
    <h3 className="text-sm font-black mb-2" style={{ color: "#0f172a" }}>
      {guide.title}
    </h3>
    <p className="text-sm leading-6" style={{ color: "#475569" }}>
      {guide.content}
    </p>
  </article>
);

const RiskEvidenceCard = ({ evidence }) => (
  <article
    className="rounded-2xl overflow-hidden"
    style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
  >
    <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <Newspaper size={16} style={{ color: "#4f46e5" }} />
      <div>
        <p className="text-sm font-black" style={{ color: "#0f172a" }}>
          위험 근거
        </p>
        <p className="text-xs" style={{ color: "#64748b" }}>
          기사와 도매가격 연결 근거
        </p>
      </div>
    </div>

    <div className="p-5 space-y-4 max-h-[320px] overflow-y-auto">
      {evidence.map((entry, index) => (
        <section
          key={`${entry.newsTitle}-${index}`}
          className="rounded-xl p-4"
          style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h4 className="text-sm font-bold leading-snug" style={{ color: "#0f172a" }}>
              {entry.newsTitle}
            </h4>
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(79,70,229,0.08)", color: "#4f46e5" }}
            >
              <CalendarDays size={12} />
              {entry.newsDate}
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#94a3b8" }}>
                뉴스 내용
              </p>
              <p className="mt-1 leading-6" style={{ color: "#475569" }}>
                {entry.newsSummary}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#94a3b8" }}>
                위험 연결 근거
              </p>
              <p className="mt-1 leading-6" style={{ color: "#0f172a" }}>
                {entry.reasoningToRisk}
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  </article>
);

const CommodityGuideModal = ({ item, onClose }) => {
  useEffect(() => {
    if (!item) {
      return undefined;
    }

    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose]);

  if (!item) {
    return null;
  }

  const risk = RISK[item.riskLevel] ?? RISK.high;
  const Icon = COMMODITY_ICONS[item.commodityName] ?? Package;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(15, 23, 42, 0.34)" }} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`commodity-guide-${item.id}`}
        className="relative w-full max-w-5xl rounded-[28px] overflow-hidden fade-up"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 32px 64px rgba(15, 23, 42, 0.22)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="px-6 py-5 flex items-start justify-between gap-4"
          style={{
            background: "linear-gradient(180deg, rgba(248,250,252,0.96), rgba(255,255,255,1))",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: risk.bg, color: risk.color }}
            >
              <Icon size={22} strokeWidth={2.1} />
            </div>
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.18em] mb-1"
                style={{ color: risk.color }}
              >
                High Risk Action Pack
              </p>
              <h2 id={`commodity-guide-${item.id}`} className="text-2xl font-black" style={{ color: "#0f172a" }}>
                {item.commodityName} 대응 가이드
              </h2>
              <p className="mt-1 text-sm leading-6" style={{ color: "#475569" }}>
                {item.trendSummary}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}
            aria-label="팝업 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="overflow-x-auto">
            <div className="grid grid-cols-3 gap-4 min-w-[720px]">
              {item.actionGuides.map((guide, index) => (
                <ActionGuideCard key={`${guide.title}-${index}`} guide={guide} index={index} />
              ))}
            </div>
          </div>

          <RiskEvidenceCard evidence={item.riskEvidence} />
        </div>
      </div>
    </div>
  );
};

const NewsMatchCard = ({ match }) => {
  const impact = IMPACT_STYLE[match.impact] ?? IMPACT_STYLE.unstable;

  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-snug line-clamp-2" style={{ color: "var(--text-h)" }}>
          {match.title}
        </h3>
        {match.article_url && (
          <a href={match.article_url} target="_blank" rel="noreferrer" className="shrink-0 mt-0.5">
            <ExternalLink size={12} style={{ color: "var(--text)", opacity: 0.4 }} />
          </a>
        )}
      </div>
      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text)", opacity: 0.7 }}>
        {match.reason}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ color: impact.color, background: impact.bg }}
        >
          {impact.label}
        </span>
        {match.matched_commodities?.map((name) => (
          <span
            key={name}
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: "var(--accent-bg)",
              color: "var(--accent)",
              border: "1px solid var(--accent-border)",
            }}
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
};

const NewsPanel = ({ selectedDate }) => {
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const safeDate = selectedDate instanceof Date ? selectedDate : new Date();
  const dateStr = safeDate.toISOString().slice(0, 10);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setNewsData(null);

    fetch(`/api/v1/news/daily?date=${dateStr}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("뉴스 로딩 실패");
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setNewsData(data);
      })
      .catch((error) => {
        if (!cancelled && error?.name !== "AbortError") {
          setNewsData({ matches: [], total_articles: 0, filtered_count: 0 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dateStr]);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Newspaper size={16} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-bold" style={{ color: "var(--text-h)" }}>
            뉴스 기반 가격 영향 분석
          </span>
        </div>
        {newsData && (
          <span className="text-xs" style={{ color: "var(--text)", opacity: 0.5 }}>
            {newsData.total_articles}건 중 {newsData.matches.length}건 매칭
          </span>
        )}
      </div>

      <div className="p-4 space-y-3" style={{ maxHeight: 480, overflowY: "auto" }}>
        {loading && (
          <div className="flex items-center justify-center py-10 gap-2">
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
            <span className="text-sm" style={{ color: "var(--text)" }}>
              AI 분석 중...
            </span>
          </div>
        )}
        {!loading && newsData?.matches.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--text)", opacity: 0.5 }}>
            이 날짜에 품목 가격에 영향을 주는 뉴스가 없습니다
          </p>
        )}
        {!loading &&
          newsData?.matches.map((match) => <NewsMatchCard key={match.article_id ?? match.title} match={match} />)}
      </div>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="rounded-2xl h-[420px] animate-pulse" style={{ background: "var(--bg-subtle)" }} />
);

const RiskDashboard = ({ selectedDate }) => {
  const [data, setData] = useState(() => buildMockDashboardViewModel());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCommodityId, setActiveCommodityId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    loadDashboardViewModel(controller.signal)
      .then((items) => {
        setData(items);
      })
      .catch((loadError) => {
        if (loadError?.name !== "AbortError") {
          setError(loadError.message);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const activeCommodity = data.find((item) => item.id === activeCommodityId) ?? null;
  const counts = {
    high: data.filter((item) => item.riskLevel === "high").length,
    medium: data.filter((item) => item.riskLevel === "medium").length,
    low: data.filter((item) => item.riskLevel === "low").length,
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-40">
        <div
          className="px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2"
          style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}
        >
          <AlertTriangle size={14} />
          오류: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="max-w-5xl mx-auto relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
            가락시장 경락가 기준 · 3년 평균 대비 편차
          </p>
          <h1 className="text-3xl font-black tracking-tight mb-4" style={{ color: "var(--text-h)" }}>
            오늘의 식재료 위험 지수
          </h1>

          <div className="flex flex-wrap gap-2">
            {counts.high > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}
              >
                <AlertTriangle size={12} strokeWidth={3} />
                고위험 {counts.high}개 품목
              </div>
            )}
            {counts.medium > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: "var(--risk-med-bg)", color: "var(--risk-med)" }}
              >
                <AlertCircle size={12} strokeWidth={3} />
                주의 {counts.medium}개 품목
              </div>
            )}
            {counts.low > 0 && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ background: "var(--risk-low-bg)", color: "var(--risk-low)" }}
              >
                <CheckCircle2 size={12} strokeWidth={3} />
                안정 {counts.low}개 품목
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-7 space-y-7">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading && data.length === 0
            ? Array.from({ length: 6 }).map((_, index) => <SkeletonCard key={index} />)
            : data.map((item) => (
                <CommodityCard key={item.id} item={item} onOpenGuide={setActiveCommodityId} />
              ))}
        </div>

        <NewsPanel selectedDate={selectedDate} />
      </div>

      {activeCommodity && (
        <CommodityGuideModal item={activeCommodity} onClose={() => setActiveCommodityId(null)} />
      )}
    </div>
  );
};

export default RiskDashboard;
