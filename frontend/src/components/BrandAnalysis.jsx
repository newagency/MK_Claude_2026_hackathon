import { useState, useMemo } from "react";
import { LineChart } from "@tremor/react";

const COMMODITIES = [
  { value: "egg", label: "계란" },
  { value: "oil", label: "식용유" },
  { value: "milk", label: "우유" },
  { value: "rice", label: "쌀" },
];

const MOCK_DATA = {
  egg: {
    brands: ["하림 무항생제", "풀무원 목초란", "계란유통 일반란"],
    fairPrice: [6200, 6300, 6400, 6350, 6500, 6450, 6550, 6600, 6500, 6480, 6520, 6550],
    series: {
      "하림 무항생제": [6800, 6900, 7000, 6950, 7100, 7050, 7200, 7250, 7100, 7050, 7080, 7150],
      "풀무원 목초란": [7200, 7350, 7400, 7300, 7500, 7450, 7600, 7650, 7500, 7480, 7520, 7580],
      "계란유통 일반란": [5800, 5900, 5950, 5900, 6050, 6000, 6100, 6150, 6050, 6020, 6060, 6100],
    },
  },
  oil: {
    brands: ["CJ 백설", "오뚜기 식용유", "해표 식용유"],
    fairPrice: [4500, 4520, 4480, 4550, 4600, 4580, 4650, 4700, 4680, 4720, 4750, 4700],
    series: {
      "CJ 백설": [4800, 4850, 4820, 4900, 4950, 4930, 5000, 5050, 5020, 5080, 5100, 5050],
      "오뚜기 식용유": [4650, 4700, 4680, 4750, 4800, 4780, 4850, 4900, 4880, 4920, 4950, 4900],
      "해표 식용유": [4550, 4580, 4560, 4620, 4660, 4640, 4700, 4740, 4720, 4760, 4790, 4750],
    },
  },
  milk: {
    brands: ["서울우유", "매일우유", "남양유업"],
    fairPrice: [2800, 2820, 2850, 2830, 2860, 2880, 2900, 2920, 2910, 2930, 2950, 2940],
    series: {
      "서울우유": [2980, 3000, 3020, 3010, 3050, 3080, 3100, 3120, 3110, 3130, 3150, 3140],
      "매일우유": [2900, 2920, 2950, 2930, 2960, 2980, 3000, 3020, 3010, 3030, 3050, 3040],
      "남양유업": [2850, 2870, 2900, 2880, 2910, 2930, 2950, 2970, 2960, 2980, 3000, 2990],
    },
  },
  rice: {
    brands: ["CJ 햇반", "오뚜기 즉석밥", "농협 쌀"],
    fairPrice: [3100, 3120, 3150, 3180, 3200, 3220, 3250, 3280, 3300, 3280, 3260, 3240],
    series: {
      "CJ 햇반": [3400, 3420, 3450, 3480, 3500, 3520, 3550, 3580, 3600, 3580, 3560, 3540],
      "오뚜기 즉석밥": [3300, 3320, 3350, 3380, 3400, 3420, 3450, 3480, 3500, 3480, 3460, 3440],
      "농협 쌀": [2900, 2920, 2950, 2980, 3000, 3020, 3050, 3080, 3100, 3080, 3060, 3040],
    },
  },
};

const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const BrandAnalysis = () => {
  const [selected, setSelected] = useState("egg");

  const { chartData, brands } = useMemo(() => {
    const d = MOCK_DATA[selected];
    if (!d) return { chartData: [], brands: [] };

    const data = MONTHS.map((month, i) => {
      const row = { date: month, "적정가": d.fairPrice[i] };
      for (const [brand, values] of Object.entries(d.series)) {
        row[brand] = values[i];
      }
      return row;
    });

    return { chartData: data, brands: d.brands };
  }, [selected]);

  const valueFormatter = (n) => `${n.toLocaleString()}원`;

  return (
    <div className="rounded-2xl px-4 py-3.5 mt-4" style={{ background: "#fff", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold" style={{ color: "var(--text-h)" }}>브랜드별 가격 비교</p>
        <div className="flex gap-1.5">
          {COMMODITIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setSelected(c.value)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: selected === c.value ? "var(--accent)" : "var(--bg-subtle)",
                color: selected === c.value ? "#fff" : "var(--text)",
                border: `1px solid ${selected === c.value ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <LineChart
        key={selected}
        className="h-48"
        data={chartData}
        index="date"
        categories={[...brands, "적정가"]}
        colors={["indigo", "cyan", "amber", "emerald"]}
        valueFormatter={valueFormatter}
        connectNulls
        yAxisWidth={75}
        showAnimation
        curveType="monotone"
        customTooltip={({ payload, active, label }) => {
          if (!active || !payload) return null;
          return (
            <div className="rounded-xl bg-white p-3 text-xs shadow-lg" style={{ border: "1px solid var(--border)" }}>
              <p className="font-bold mb-1.5" style={{ color: "var(--text-h)" }}>{label}</p>
              {payload.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-6 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span style={{ color: "var(--text)" }}>{p.dataKey}</span>
                  </div>
                  <span className="font-bold tabular-nums" style={{ color: "var(--text-h)" }}>{p.value?.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          );
        }}
      />

    </div>
  );
};

export default BrandAnalysis;
