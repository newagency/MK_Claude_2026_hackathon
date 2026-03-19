import { useState } from "react";
import { AreaChart } from "@tremor/react";
import { AlertTriangle, TrendingUp, ShieldCheck, Sparkles, MessageSquareQuote, ChevronDown } from "lucide-react";

// Emojis removed as per spec for a cleaner dropdown
const COMMODITIES = [
  { code: "431", name: "식용유" },
  { code: "312", name: "닭고기" },
  { code: "111", name: "쌀" },
  { code: "215", name: "대파" },
  { code: "115", name: "밀가루" },
  { code: "211", name: "고구마" },
];

const ScoreRing = ({ score }) => {
  const pct = (score / 10) * 100;
  const color = score >= 7 ? "var(--risk-high)" : score >= 4 ? "var(--risk-med)" : "var(--risk-low)";
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs" style={{ color: "var(--text)" }}>/10</span>
        </div>
      </div>
      <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text)" }}>
        Greedflation Score
      </p>
    </div>
  );
};

const CausalChain = ({ chain }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-6">
    {chain.map((step, i) => (
      <div key={i} className="relative md:flex flex-col">
        {/* Connecting line for desktop */}
        {i < chain.length - 1 && (
          <div className="hidden md:block absolute top-4 -right-2 w-full h-0.5 bg-gray-200" style={{borderColor: 'var(--border)'}}/>
        )}
        {/* Connecting line for mobile */}
        {i < chain.length - 1 && (
           <div className="md:hidden absolute top-10 left-4 h-full w-0.5 bg-gray-200" style={{borderColor: 'var(--border)'}}/>
        )}
        
        <div className="flex md:flex-col items-start gap-4">
          <div
            className="relative z-10 flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black text-white"
            style={{ background: "var(--accent)" }}
          >
            {step.step}
          </div>
          <div className="mt-1 md:mt-3">
             <p className="text-sm font-bold mb-1" style={{ color: "var(--text-h)" }}>
              {step.label}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
              {step.description}
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
);


const LinkAuditor = () => {
  const [news, setNews] = useState("");
  const [itemCode, setItemCode] = useState("431");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!news.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/v1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news_content: news, item_code: itemCode }),
      });
      if (!response.ok) throw new Error("백엔드 오류 — 서버 로그를 확인하세요");
      setReport(await response.json());
    } catch (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div className="max-w-5xl mx-auto relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
            AI 뉴스 인과관계 분석
          </p>
          <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color: "var(--text-h)" }}>
            뉴스 감사
          </h1>
          <p className="text-sm" style={{ color: "var(--text)" }}>
            매경 뉴스를 붙여넣으면 AI가 가격 인상의 정당성을 분석합니다
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-7 space-y-5">
        {/* Input area */}
        <div
          className="rounded-2xl p-1"
          style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
        >
          <div className="p-5" style={{ background: "var(--bg-card)" }}>
            <textarea
              rows={4}
              className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
              style={{ color: "var(--text-h)" }}
              placeholder="뉴스 내용을 붙여넣으세요 (제목 또는 본문 일부)..."
              value={news}
              onChange={(e) => setNews(e.target.value)}
            />
          </div>
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}
          >
            <div className="relative">
              <select
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                className="appearance-none text-xs font-semibold rounded-lg pl-3 pr-8 py-1.5 outline-none"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  color: "var(--text-h)",
                }}
              >
                {COMMODITIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading || !news.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-white text-sm font-bold transition-opacity"
              style={{
                background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
                opacity: (loading || !news.trim()) ? 0.6 : 1,
              }}
            >
              <Sparkles size={14} />
              {loading ? "분석 중..." : "AI 분석 실행"}
            </button>
          </div>
        </div>

        {/* Results */}
        {report && (
          <div className="space-y-5 fade-up">
            {/* Chart + Score row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Price chart */}
              <div
                className="md:col-span-2 rounded-2xl p-5"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <p className="text-sm font-bold mb-4" style={{ color: "var(--text-h)" }}>
                  {report.summary.commodity} 가격 변동 추이
                </p>
                <AreaChart
                  className="h-56"
                  data={report.market_trends.map((d) => ({
                    date: d.search_date.slice(4),
                    "현재가": d.avg_price_current,
                    "3년 평균": Math.round((d.avg_price_y1 + d.avg_price_y2 + d.avg_price_y3) / 3),
                  }))}
                  index="date"
                  categories={["현재가", "3년 평균"]}
                  colors={["indigo", "slate"]}
                  showAnimation
                />
              </div>

              {/* Score card */}
              <div
                className="rounded-2xl p-5 flex flex-col items-center justify-center gap-5"
                style={{
                  background: "var(--accent-bg)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                <ScoreRing score={report.summary.greedflation_score} />
              </div>
            </div>

            {/* Causal chain */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} style={{ color: "var(--accent)" }} />
                <p className="text-sm font-bold" style={{ color: "var(--text-h)" }}>인과관계 추론 체인</p>
              </div>
              <CausalChain chain={report.summary.causal_chain} />
            </div>

            {/* Fair price rationale */}
            <blockquote
              className="border-l-4 pl-4 py-1"
              style={{ borderColor: "var(--accent)", color: "var(--text)" }}
            >
              {report.summary.fair_price_rationale}
            </blockquote>

            {/* Negotiation guide */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
                border: "1px solid rgba(167,139,250,0.2)",
              }}
            >
              <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} style={{ color: "#c4b5fd" }} />
                  <p className="text-sm font-bold" style={{ color: "#f5f3ff" }}>소상공인 협상 가이드</p>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "rgba(196,181,253,0.6)" }}>
                  유통업자의 부당 인상에 이렇게 대응하세요
                </p>
              </div>
              <div className="p-5 space-y-2">
                {report.summary.counter_arguments.map((arg, i) => (
                  <div
                    key={i}
                    className="flex gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <MessageSquareQuote size={14} className="shrink-0 mt-0.5" style={{ color: "#a78bfa" }} />
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(245,243,255,0.8)" }}>
                      "{arg}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkAuditor;
