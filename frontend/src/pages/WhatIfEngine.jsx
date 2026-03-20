import { useState, useEffect, useMemo } from "react";
import { BarChart, Card, Title } from "@tremor/react";
import { TrendingUp, Fuel, Users, BarChart2 } from "lucide-react";
import BrandAnalysis from "../components/BrandAnalysis";

const BASELINE = { exchange_rate_krw: 1380, oil_price_usd: 1500, min_wage_change_pct: 0 };
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
const DEMO_ITEMS = [
  { key: "Egg", label: "계란", base: 1400, weights: { fx: 0.45, oil: 0.12, wage: 0.15 } },
  { key: "Pork", label: "돼지", base: 2500, weights: { fx: 0.65, oil: 0.1, wage: 0.25 } },
  { key: "Rice", label: "쌀", base: 1200, weights: { fx: 0.1, oil: 0.15, wage: 0.2 } },
  { key: "Apple", label: "사과", base: 3000, weights: { fx: 0.2, oil: 0.6, wage: 0.4 } },
  { key: "Salt", label: "천일염", base: 2300, weights: { fx: 0.05, oil: 0.35, wage: 0.6 } },
  { key: "Garlic", label: "피마늘", base: 4500, weights: { fx: 0.4, oil: 0.25, wage: 0.55 } },
];

const runFakeSim = (inputs, baseline = BASELINE) => {
  const ex_rate_eff = (inputs.exchange_rate_krw - baseline.exchange_rate_krw) / baseline.exchange_rate_krw;
  const oil_eff = (inputs.oil_price_usd - baseline.oil_price_usd) / baseline.oil_price_usd;
  const wage_eff = (inputs.min_wage_change_pct - baseline.min_wage_change_pct) / 100;

  const items = DEMO_ITEMS.map((item) => {
    const change =
      item.weights.fx * ex_rate_eff + item.weights.oil * oil_eff + item.weights.wage * wage_eff;
    return {
      item: item.key,
      label: item.label,
      base: item.base,
      predicted: item.base * (1 + change),
      change_percent: change * 100,
    };
  });

  const total_base = items.reduce((sum, c) => sum + c.base, 0);
  const total_predicted = items.reduce((sum, c) => sum + c.predicted, 0);
  const total_change_pct = ((total_predicted - total_base) / total_base) * 100;

  return {
    summary: "샘플 데이터 기반 즉석 미리보기입니다.",
    data: items,
    total_change_pct,
    total_base,
    total_predicted,
  };
};

const InputPanel = ({ inputs, setInputs, onSimulate, loading, baselineValues }) => (
  <Card className="p-5 space-y-5">
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

  const chartData = displayResult.data?.map((c) => ({
    name: c.label ?? c.item,
    "기준 원가": Math.round(c.base),
    "예상 원가": Math.round(c.predicted),
  })) ?? [];

  return (
    <div className="space-y-5 fade-up">
      <Card className="p-5">
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>총 변동</p>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-black" style={{ color: riskColor }}>
            {totalChange > 0 ? "+" : ""}{totalChange}%
          </span>
        </div>
        {displayResult.summary && (
          <p className="text-xs mt-2" style={{ color: "var(--text)" }}>
            {displayResult.summary}
          </p>
        )}
        {displayResult.total_base !== undefined && (
          <p className="text-xs mt-1" style={{ color: "var(--text)" }}>
            기준 {Math.round(displayResult.total_base).toLocaleString()}원 →{" "}
            {Math.round(displayResult.total_predicted).toLocaleString()}원
          </p>
        )}
      </Card>

      <Card className="p-5">
        <Title style={{ color: "var(--text-h)" }}>품목별 원가 비교 (월)</Title>
        <BarChart
          className="h-56 mt-4"
          data={chartData}
          index="name"
          categories={["기준 원가", "예상 원가"]}
          colors={["sky", "violet"]}
          showAnimation
          yAxisWidth={60}
          style={{ color: "var(--text-h)" }}
        />
      </Card>
    </div>
  );
};

const LABEL_MAP = DEMO_ITEMS.reduce((acc, item) => ({ ...acc, [item.key]: item.label }), {});

const WhatIfEngine = () => {
  const [inputs, setInputs] = useState(BASELINE);
  const [baselineInputs, setBaselineInputs] = useState(BASELINE);
  const [result, setResult] = useState(null);
  const [liveResult, setLiveResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const debouncedInputs = useDebounce(inputs, 200);

  useEffect(() => {
    setLiveResult(runFakeSim(debouncedInputs, baselineInputs));
  }, [debouncedInputs, baselineInputs]);

  useEffect(() => {
    async function fetchBaseline() {
      setInitialLoading(true);
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
        const commodityEntries = Object.entries(data.commodities || {});
        const totalBase = commodityEntries.reduce((sum, [, value]) => sum + value, 0);
        setLiveResult({
          summary: "기준값을 불러왔습니다.",
          data: commodityEntries.map(([item, base]) => ({
            item,
            label: LABEL_MAP[item] ?? item,
            base,
            predicted: base,
            change_percent: 0,
          })),
          total_change_pct: 0,
          total_base: totalBase,
          total_predicted: totalBase,
        });
      } catch (err) {
        console.error(err);
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
        <div className="max-w-5xl mx-auto relative z-10">
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--accent)" }}>
            거시경제 민감도 분석
          </p>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--text-h)" }}>
            가격 충격 시뮬레이터
          </h1>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-2">
            <p className="text-sm" style={{ color: "var(--text)" }}>
              거시 변수를 조정하면 월간 식재료비 변동을 즉시 예측합니다
            </p>
            <label className="text-xs font-semibold flex items-center gap-2" style={{ color: "var(--text)" }}>
              기준 날짜
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="border rounded-lg px-3 py-1 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-h)" }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-7">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <InputPanel
            inputs={inputs}
            setInputs={set}
            onSimulate={handleSimulate}
            loading={loading || initialLoading}
            baselineValues={baselineInputs}
          />
          <OutputPanel result={result} liveResult={liveResult} />
        </div>
        <BrandAnalysis />
      </div>
    </div>
  );
};

export default WhatIfEngine;
