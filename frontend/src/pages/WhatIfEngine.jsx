import { useState, useEffect, useMemo } from "react";
import { BarChart, Card, Title } from "@tremor/react";
import { TrendingUp, Fuel, Users, BarChart2 } from "lucide-react";

const BASELINE = { exchange_rate_krw: 1380, oil_price_usd: 75, min_wage_change_pct: 0 };
const ICONS = {
  exchange_rate_krw: TrendingUp,
  oil_price_usd: Fuel,
  min_wage_change_pct: Users,
};

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const Slider = ({ id, label, sublabel, unit, min, max, step, value, onChange, baseline }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const changed = value !== baseline;
  const Icon = ICONS[id];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-500" />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-h)" }}>{label}</p>
            {sublabel && <p className="text-xs mt-0.5" style={{ color: "var(--text)" }}>{sublabel}</p>}
          </div>
        </div>
        <div className="text-right shrink-0 pl-4">
          <span
            className="text-lg font-black"
            style={{ color: changed ? "var(--accent)" : "var(--text-h)" }}
          >
            {value.toLocaleString()}
          </span>
          <span className="text-xs ml-1" style={{ color: "var(--text)" }}>{unit}</span>
          {changed && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text)" }}>
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

// Simplified local calculation for live preview
const runFakeSim = (inputs) => {
  const ex_rate_eff = (inputs.exchange_rate_krw - BASELINE.exchange_rate_krw) / BASELINE.exchange_rate_krw;
  const oil_eff = (inputs.oil_price_usd - BASELINE.oil_price_usd) / BASELINE.oil_price_usd;
  const wage_eff = (inputs.min_wage_change_pct - BASELINE.min_wage_change_pct) / 100;

  const total_change_pct = (ex_rate_eff * 15 + oil_eff * 10 + wage_eff * 8).toFixed(1);
  return {
    total_change_pct,
    commodities: [
      { name: "식용유", base_monthly_cost: 100, projected_monthly_cost: 100 * (1 + ex_rate_eff * 0.8) },
      { name: "닭고기", base_monthly_cost: 150, projected_monthly_cost: 150 * (1 + wage_eff * 0.5) },
      { name: "쌀", base_monthly_cost: 80, projected_monthly_cost: 80 * (1 + wage_eff * 0.3) },
      { name: "대파", base_monthly_cost: 50, projected_monthly_cost: 50 * (1 + oil_eff * 0.2) },
      { name: "밀가루", base_monthly_cost: 120, projected_monthly_cost: 120 * (1 + ex_rate_eff * 0.7) },
      { name: "고구마", base_monthly_cost: 70, projected_monthly_cost: 70 },
    ],
  };
};

const InputPanel = ({ inputs, setInputs, onSimulate, loading }) => (
  <Card className="p-5 space-y-5">
    <Slider
      id="exchange_rate_krw"
      label="원/달러 환율"
      sublabel="USD/KRW — 식용유·밀가루에 직접 영향"
      unit="원" min={1100} max={1800} step={10}
      value={inputs.exchange_rate_krw}
      onChange={setInputs("exchange_rate_krw")}
      baseline={BASELINE.exchange_rate_krw}
    />
    <Slider
      id="oil_price_usd"
      label="브렌트유 가격"
      sublabel="물류비·포장비 등 간접 원가에 영향"
      unit="USD/배럴" min={40} max={160} step={1}
      value={inputs.oil_price_usd}
      onChange={setInputs("oil_price_usd")}
      baseline={BASELINE.oil_price_usd}
    />
    <Slider
      id="min_wage_change_pct"
      label="최저임금 변동률"
      sublabel="인건비 의존도 높은 닭고기·쌀에 영향"
      unit="%" min={-5} max={25} step={0.5}
      value={inputs.min_wage_change_pct}
      onChange={setInputs("min_wage_change_pct")}
      baseline={BASELINE.min_wage_change_pct}
    />
    <button
      onClick={onSimulate}
      disabled={loading}
      className="w-full py-3 rounded-xl text-white font-bold text-sm transition-opacity"
      style={{
        background: "linear-gradient(135deg, var(--accent-soft), var(--accent))",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "분석 중..." : "전체 시나리오 상세 분석"}
    </button>
  </Card>
);

const OutputPanel = ({ result, liveResult }) => {
  const displayResult = result || liveResult;
  const totalChange = parseFloat(displayResult?.total_change_pct ?? 0);
  const isUp = totalChange > 0;
  const riskColor = isUp ? "var(--risk-high)" : "var(--risk-low)";

  if (!displayResult) {
    return (
      <div className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center h-full"
           style={{ border: "1px dashed var(--border)", background: "var(--bg-subtle)" }}>
        <BarChart2 size={32} className="text-gray-400" />
        <p className="font-bold mt-2" style={{ color: "var(--text-h)" }}>라이브 프리뷰</p>
        <p className="text-sm max-w-xs" style={{ color: "var(--text)" }}>
          슬라이더를 조정하면 월간 원가 변동 총합이 즉시 표시됩니다
        </p>
      </div>
    );
  }

  const chartData = displayResult.commodities.map((c) => ({
    name: c.name,
    "기준 원가": c.base_monthly_cost,
    "예상 원가": c.projected_monthly_cost,
  }));

  return (
    <div className="space-y-5 fade-up">
      <Card className="p-5">
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>총 변동</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black" style={{ color: riskColor }}>
            {totalChange > 0 ? "+" : ""}{totalChange}%
          </span>
        </div>
        {result && (
          <p className="text-xs mt-1" style={{ color: "var(--text)" }}>
            기준 {result.total_base_monthly.toLocaleString()}원 →{" "}
            {result.total_projected_monthly.toLocaleString()}원
          </p>
        )}
      </Card>

      <Card className="p-5">
        <Title>품목별 원가 비교 (월)</Title>
        <BarChart
          className="h-56 mt-4"
          data={chartData}
          index="name"
          categories={["기준 원가", "예상 원가"]}
          colors={["slate", "indigo"]}
          showAnimation
        />
      </Card>
    </div>
  );
};

const WhatIfEngine = () => {
  const [inputs, setInputs] = useState(BASELINE);
  const [result, setResult] = useState(null); // Full API result
  const [liveResult, setLiveResult] = useState(null); // Local preview result
  const [loading, setLoading] = useState(false);
  const debouncedInputs = useDebounce(inputs, 200);

  useEffect(() => {
    setLiveResult(runFakeSim(debouncedInputs));
  }, [debouncedInputs]);

  const set = (key) => (val) => setInputs((prev) => ({ ...prev, [key]: val }));

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
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
        <div className="max-w-5xl mx-auto relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
            거시경제 민감도 분석
          </p>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
            가격 충격 시뮬레이터
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text)" }}>
            거시 변수를 조정하면 월간 식재료비 변동을 즉시 예측합니다
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-7 grid grid-cols-1 md:grid-cols-2 gap-8">
        <InputPanel inputs={inputs} setInputs={set} onSimulate={handleSimulate} loading={loading} />
        <OutputPanel result={result} liveResult={liveResult} />
      </div>
    </div>
  );
};

export default WhatIfEngine;
