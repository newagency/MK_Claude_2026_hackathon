import { useEffect, useRef, useState } from "react";
import {
  Egg,
  PiggyBank,
  Wheat,
  Apple,
  Waves,
  Flower2,
  Package,
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
  Link2,
  X,
} from "lucide-react";
import { MOCK_COMMODITY_SUMMARIES, MOCK_HIGH_RISK_DETAILS } from "../data/mockCommodities";

const RISK = {
  high: { label: "고위험", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  medium: { label: "주의", color: "var(--risk-med)", bg: "var(--risk-med-bg)" },
  low: { label: "안정", color: "var(--risk-low)", bg: "var(--risk-low-bg)" },
};

const RISK_ICONS = { high: AlertTriangle, medium: AlertCircle, low: CheckCircle2 };

const COMMODITY_ICONS = {
  계란: Egg,
  돼지: PiggyBank,
  사과: Apple,
  쌀: Wheat,
  천일염: Waves,
  피마늘: Flower2,
};

const IMPACT_STYLE = {
  up: { label: "상승 압력", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  down: { label: "하락 요인", color: "var(--risk-low)", bg: "var(--risk-low-bg)" },
  unstable: { label: "불안정", color: "var(--risk-med)", bg: "var(--risk-med-bg)" },
};

const FALLBACK_PRIORITY = { high: 90, medium: 60, low: 30 };

const TIER_STYLE = {
  T0: { label: "무시", color: "#94a3b8", bg: "#f1f5f9" },
  T1: { label: "모니터링", color: "#3b82f6", bg: "#eff6ff" },
  T2: { label: "저위험 대응", color: "#f59e0b", bg: "#fffbeb" },
  T3: { label: "선제 대응", color: "#f97316", bg: "#fff7ed" },
  T4: { label: "긴급 검토", color: "#ef4444", bg: "#fef2f2" },
};

const URGENCY_STYLE = {
  즉시: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  "1주내": { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  모니터링: { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
};

const SCM_STAGE_LABEL = {
  upstream_production: "원료·사육",
  import_processing: "수입·가공",
  distribution_logistics: "유통·물류",
  store_procurement: "발주·재고",
  store_operations: "매장·운영",
};

// ── Utility functions ──────────────────────────────────────
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const toNumber = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
const normalizeRiskLevel = (v) => (v === "high" || v === "medium" || v === "low" ? v : "low");
const formatDateLabel = (v) => {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  if (/^\d{4}$/.test(raw)) return `${raw.slice(0, 2)}.${raw.slice(2, 4)}`;
  return raw.replaceAll("-", ".");
};

const normalizeChartData = (entries) => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((e, i) => e == null ? null : ({
      date: formatDateLabel(e.date ?? e.search_date ?? e.label ?? `P${i + 1}`),
      price: toNumber(e.price ?? e.avg_price_current ?? e.value),
    }))
    .filter(Boolean);
};

const inferTrendDirection = ({ trendDirection, priceDeltaPct, chartData }) => {
  if (["up", "down", "unstable"].includes(trendDirection)) return trendDirection;
  const d = toNumber(priceDeltaPct);
  if (Math.abs(d) >= 8) return d > 0 ? "up" : "down";
  if (chartData.length >= 3) {
    const r = chartData.slice(-3).map((p) => p.price);
    if (Math.max(...r) - Math.min(...r) > Math.max(600, r[r.length - 1] * 0.08)) return "unstable";
  }
  return d > 0 ? "up" : d < 0 ? "down" : "unstable";
};

const buildTrendSummary = ({ commodityName, avgReferencePrice, priceDeltaPct, note, rocketFeather }) => {
  if (note) return note;
  const d = toNumber(priceDeltaPct);
  const dir = d > 0 ? "높은 수준" : d < 0 ? "낮은 수준" : "유사한 수준";
  const base = `${commodityName} 가격은 3년 평균 ${Math.round(toNumber(avgReferencePrice)).toLocaleString()}원 대비 ${Math.abs(d).toFixed(1)}% ${dir}입니다.`;
  if (rocketFeather?.is_feather) {
    return `${base} 최근 상승 속도가 하락 속도보다 ${toNumber(rocketFeather.asymmetry_ratio ?? rocketFeather.asymmetryRatio, 2).toFixed(1)}배 빨라 유통 단계의 과잉 전가 여부도 함께 점검해야 합니다.`;
  }
  return `${base} 최근 수급과 물류 변수에 대한 민감도가 커진 구간입니다.`;
};

const inferRiskScore = ({ riskScore, riskLevel, priceDeltaPct, rocketFeather }) => {
  if (Number.isFinite(Number(riskScore))) return Number(riskScore);
  const base = { high: 78, medium: 54, low: 28 }[normalizeRiskLevel(riskLevel)];
  return Math.round(base + Math.min(14, Math.abs(toNumber(priceDeltaPct)) / 2) + (rocketFeather?.is_feather ? 6 : 0));
};

const normalizeCommodity = (raw, index) => {
  const chartData = normalizeChartData(raw.chartData ?? raw.trend);
  const riskLevel = normalizeRiskLevel(raw.riskLevel ?? raw.greedflation_risk);
  const rocketFeather = raw.rocketFeather ?? raw.rocket_feather ?? null;
  const priceDeltaPct = toNumber(raw.priceDeltaPct ?? raw.price_delta_pct);
  const avgReferencePrice = toNumber(raw.avgReferencePrice ?? raw.avg_3year);
  const commodityName = String(raw.commodityName ?? raw.item_name ?? raw.name ?? `품목 ${index + 1}`);
  return {
    id: String(raw.id ?? raw.item_code ?? raw.itemId ?? index),
    commodityName,
    subLabel: raw.subLabel || "",
    currentPrice: toNumber(raw.currentPrice ?? raw.current_price),
    priceUnit: String(raw.priceUnit ?? raw.unit ?? "원"),
    trendDirection: inferTrendDirection({ trendDirection: raw.trendDirection, priceDeltaPct, chartData }),
    trendSummary: buildTrendSummary({ commodityName, avgReferencePrice, priceDeltaPct, note: raw.trendSummary ?? raw.note, rocketFeather }),
    riskLevel,
    riskScore: inferRiskScore({ riskScore: raw.riskScore ?? raw.risk_score, riskLevel, priceDeltaPct, rocketFeather }),
    chartData,
    avgReferencePrice,
    priceDeltaPct,
    note: String(raw.note ?? "").trim(),
    rocketFeather,
    originalIndex: index,
  };
};

const sortCommodityCards = (items) =>
  [...items].sort((a, b) => {
    const gap = (b.riskScore ?? FALLBACK_PRIORITY[b.riskLevel] ?? 0) - (a.riskScore ?? FALLBACK_PRIORITY[a.riskLevel] ?? 0);
    return gap !== 0 ? gap : a.originalIndex - b.originalIndex;
  });

const buildMockDashboardViewModel = () => {
  const normalized = MOCK_COMMODITY_SUMMARIES.map((e, i) => normalizeCommodity(e, i));
  return sortCommodityCards(normalized);
};

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("요청 시간 초과")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });

const fetchCommoditySummaries = async (signal) => {
  const r = await fetch("/api/v1/commodities", { signal });
  if (!r.ok) throw new Error("서버 오류");
  return r.json();
};

const loadDashboardViewModel = async (signal) => {
  let summaryRaw;
  try {
    summaryRaw = await withTimeout(fetchCommoditySummaries(signal), 1500);
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    return buildMockDashboardViewModel();
  }
  if (!Array.isArray(summaryRaw) || summaryRaw.length < 2) return buildMockDashboardViewModel();
  const normalized = summaryRaw.map((e, i) => normalizeCommodity(e, i));
  return sortCommodityCards(normalized);
};

// ── Small reusable components ──────────────────────────────

const StatBadge = ({ level, label }) => {
  const risk = RISK[level] ?? RISK.low;
  const Icon = RISK_ICONS[level] ?? CheckCircle2;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ color: risk.color, background: risk.bg }}
    >
      <Icon size={12} strokeWidth={2.5} /> {label}
    </span>
  );
};

// ── HoverTrendChart ────────────────────────────────────────

const HoverTrendChart = ({ data, color, label }) => {
  const svgRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(null);

  if (!data || data.length < 2) return null;

  const W = 260, H = 56, PX = 4, PY = 6;
  const prices = data.map((d) => d.price);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const toX = (i) => PX + ((W - PX * 2) / (data.length - 1)) * i;
  const toY = (p) => PY + (H - PY * 2) * (1 - (p - minP) / range);
  const pathD = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.price)}`).join(" ");
  const areaD = `${pathD} L${toX(data.length - 1)},${H} L${toX(0)},${H} Z`;

  const handleMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let closest = 0, minDist = Infinity;
    data.forEach((_, i) => { const d = Math.abs(toX(i) - x); if (d < minDist) { minDist = d; closest = i; } });
    setActiveIndex(closest);
  };

  const activePoint = activeIndex != null ? { x: toX(activeIndex), y: toY(data[activeIndex].price) } : null;

  return (
    <div className="relative w-full h-full">
      {activeIndex != null && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-1 text-[11px] font-semibold pointer-events-none" style={{ color: "var(--text-h)" }}>
          <span>{data[activeIndex].date}</span>
          <span>{data[activeIndex].price.toLocaleString()}원</span>
        </div>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-full" onMouseMove={handleMove} onMouseLeave={() => setActiveIndex(null)}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${label})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {activePoint && (
          <>
            <line x1={activePoint.x} y1={PY} x2={activePoint.x} y2={H - PY} stroke={color} strokeWidth="1" opacity="0.3" strokeDasharray="3 3" />
            <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#fff" stroke={color} strokeWidth="2.5" />
          </>
        )}
      </svg>
    </div>
  );
};

// ── CommodityCard ──────────────────────────────────────────

const CommodityCard = ({ item, onOpenDetail }) => {
  const risk = RISK[item.riskLevel] ?? RISK.low;
  const Icon = COMMODITY_ICONS[item.commodityName] ?? Package;
  const isUp = item.priceDeltaPct > 0;

  return (
    <button
      type="button"
      onClick={() => onOpenDetail(item.id)}
      className="rounded-2xl overflow-hidden flex flex-col text-left transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${item.riskLevel === "high" ? "rgba(239,68,68,0.15)" : "var(--border)"}`,
        boxShadow: item.riskLevel === "high"
          ? `0 4px 24px rgba(239,68,68,0.12), inset 0 1px 0 0 rgba(239,68,68,0.08)`
          : item.riskLevel === "medium"
            ? `0 4px 24px rgba(245,158,11,0.10), inset 0 1px 0 0 rgba(245,158,11,0.06)`
            : `0 2px 12px rgba(0,0,0,0.04)`,
      }}
    >
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Row 1: Name + Risk */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: risk.bg }}>
              <Icon size={16} strokeWidth={2} style={{ color: risk.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate" style={{ color: "var(--text-h)" }}>{item.commodityName}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text)", opacity: 0.5 }}>{item.subLabel || item.priceUnit}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatBadge level={item.riskLevel} label={risk.label} />
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "var(--bg-subtle)", color: "var(--text-h)", border: "1px solid var(--border)" }}>
              {item.riskScore}
            </span>
          </div>
        </div>

        {/* Row 2: Price + Chart side-by-side */}
        <div className="flex gap-3 items-end">
          <div className="shrink-0">
            <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--text)", opacity: 0.5 }}>현재 경락가</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tracking-tight leading-none" style={{ color: "var(--text-h)" }}>{item.currentPrice.toLocaleString()}</span>
              <span className="text-xs" style={{ color: "var(--text)" }}>원</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="flex items-center text-xs font-bold" style={{ color: risk.color }}>
                {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span className="ml-0.5">{Math.abs(item.priceDeltaPct).toFixed(1)}%</span>
              </span>
              <span className="text-[10px]" style={{ color: "var(--text)", opacity: 0.55 }}>3년 {item.avgReferencePrice.toLocaleString()}원</span>
            </div>
          </div>
          <div className="flex-1 min-w-0" style={{ height: 52 }}>
            <HoverTrendChart data={item.chartData} color={risk.color} label={item.commodityName} />
          </div>
        </div>

        {/* Row 3: Price Context */}
        <div className="rounded-lg px-3 py-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-h)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.trendSummary}
          </p>
        </div>

        {/* Row 4: Rocket Feather (conditional) */}
        {item.rocketFeather?.isFeather && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}>
            <AlertTriangle size={12} />
            <span>하락 대비 {toNumber(item.rocketFeather.asymmetryRatio, 0).toFixed(1)}배 속도로 상승</span>
          </div>
        )}

        {/* Row 5: CTA */}
        <div className="mt-auto flex items-center justify-between px-2.5 py-1.5 rounded-lg"
          style={{ background: `linear-gradient(135deg, ${risk.bg}, rgba(248,250,252,0.6))`, border: `1px solid ${risk.color}22`, color: risk.color }}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <ShieldCheck size={12} />
            상세 분석 보기
          </div>
          <ChevronRight size={12} />
        </div>
      </div>
    </button>
  );
};

// ── CommodityDetailModal ───────────────────────────────────

const NewsMatchItem = ({ match }) => {
  const impact = IMPACT_STYLE[match.impact] ?? IMPACT_STYLE.unstable;
  return (
    <div className="rounded-xl p-4 space-y-2.5" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold leading-snug line-clamp-2" style={{ color: "#0f172a" }}>{match.title}</h4>
        {match.article_url && (
          <a href={match.article_url} target="_blank" rel="noreferrer" className="shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100" title="기사 원문 보기">
            <ExternalLink size={13} style={{ color: "#64748b" }} />
          </a>
        )}
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{match.reason}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: impact.color, background: impact.bg }}>{impact.label}</span>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "#f1f5f9", color: "#475569" }}>
          심각도 {match.severity}
        </span>
        {match.matched_commodities?.map((name) => (
          <span key={name} className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
};

const SCMSignalCard = ({ signal }) => {
  const isDirect = signal.signal_type === "direct";
  const stageLabel = SCM_STAGE_LABEL[signal.scm_stage] || signal.scm_stage;
  return (
    <div className="rounded-xl p-3.5 space-y-1.5" style={{ background: "#fff", border: `1px solid ${isDirect ? "#fecaca" : "#bfdbfe"}` }}>
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
          style={{ color: isDirect ? "#dc2626" : "#2563eb", background: isDirect ? "#fef2f2" : "#eff6ff" }}>
          {isDirect ? "DIRECT" : "PROXY"}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#f1f5f9", color: "#475569" }}>
          {stageLabel}
        </span>
      </div>
      <p className="text-sm font-bold" style={{ color: "#0f172a" }}>{signal.label}</p>
      <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{signal.description}</p>
    </div>
  );
};

const ActionItemCard = ({ action }) => {
  const style = URGENCY_STYLE[action.urgency] ?? URGENCY_STYLE["모니터링"];
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: "#fff", border: `1px solid ${style.border}` }}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-black" style={{ color: "#0f172a" }}>{action.title}</h4>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ color: style.color, background: style.bg }}>
          {action.urgency}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{action.content}</p>
    </div>
  );
};

const SCM_PIPELINE_STAGES = [
  { code: "upstream_production", label: "원료·사육", icon: "🌾" },
  { code: "import_processing", label: "수입·가공", icon: "🚢" },
  { code: "distribution_logistics", label: "유통·물류", icon: "🚛" },
  { code: "store_procurement", label: "발주·재고", icon: "📦" },
  { code: "store_operations", label: "매장·운영", icon: "🏪" },
];

const CommodityDetailModal = ({ item, newsMatches, scmBrief, newsLoading, briefLoading, onClose }) => {
  useEffect(() => {
    if (!item) return;
    const handle = (e) => { if (e.key === "Escape") onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handle);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", handle); };
  }, [onClose, item]);

  if (!item) return null;

  const risk = RISK[item.riskLevel] ?? RISK.low;
  const Icon = COMMODITY_ICONS[item.commodityName] ?? Package;
  const tier = scmBrief?.risk_tier;
  const tierStyle = tier ? (TIER_STYLE[tier.tier] ?? TIER_STYLE.T1) : null;

  const hitStages = new Set((scmBrief?.signals ?? []).map((s) => s.scm_stage));
  const signalsByStage = {};
  (scmBrief?.signals ?? []).forEach((s) => {
    (signalsByStage[s.scm_stage] ??= []).push(s);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.34)" }} />

      <div
        role="dialog" aria-modal="true"
        className="relative w-full max-w-4xl rounded-[28px] overflow-hidden fade-up my-8"
        style={{ background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 32px 64px rgba(15,23,42,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-5 flex items-start justify-between gap-4" style={{ background: "linear-gradient(180deg, rgba(248,250,252,0.96), #fff)", borderBottom: "1px solid #e2e8f0" }}>
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: risk.bg, color: risk.color }}>
              <Icon size={22} strokeWidth={2.1} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-2xl font-black" style={{ color: "#0f172a" }}>{item.commodityName}</h2>
                {tierStyle && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-black" style={{ color: tierStyle.color, background: tierStyle.bg }}>
                    {tier.tier} {tierStyle.label}
                  </span>
                )}
              </div>
              <p className="text-sm leading-6" style={{ color: "#475569" }}>
                {scmBrief?.trend_summary || item.trendSummary}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100 shrink-0" style={{ background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Action Bar (고정, 스크롤 밖) ── */}
        {!briefLoading && scmBrief?.action_items?.length > 0 && (
          <div className="px-6 py-4 grid grid-cols-3 gap-3" style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            {scmBrief.action_items.slice(0, 3).map((a, i) => {
              const us = URGENCY_STYLE[a.urgency] ?? URGENCY_STYLE["모니터링"];
              return (
                <div key={i} className="rounded-xl p-3 flex flex-col gap-1.5" style={{ background: "#fff", border: `1px solid ${us.border}` }}>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black truncate" style={{ color: "#0f172a" }}>{a.title}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold shrink-0" style={{ color: us.color, background: us.bg }}>{a.urgency}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: "#64748b", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.content}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div className="p-6 space-y-7" style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>

          {/* ▸ Section 1: 공급망 파이프라인 시각화 */}
          {!briefLoading && scmBrief?.signals?.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Link2 size={16} style={{ color: "#4f46e5" }} />
                <h3 className="text-sm font-black" style={{ color: "#0f172a" }}>공급망 영향 분석</h3>
              </div>

              {/* Pipeline bar */}
              <div className="flex items-center gap-0 mb-5 px-1">
                {SCM_PIPELINE_STAGES.map((stage, idx) => {
                  const isHit = hitStages.has(stage.code);
                  const hasDirectHit = (signalsByStage[stage.code] ?? []).some((s) => s.signal_type === "direct");
                  return (
                    <div key={stage.code} className="flex items-center" style={{ flex: 1 }}>
                      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-base transition-all"
                          style={{
                            background: isHit ? (hasDirectHit ? "#fef2f2" : "#eff6ff") : "#f8fafc",
                            border: `2px solid ${isHit ? (hasDirectHit ? "#ef4444" : "#3b82f6") : "#e2e8f0"}`,
                            boxShadow: isHit ? `0 0 0 3px ${hasDirectHit ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)"}` : "none",
                          }}
                        >
                          {stage.icon}
                        </div>
                        <span className="text-[10px] font-bold text-center leading-tight" style={{ color: isHit ? "#0f172a" : "#94a3b8" }}>
                          {stage.label}
                        </span>
                      </div>
                      {idx < SCM_PIPELINE_STAGES.length - 1 && (
                        <div className="w-full h-0.5 -mt-5 mx-0.5" style={{ background: "#e2e8f0", flex: "0 0 auto", width: 16 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Signal detail cards, grouped by stage */}
              <div className="space-y-3">
                {SCM_PIPELINE_STAGES.filter((st) => signalsByStage[st.code]).map((st) => (
                  <div key={st.code}>
                    {signalsByStage[st.code].map((s, i) => {
                      const isDirect = s.signal_type === "direct";
                      return (
                        <div key={i} className="rounded-xl p-3.5 flex items-start gap-3 mb-2" style={{ background: "#fff", border: `1px solid ${isDirect ? "#fecaca" : "#bfdbfe"}` }}>
                          <span className="text-lg shrink-0 mt-0.5">{st.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{s.label}</span>
                              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                                style={{ color: isDirect ? "#dc2626" : "#2563eb", background: isDirect ? "#fef2f2" : "#eff6ff" }}>
                                {isDirect ? "직접" : "간접"}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{s.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ▸ Section 2: 리스크 판정 + 그리드플레이션 */}
          {!briefLoading && scmBrief && tier && (
            <section>
              <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tierStyle.color}33` }}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: tierStyle.bg }}>
                  <ShieldCheck size={18} style={{ color: tierStyle.color }} />
                  <span className="text-sm font-black" style={{ color: tierStyle.color }}>리스크 판정 — {tier.tier} {tierStyle.label}</span>
                </div>
                <div className="px-4 py-3" style={{ background: "#fff" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{tier.reason}</p>
                </div>
                {scmBrief.greedflation_flag && (
                  <div className="px-4 py-3 flex items-start gap-2" style={{ background: "#fef2f2", borderTop: "1px solid #fecaca" }}>
                    <AlertTriangle size={14} style={{ color: "#dc2626" }} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-black" style={{ color: "#dc2626" }}>그리드플레이션 의심 — </span>
                      <span className="text-xs" style={{ color: "#475569" }}>{scmBrief.greedflation_note}</span>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ▸ Section 2 alt: 로딩 / 데이터 없음 */}
          {briefLoading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: "#4f46e5" }} />
              <span className="text-sm" style={{ color: "#64748b" }}>공급망 분석 생성 중...</span>
            </div>
          )}
          {!briefLoading && !scmBrief && (
            <div className="rounded-xl py-6 text-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <p className="text-sm" style={{ color: "#94a3b8" }}>분석할 뉴스 데이터가 부족합니다</p>
            </div>
          )}

          {/* ▸ Section 3: 관련 뉴스 (근거) */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Newspaper size={16} style={{ color: "#64748b" }} />
              <h3 className="text-sm font-bold" style={{ color: "#64748b" }}>근거 뉴스</h3>
              {!newsLoading && newsMatches && (
                <span className="text-xs ml-auto" style={{ color: "#94a3b8" }}>{newsMatches.length}건</span>
              )}
            </div>

            {newsLoading && (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 size={16} className="animate-spin" style={{ color: "#94a3b8" }} />
                <span className="text-sm" style={{ color: "#94a3b8" }}>뉴스 분석 중...</span>
              </div>
            )}

            {!newsLoading && (!newsMatches || newsMatches.length === 0) && (
              <div className="rounded-xl py-6 text-center" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <p className="text-sm" style={{ color: "#94a3b8" }}>이 날짜에 {item.commodityName} 관련 뉴스가 없습니다</p>
              </div>
            )}

            {!newsLoading && newsMatches && newsMatches.length > 0 && (
              <div className="space-y-2">
                {newsMatches.map((m) => <NewsMatchItem key={m.article_id ?? m.title} match={m} />)}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

// ── Skeleton ───────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="rounded-2xl h-[260px] animate-pulse" style={{ background: "var(--bg-subtle)" }} />
);

// ── RiskDashboard (main) ───────────────────────────────────

const RiskDashboard = ({ selectedDate }) => {
  const [data, setData] = useState(() => buildMockDashboardViewModel());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeCommodityId, setActiveCommodityId] = useState(null);

  const [newsData, setNewsData] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [briefData, setBriefData] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const safeDate = selectedDate instanceof Date ? selectedDate : new Date(2025, 9, 2);
  const dateStr = safeDate.toISOString().slice(0, 10);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loadDashboardViewModel(controller.signal)
      .then(setData)
      .catch((e) => { if (e?.name !== "AbortError") setError(e.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Prefetch news daily
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setNewsLoading(true);
    setNewsData(null);

    fetch(`/api/v1/news/daily?date=${dateStr}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setNewsData(d); })
      .catch(() => { if (!cancelled) setNewsData({ matches: [] }); })
      .finally(() => { if (!cancelled) setNewsLoading(false); });

    return () => { cancelled = true; controller.abort(); };
  }, [dateStr]);

  // Prefetch SCM briefs
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setBriefLoading(true);
    setBriefData(null);

    fetch(`/api/v1/news/brief?date=${dateStr}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { if (!cancelled) setBriefData(d); })
      .catch(() => { if (!cancelled) setBriefData({ briefs: [] }); })
      .finally(() => { if (!cancelled) setBriefLoading(false); });

    return () => { cancelled = true; controller.abort(); };
  }, [dateStr]);

  const activeCommodity = data.find((item) => item.id === activeCommodityId) ?? null;

  const activeNewsMatches = activeCommodity && newsData?.matches
    ? newsData.matches.filter((m) => m.matched_commodities?.includes(activeCommodity.commodityName))
    : [];

  const activeScmBrief = activeCommodity && briefData?.briefs
    ? briefData.briefs.find((b) => b.commodity_name === activeCommodity.commodityName || b.commodity_code === activeCommodity.id)
    : null;

  const counts = {
    high: data.filter((i) => i.riskLevel === "high").length,
    medium: data.filter((i) => i.riskLevel === "medium").length,
    low: data.filter((i) => i.riskLevel === "low").length,
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2" style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}>
          <AlertTriangle size={14} /> 오류: {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="max-w-6xl mx-auto px-5 relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
            가락시장 경락가 기준 · 3년 평균 대비 편차
          </p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
              오늘의 식재료 위험 지수
            </h1>
            <div className="flex flex-wrap gap-1.5">
              {counts.high > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}>
                  <AlertTriangle size={11} strokeWidth={3} /> 고위험 {counts.high}개 품목
                </div>
              )}
              {counts.medium > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "var(--risk-med-bg)", color: "var(--risk-med)" }}>
                  <AlertCircle size={11} strokeWidth={3} /> 주의 {counts.medium}개 품목
                </div>
              )}
              {counts.low > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "var(--risk-low-bg)", color: "var(--risk-low)" }}>
                  <CheckCircle2 size={11} strokeWidth={3} /> 안정 {counts.low}개 품목
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 pb-4 pt-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {loading && data.length === 0
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : data.map((item) => (
                <CommodityCard key={item.id} item={item} onOpenDetail={setActiveCommodityId} />
              ))}
        </div>
      </div>

      {activeCommodity && (
        <CommodityDetailModal
          item={activeCommodity}
          newsMatches={activeNewsMatches}
          scmBrief={activeScmBrief}
          newsLoading={newsLoading}
          briefLoading={briefLoading}
          onClose={() => setActiveCommodityId(null)}
        />
      )}
    </div>
  );
};

export default RiskDashboard;
