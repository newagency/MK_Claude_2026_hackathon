import { useEffect, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Zap,
  ArrowRight,
  Shield,
  Egg,
  PiggyBank,
  Wheat,
  Apple,
  Waves,
  Flower2,
  Package,
  Loader2,
  ChevronRight,
  Newspaper,
  BarChart3,
  CircleDot,
} from "lucide-react";

const RISK_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const RISK_BG = { high: "rgba(239,68,68,0.08)", medium: "rgba(245,158,11,0.08)", low: "rgba(34,197,94,0.08)" };
const RISK_LABEL = { high: "고위험", medium: "주의", low: "안정" };
const RISK_ICON = { high: AlertTriangle, medium: AlertCircle, low: CheckCircle2 };
const COMMODITY_ICONS = { 계란: Egg, 돼지: PiggyBank, 사과: Apple, 쌀: Wheat, 천일염: Waves, 피마늘: Flower2 };

const URGENCY_STYLE = {
  즉시: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  "1주내": { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  모니터링: { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
};

const fmtDate = (d) => {
  if (!(d instanceof Date)) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const rl = (v) => (v === "high" || v === "medium" || v === "low" ? v : "low");

/* ━━ Hero ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const Hero = ({ level, headline, subtext, counts, loading, dateStr }) => {
  const color = RISK_COLOR[level];
  const RIcon = RISK_ICON[level] || CheckCircle2;

  return (
    <div className="text-center pt-6 pb-5 px-4">
      {loading ? (
        <>
          <Loader2 size={36} className="animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <p className="text-lg font-bold" style={{ color: "var(--text)" }}>뉴스를 분석하고 있습니다...</p>
        </>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-3" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
            <RIcon size={14} style={{ color }} />
            <span className="text-xs font-bold" style={{ color }}>{RISK_LABEL[level]}</span>
            <span className="text-[10px]" style={{ color: "var(--text)", opacity: 0.5 }}>{dateStr}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-2" style={{ color: "var(--text-h)" }}>
            {headline}
          </h1>

          <p className="text-sm max-w-lg mx-auto mb-4" style={{ color: "var(--text)", lineHeight: 1.7 }}>
            {subtext}
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {counts.high > 0 && (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl" style={{ background: RISK_BG.high }}>
                <AlertTriangle size={14} style={{ color: RISK_COLOR.high }} />
                <span className="text-xs font-bold" style={{ color: RISK_COLOR.high }}>고위험 {counts.high}개</span>
              </div>
            )}
            {counts.medium > 0 && (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl" style={{ background: RISK_BG.medium }}>
                <AlertCircle size={14} style={{ color: RISK_COLOR.medium }} />
                <span className="text-xs font-bold" style={{ color: RISK_COLOR.medium }}>주의 {counts.medium}개</span>
              </div>
            )}
            {counts.low > 0 && (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl" style={{ background: RISK_BG.low }}>
                <CheckCircle2 size={14} style={{ color: RISK_COLOR.low }} />
                <span className="text-xs font-bold" style={{ color: RISK_COLOR.low }}>안정 {counts.low}개</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ━━ Action Card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const ActionCard = ({ action, index, onNavigate }) => {
  const us = URGENCY_STYLE[action.urgency] ?? URGENCY_STYLE["모니터링"];
  return (
    <button
      className="rounded-2xl px-5 py-4 flex flex-col gap-2.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg group w-full"
      style={{ background: "#fff", border: `1.5px solid ${us.border}` }}
      onClick={() => onNavigate("auditor")}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black" style={{ background: us.bg, color: us.color }}>
            {index + 1}
          </div>
          <span className="text-[13px] font-black" style={{ color: "var(--text-h)" }}>{action.title}</span>
        </div>
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ color: us.color, background: us.bg }}>
          {action.urgency}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {action.content || action.detail}
      </p>
      <div className="flex items-center justify-between">
        {action.commodity && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{action.commodity}</span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--accent)" }}>
          자세히 <ArrowRight size={10} />
        </span>
      </div>
    </button>
  );
};

/* ━━ Commodity Row ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const CommodityRow = ({ item, rank, onNavigate }) => {
  const risk = rl(item.riskLevel ?? item.greedflation_risk);
  const color = RISK_COLOR[risk];
  const name = item.commodityName ?? item.item_name ?? item.name ?? "품목";
  const Icon = COMMODITY_ICONS[name] ?? Package;
  const price = toNum(item.currentPrice ?? item.current_price);
  const delta = toNum(item.priceDeltaPct ?? item.price_delta_pct);
  const isUp = delta > 0;

  return (
    <button
      className="flex items-center gap-4 px-5 py-4 rounded-2xl w-full text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
      style={{ background: "#fff", border: `1px solid ${risk === "high" ? `${color}30` : "var(--border)"}` }}
      onClick={() => onNavigate("dashboard")}
    >
      <span className="text-xs font-black tabular-nums w-4 text-center" style={{ color: risk === "low" ? "#cbd5e1" : color }}>{rank}</span>

      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}0c` }}>
        <Icon size={20} style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-bold" style={{ color: "var(--text-h)" }}>{name}</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider" style={{ background: `${color}10`, color }}>{RISK_LABEL[risk]}</span>
        </div>
        <p className="text-[11px] truncate" style={{ color: "var(--text)", opacity: 0.65 }}>
          {item.trendSummary || item.note || ""}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-base font-black tabular-nums" style={{ color: "var(--text-h)" }}>
          {price > 0 ? price.toLocaleString() : "—"}
          <span className="text-[10px] font-medium ml-0.5" style={{ color: "var(--text)", opacity: 0.4 }}>원</span>
        </p>
        {delta !== 0 && (
          <div className="flex items-center justify-end gap-0.5" style={{ color }}>
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span className="text-xs font-bold tabular-nums">{isUp ? "+" : ""}{delta.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <ChevronRight size={14} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text)" }} />
    </button>
  );
};

/* ━━ News Card ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const NewsCard = ({ match, onNavigate }) => {
  const sevColor = match.severity >= 7 ? RISK_COLOR.high : match.severity >= 4 ? RISK_COLOR.medium : RISK_COLOR.low;
  const sevBg = match.severity >= 7 ? RISK_BG.high : match.severity >= 4 ? RISK_BG.medium : RISK_BG.low;

  return (
    <button
      className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-left w-full transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
      style={{ background: "#fff", border: "1px solid var(--border)" }}
      onClick={() => onNavigate("auditor")}
    >
      <div className="shrink-0 mt-1">
        <CircleDot size={8} style={{ color: sevColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-snug line-clamp-2 mb-1.5" style={{ color: "var(--text-h)" }}>{match.title}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(match.matched_commodities ?? []).map((c) => (
            <span key={c} className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{c}</span>
          ))}
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: sevBg, color: sevColor }}>
            심각도 {match.severity}
          </span>
        </div>
      </div>
      <ChevronRight size={12} className="shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text)" }} />
    </button>
  );
};

/* ━━ Section Header ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const SectionHeader = ({ icon: SIcon, title, count, actionLabel, onAction }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-bg)" }}>
        <SIcon size={14} style={{ color: "var(--accent)" }} />
      </div>
      <h2 className="text-sm font-black tracking-tight" style={{ color: "var(--text-h)" }}>{title}</h2>
      {count != null && count > 0 && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-bg)", color: "var(--accent)" }}>{count}</span>
      )}
    </div>
    {actionLabel && onAction && (
      <button onClick={onAction} className="flex items-center gap-1 text-[11px] font-bold hover:underline" style={{ color: "var(--accent)" }}>
        {actionLabel} <ArrowRight size={12} />
      </button>
    )}
  </div>
);

/* ━━ Main ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const HomePage = ({ selectedDate, onNavigate }) => {
  const safeDate = selectedDate instanceof Date ? selectedDate : new Date(2025, 9, 2);
  const dateStr = fmtDate(safeDate);

  const [commodities, setCommodities] = useState([]);
  const [comLoading, setComLoading] = useState(true);
  const [newsMatches, setNewsMatches] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [actionItems, setActionItems] = useState([]);
  const [briefLoading, setBriefLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();

    setComLoading(true);
    fetch("/api/v1/commodities", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCommodities(d); setComLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") setComLoading(false); });

    setNewsLoading(true);
    fetch(`/api/v1/news/daily?date=${dateStr}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { setNewsMatches(d.matches || []); setNewsLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") setNewsLoading(false); });

    setBriefLoading(true);
    fetch(`/api/v1/news/brief?date=${dateStr}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const items = [];
        for (const brief of Object.values(d.briefs || {})) {
          for (const a of brief.action_items || []) items.push({ ...a, commodity: brief.commodity_name });
        }
        items.sort((a, b) => {
          const ord = { 즉시: 0, "1주내": 1, 모니터링: 2 };
          return (ord[a.urgency] ?? 3) - (ord[b.urgency] ?? 3);
        });
        setActionItems(items);
        setBriefLoading(false);
      })
      .catch((e) => { if (e.name !== "AbortError") setBriefLoading(false); });

    return () => ctrl.abort();
  }, [dateStr]);

  const sorted = [...commodities].sort((a, b) => {
    const riskOrd = { high: 0, medium: 1, low: 2 };
    const ra = riskOrd[rl(a.riskLevel ?? a.greedflation_risk)] ?? 2;
    const rb = riskOrd[rl(b.riskLevel ?? b.greedflation_risk)] ?? 2;
    if (ra !== rb) return ra - rb;
    return Math.abs(toNum(b.priceDeltaPct ?? b.price_delta_pct)) - Math.abs(toNum(a.priceDeltaPct ?? a.price_delta_pct));
  });

  const counts = {
    high: sorted.filter((c) => rl(c.riskLevel ?? c.greedflation_risk) === "high").length,
    medium: sorted.filter((c) => rl(c.riskLevel ?? c.greedflation_risk) === "medium").length,
    low: sorted.filter((c) => rl(c.riskLevel ?? c.greedflation_risk) === "low").length,
  };

  const urgentCount = actionItems.filter((a) => a.urgency === "즉시").length;
  const weekCount = actionItems.filter((a) => a.urgency === "1주내").length;
  const urgentNames = actionItems.filter((a) => a.urgency === "즉시").map((a) => a.commodity).filter(Boolean);
  const uniqueUrgentNames = [...new Set(urgentNames)];

  const overallRisk = urgentCount >= 2 ? "high" : urgentCount >= 1 || weekCount >= 2 ? "medium" : counts.high >= 1 ? "medium" : "low";

  let headline, subtext;
  if (urgentCount >= 2) {
    headline = `즉시 대응이 필요한 품목이 ${urgentCount}건 있습니다`;
    subtext = `${uniqueUrgentNames.join("·")} 관련 긴급 조치사항을 확인하세요. 아래 액션 아이템을 바로 실행해주세요.`;
  } else if (urgentCount >= 1) {
    headline = `${uniqueUrgentNames[0] || "일부 품목"}에 즉시 대응이 필요합니다`;
    subtext = `긴급 액션 아이템 ${urgentCount}건과 주간 점검 ${weekCount}건이 있습니다. 우선순위대로 확인하세요.`;
  } else if (weekCount >= 2) {
    headline = "이번 주 안에 확인할 사항이 있습니다";
    subtext = `${weekCount}건의 주간 점검 항목이 있습니다. 여유를 두고 대응하되 놓치지 마세요.`;
  } else if (weekCount >= 1) {
    headline = "전반적으로 안정적이나 점검 사항이 있습니다";
    subtext = `대부분 안정 범위 내에 있으나, ${weekCount}건의 점검 항목을 확인해주세요.`;
  } else {
    headline = "오늘은 전반적으로 안정적입니다";
    subtext = "긴급 조치사항이 없습니다. 특별한 조치 없이 평소대로 운영하셔도 됩니다.";
  }

  const topActions = actionItems.slice(0, 3);
  const topNews = newsMatches.slice(0, 5);

  return (
    <div>
      {/* Hero — full-width centered */}
      <div style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-6xl mx-auto px-5">
          <Hero level={overallRisk} headline={headline} subtext={subtext} counts={counts} loading={comLoading} dateStr={dateStr} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-5 space-y-6">

        {/* ── Actions ── */}
        <section>
          <SectionHeader
            icon={Zap}
            title="지금 해야 할 것"
            count={actionItems.length}
            actionLabel={actionItems.length > 3 ? "전체 보기" : null}
            onAction={() => onNavigate("auditor")}
          />
          {briefLoading ? (
            <div className="flex items-center gap-3 px-6 py-5 rounded-2xl" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
              <span className="text-sm" style={{ color: "var(--text)" }}>뉴스를 분석하여 액션 아이템을 생성 중...</span>
            </div>
          ) : topActions.length === 0 ? (
            <div className="flex items-center gap-4 px-6 py-5 rounded-2xl" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", border: "1px solid #bbf7d0" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#dcfce7" }}>
                <Shield size={20} style={{ color: "#16a34a" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#15803d" }}>특별히 조치할 사항이 없습니다</p>
                <p className="text-xs mt-0.5" style={{ color: "#16a34a", opacity: 0.8 }}>평소대로 운영하셔도 괜찮습니다</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {topActions.map((a, i) => <ActionCard key={i} action={a} index={i} onNavigate={onNavigate} />)}
            </div>
          )}
        </section>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: "var(--border)" }} />

        {/* ── Two-column ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">

          {/* Commodities */}
          <section>
            <SectionHeader icon={BarChart3} title="품목별 현황" actionLabel="상세 대시보드" onAction={() => onNavigate("dashboard")} />
            <div className="space-y-2.5">
              {comLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl px-5 py-4 animate-pulse flex items-center gap-4" style={{ background: "#fff", border: "1px solid var(--border)" }}>
                    <div className="w-11 h-11 rounded-xl" style={{ background: "var(--border)" }} />
                    <div className="flex-1">
                      <div className="h-3.5 rounded mb-2" style={{ background: "var(--border)", width: "35%" }} />
                      <div className="h-2.5 rounded" style={{ background: "var(--border)", width: "65%" }} />
                    </div>
                  </div>
                ))
              ) : (
                sorted.map((item, i) => <CommodityRow key={item.id ?? item.item_code ?? i} item={item} rank={i + 1} onNavigate={onNavigate} />)
              )}
            </div>
          </section>

          {/* News */}
          <section>
            <SectionHeader
              icon={Newspaper}
              title="오늘의 뉴스"
              count={newsMatches.length}
              actionLabel={newsMatches.length > 5 ? "전체 보기" : null}
              onAction={() => onNavigate("auditor")}
            />
            <div className="space-y-2.5">
              {newsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: "#fff", border: "1px solid var(--border)" }}>
                    <div className="h-3.5 rounded mb-2.5" style={{ background: "var(--border)", width: "85%" }} />
                    <div className="h-2.5 rounded" style={{ background: "var(--border)", width: "45%" }} />
                  </div>
                ))
              ) : topNews.length === 0 ? (
                <div className="text-center py-14 rounded-2xl" style={{ background: "#fff", border: "1px solid var(--border)" }}>
                  <Newspaper size={28} className="mx-auto mb-3" style={{ color: "#e2e8f0" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>오늘은 관련 뉴스가 없습니다</p>
                </div>
              ) : (
                topNews.map((m, i) => <NewsCard key={m.article_id || i} match={m} onNavigate={onNavigate} />)
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
