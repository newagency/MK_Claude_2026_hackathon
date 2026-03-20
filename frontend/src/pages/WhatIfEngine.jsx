import { useState, useEffect } from "react";
import { BarChart } from "@tremor/react";
import { TrendingUp, Fuel, Users, BarChart2, Loader2 } from "lucide-react";
import BrandAnalysis from "../components/BrandAnalysis";

const Panel = ({ children, className = "" }) => (
  <div className={`rounded-2xl px-4 py-3.5 ${className}`} style={{ background: "#fff", border: "1px solid var(--border)" }}>
    {children}
  </div>
);

const BASELINE = { exchange_rate_krw: 1380, oil_price_usd: 1500, min_wage_change_pct: 0 };
const ICONS = {
  exchange_rate_krw: TrendingUp,
  oil_price_usd: Fuel,
  min_wage_change_pct: Users,
};

const Slider = ({ id, label, sublabel, unit, min, max, step, value, onChange, baseline }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const changed = value !== baseline;
  const Icon = ICONS[id];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gray-500" />
          <div>
            <p className="text-xs font-bold" style={{ color: "var(--text-h)" }}>{label}</p>
            {sublabel && <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "var(--text)", opacity: 0.7 }}>{sublabel}</p>}
          </div>
        </div>
        <div className="text-right shrink-0 pl-4">
          <span
            className="text-base font-black tabular-nums"
            style={{ color: changed ? "var(--accent)" : "var(--text-h)" }}
          >
            {value.toLocaleString()}
          </span>
          <span className="text-[10px] ml-0.5" style={{ color: "var(--text)" }}>{unit}</span>
          {changed && (
            <p className="text-[10px]" style={{ color: "var(--text)", opacity: 0.6 }}>
              기준 {baseline.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-track"
        style={{ "--pct": `${pct}%` }}
      />
    </div>
  );
};

const COMMODITY_KEYS = ["Egg", "Pork", "Rice", "Apple", "Salt", "Garlic"];
const LABEL_MAP = {
  Egg: "계란",
  Pork: "돼지",
  Rice: "쌀",
  Apple: "사과",
  Salt: "천일염",
  Garlic: "피마늘",
};
const InputPanel = ({ inputs, setInputs, onSimulate, loading, baselineValues }) => (
  <Panel className="space-y-3.5">
    <Slider
      id="exchange_rate_krw"
      label="원/달러 환율"
      sublabel="USD/KRW — 식용유·밀가루에 직접 영향"
      unit="원" min={1100} max={1800} step={10}
      value={inputs.exchange_rate_krw}
      onChange={setInputs("exchange_rate_krw")}
      baseline={baselineValues.exchange_rate_krw}
    />
    <Slider
      id="oil_price_usd"
      label="경유 가격"
      sublabel="물류·난방비 등 간접 원가에 영향 (KRW/L)"
      unit="KRW/L" min={500} max={3000} step={10}
      value={inputs.oil_price_usd}
      onChange={setInputs("oil_price_usd")}
      baseline={baselineValues.oil_price_usd}
    />
    <Slider
      id="min_wage_change_pct"
      label="최저임금 변동률"
      sublabel="인건비 의존도 높은 닭고기·쌀에 영향"
      unit="%" min={-5} max={25} step={0.5}
      value={inputs.min_wage_change_pct}
      onChange={setInputs("min_wage_change_pct")}
      baseline={baselineValues.min_wage_change_pct}
    />
    <button
      onClick={onSimulate}
      disabled={loading}
      className="w-full py-2.5 rounded-2xl text-white font-bold text-xs transition-opacity"
      style={{
        background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "분석 중..." : "전체 시나리오 상세 분석"}
    </button>
  </Panel>
);

const OutputPanel = ({ result, liveResult, loadingBaseline }) => {
  if (loadingBaseline) {
    return (
      <Panel className="flex flex-col items-center justify-center gap-3 h-full">
        <Loader2 className="animate-spin text-gray-500" size={20} />
        <p className="text-sm font-semibold" style={{ color: "var(--text-h)" }}>기준 데이터를 불러오는 중...</p>
      </Panel>
    );
  }

  const displayResult = result || liveResult;
  const totalChange = parseFloat(displayResult?.total_change_pct ?? 0);
  const isUp = totalChange > 0;
  const riskColor = isUp ? "var(--risk-high)" : "var(--risk-low)";

  if (!displayResult) {
    return (
      <div className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center h-full"
           style={{ border: "1px dashed var(--border)", background: "var(--bg-subtle)" }}>
        <BarChart2 size={32} className="text-gray-400" />
        <p className="font-bold mt-2" style={{ color: "var(--text-h)" }}>라이브 프리뷰</p>
        <p className="text-sm max-w-xs" style={{ color: "var(--text)" }}>
          슬라이더를 조정하면 월간 원가 변동 총합이 즉시 표시됩니다
        </p>
      </div>
    );
  }

  const chartData = displayResult.data?.map((c) => ({
    name: c.label ?? c.item,
    "기준 원가": Math.round(c.base),
    "예상 원가": Math.round(c.predicted),
  })) ?? [];

  return (
    <div className="space-y-3 fade-up">
      <Panel>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-[10px] font-semibold mb-0.5" style={{ color: "var(--text)", opacity: 0.7 }}>총 변동</p>
            <span className="text-2xl font-black" style={{ color: riskColor }}>
              {totalChange > 0 ? "+" : ""}{totalChange}%
            </span>
          </div>
          {displayResult.total_base !== undefined && (
            <p className="text-[11px] tabular-nums" style={{ color: "var(--text)", opacity: 0.6 }}>
              {Math.round(displayResult.total_base).toLocaleString()}원 → {Math.round(displayResult.total_predicted).toLocaleString()}원
            </p>
          )}
        </div>
        {displayResult.summary && (
          <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--text)" }}>
            {displayResult.summary}
          </p>
        )}
      </Panel>

      <Panel>
        <p className="text-xs font-bold mb-0.5" style={{ color: "var(--text-h)" }}>품목별 원가 비교 (월)</p>
        <BarChart
          className="h-44 mt-2"
          data={chartData}
          index="name"
          categories={["기준 원가", "예상 원가"]}
          colors={["sky", "violet"]}
          showAnimation
          yAxisWidth={60}
          style={{ color: "var(--text-h)" }}
        />
      </Panel>
    </div>
  );
};

const fmtDate = (d) => {
  if (!(d instanceof Date)) return new Date().toISOString().slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const WhatIfEngine = ({ selectedDate }) => {
  const targetDate = fmtDate(selectedDate);
  const [inputs, setInputs] = useState(BASELINE);
  const [baselineInputs, setBaselineInputs] = useState(BASELINE);
  const [result, setResult] = useState(null);
  const [liveResult, setLiveResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    async function fetchBaseline() {
      setInitialLoading(true);
      setResult(null);
      setLiveResult(null);
      try {
        const resp = await fetch(`/api/v1/what-if/baseline?date=${targetDate}`);
        if (!resp.ok) throw new Error("기준 데이터를 불러오지 못했습니다");
        const data = await resp.json();
        const nextBaseline = {
          exchange_rate_krw: data.exchange_rate_krw,
          oil_price_usd: Math.round(data.oil_price_krw),
          min_wage_change_pct: 0,
        };
        setBaselineInputs(nextBaseline);
        setInputs(nextBaseline);
        const commodityEntries = COMMODITY_KEYS.map((key) => {
          const base = data.commodities?.[key];
          if (base == null) return null;
          return { item: key, label: LABEL_MAP[key], base: Number(base) };
        }).filter(Boolean);
        if (commodityEntries.length > 0) {
          const totalBase = commodityEntries.reduce((sum, entry) => sum + entry.base, 0);
          setLiveResult({
            summary: "기준값을 불러왔습니다.",
            data: commodityEntries.map((entry) => ({
              item: entry.item,
              label: entry.label,
              base: entry.base,
              predicted: entry.base,
              change_percent: 0,
            })),
            total_change_pct: 0,
            total_base: totalBase,
            total_predicted: totalBase,
          });
        } else {
          setLiveResult(null);
        }
      } catch (err) {
        console.error(err);
        setLiveResult(null);
      }
      setInitialLoading(false);
    }
    fetchBaseline();
  }, [targetDate]);

  const set = (key) => (val) => setInputs((prev) => ({ ...prev, [key]: val }));

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const payload = {
        target_date: targetDate,
        exchange_rate_krw: inputs.exchange_rate_krw,
        oil_price_usd: inputs.oil_price_usd,
        min_wage_change_pct: inputs.min_wage_change_pct,
      };

      const res = await fetch("/api/v1/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("서버 오류");
      const data = await res.json();
      setResult(data);
      setLiveResult(data); // Sync live preview with full result
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div className="max-w-6xl mx-auto px-5 relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
            거시경제 민감도 분석
          </p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
            가격 충격 시뮬레이터
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputPanel
            inputs={inputs}
            setInputs={set}
            onSimulate={handleSimulate}
            loading={loading || initialLoading}
            baselineValues={baselineInputs}
          />
          <OutputPanel result={result} liveResult={liveResult} loadingBaseline={initialLoading} />
        </div>
        <BrandAnalysis />
      </div>
    </div>
  );
};

export default WhatIfEngine;
