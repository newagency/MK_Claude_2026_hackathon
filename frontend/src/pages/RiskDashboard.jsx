import { useState, useEffect } from "react";
import { AreaChart } from "@tremor/react";
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
} from "lucide-react";

const RISK = {
  high:   { label: "고위험", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  medium: { label: "주의",   color: "var(--risk-med)",  bg: "var(--risk-med-bg)" },
  low:    { label: "안정",   color: "var(--risk-low)",  bg: "var(--risk-low-bg)" },
};

const COMMODITY_ICONS = {
  "식용유": Droplets,
  "닭고기": Beef,
  "쌀": Wheat,
  "대파": Sprout,
  "밀가루": Package,
  "고구마": Apple,
};

const RISK_ICONS = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: CheckCircle2,
};

const StatBadge = ({ level, label }) => {
  const risk = RISK[level];
  const Icon = RISK_ICONS[level];
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

const CommodityCard = ({ item }) => {
  const risk = RISK[item.greedflation_risk] ?? RISK.low;
  const isUp = item.price_delta_pct > 0;
  const Icon = COMMODITY_ICONS[item.item_name] ?? Package;

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        borderLeft: `4px solid ${risk.color}`,
      }}
    >
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row: icon + name + badge */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: risk.bg }}
            >
              <Icon size={20} strokeWidth={2} style={{ color: risk.color }} />
            </div>
            <div>
              <p className="font-bold leading-tight" style={{ color: "var(--text-h)" }}>
                {item.item_name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text)", opacity: 0.7 }}>
                {item.unit}
              </p>
            </div>
          </div>
          <StatBadge level={item.greedflation_risk} label={risk.label} />
        </div>

        {/* Hero price */}
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text)", opacity: 0.6 }}>
            현재 경락가
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
              {item.current_price.toLocaleString()}
            </span>
            <span className="text-sm" style={{ color: "var(--text)" }}>원</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="flex items-center text-sm font-bold" style={{ color: risk.color }}>
              {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span className="ml-0.5">{Math.abs(item.price_delta_pct)}%</span>
            </span>
            <span className="text-xs" style={{ color: "var(--text)", opacity: 0.65 }}>
              3년 평균 {item.avg_3year.toLocaleString()}원 대비
            </span>
          </div>
        </div>

        {/* Sparkline */}
        {item.trend.length > 1 && (
          <div className="-mx-5 -mb-5 mt-auto">
            <AreaChart
              className="h-20"
              data={item.trend}
              index="date"
              categories={["price"]}
              colors={[item.greedflation_risk === "low" ? "emerald" : item.greedflation_risk === "medium" ? "amber" : "red"]}
              showLegend={false}
              showXAxis={false}
              showYAxis={false}
              showGridLines={false}
              showAnimation
            />
          </div>
        )}

        {/* Alerts */}
        {item.rocket_feather?.is_feather && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "var(--risk-high-bg)", color: "var(--risk-high)" }}
          >
            <AlertTriangle size={14} />
            <span>하락 대비 {item.rocket_feather.asymmetry_ratio}배 속도로 상승</span>
          </div>
        )}

        {item.note && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text)", opacity: 0.65 }}>
            {item.note}
          </p>
        )}
      </div>
    </div>
  );
};

const IMPACT_STYLE = {
  up:       { label: "상승 압력", color: "var(--risk-high)", bg: "var(--risk-high-bg)" },
  down:     { label: "하락 요인", color: "var(--risk-low)",  bg: "var(--risk-low-bg)" },
  unstable: { label: "불안정",    color: "var(--risk-med)",   bg: "var(--risk-med-bg)" },
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
            style={{ background: "var(--accent-bg)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
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

  const dateStr = selectedDate.toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true);
    setNewsData(null);
    fetch(`/api/v1/news/daily?date=${dateStr}`)
      .then((r) => { if (!r.ok) throw new Error("뉴스 로딩 실패"); return r.json(); })
      .then(setNewsData)
      .catch(() => setNewsData({ matches: [], total_articles: 0, filtered_count: 0 }))
      .finally(() => setLoading(false));
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
            <span className="text-sm" style={{ color: "var(--text)" }}>AI 분석 중...</span>
          </div>
        )}
        {!loading && newsData?.matches.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: "var(--text)", opacity: 0.5 }}>
            이 날짜에 품목 가격에 영향을 주는 뉴스가 없습니다
          </p>
        )}
        {!loading && newsData?.matches.map((m) => (
          <NewsMatchCard key={m.article_id} match={m} />
        ))}
      </div>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="rounded-2xl h-52 animate-pulse" style={{ background: "var(--bg-subtle)" }} />
);

const RiskDashboard = ({ selectedDate }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/v1/commodities")
      .then((r) => { if (!r.ok) throw new Error("서버 오류"); return r.json(); })
      .then(d => {
        const sorted = [...d].sort((a, b) => {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.greedflation_risk] - order[b.greedflation_risk];
        });
        setData(sorted);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    high:   data.filter((d) => d.greedflation_risk === "high").length,
    medium: data.filter((d) => d.greedflation_risk === "medium").length,
    low:    data.filter((d) => d.greedflation_risk === "low").length,
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
      {/* Page header */}
      <div className="page-header">
        <div className="max-w-5xl mx-auto relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
            가락시장 경락가 기준 · 3년 평균 대비 편차
          </p>
          <h1 className="text-3xl font-black tracking-tight mb-4" style={{ color: "var(--text-h)" }}>
            오늘의 식재료 위험 지수
          </h1>

          {/* Summary chips */}
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

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-5 py-7 space-y-7">
        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            data.map((item) => (
              <CommodityCard key={item.item_code} item={item} />
            ))
          )}
        </div>

        {/* News matches */}
        <NewsPanel selectedDate={selectedDate} />
      </div>
    </div>
  );
};

export default RiskDashboard;
