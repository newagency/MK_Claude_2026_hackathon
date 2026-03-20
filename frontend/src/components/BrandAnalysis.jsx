import { useState, useEffect } from "react";
import { LineChart, Select, SelectItem } from "@tremor/react";
import { ChevronDown } from "lucide-react";

const COMMODITIES = [
  { value: "milk", label: "우유" },
  { value: "oil", label: "식용유" },
  // Add other commodities as needed
];

const BrandAnalysis = () => {
  const [selectedCommodity, setSelectedCommodity] = useState("milk");
  const [chartData, setChartData] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/commodities/${selectedCommodity}/brands`)
      .then((res) => res.json())
      .then((data) => {
        const transformedData = data.time_series.map(item => {
            const chartItem = { date: item.date, "적정가": item.fair_price };
            Object.keys(item.brands).forEach(brand => {
                chartItem[brand] = Number(item.brands[brand]);
            });
            return chartItem;
        });
        setChartData(transformedData);

        const allBrandKeys = transformedData.reduce((acc, item) => {
            Object.keys(item).forEach(key => {
                if (key !== 'date' && key !== '적정가' && !acc.includes(key)) {
                    acc.push(key);
                }
            });
            return acc;
        }, []);
        setBrands(allBrandKeys);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch brand data:", error);
        setLoading(false);
      });
  }, [selectedCommodity]);

  const valueFormatter = (number) => `${number.toLocaleString()}원`;

  console.log("Current Chart Data:", chartData);
  console.log("Current Brands:", brands);

  return (
    <div className="rounded-2xl p-5 mt-8" style={{ background: "#fff", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold" style={{ color: "var(--text-h)" }}>브랜드별 가격 비교</p>
        <div className="w-48">
            <Select value={selectedCommodity} onValueChange={setSelectedCommodity} icon={ChevronDown}>
                {COMMODITIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </Select>
        </div>
            </div>
            {loading ? (
              <div className="h-72 flex flex-col items-center justify-center">
                  <p className="text-tremor-content-strong font-medium">분석 중...</p>
                  <p className="text-tremor-content">데이터를 불러오고 있습니다.</p>
              </div>
            ) : chartData.length > 0 ? (
              <LineChart
                key={selectedCommodity}
                className="h-72"
                data={chartData}
                index="date"
                categories={[...brands, "적정가"]}
                colors={["indigo", "cyan", "amber", "rose", "emerald", "teal", "violet", "lime", "pink"].slice(0, brands.length)}
                valueFormatter={valueFormatter}
                connectNulls={true}
                yAxisWidth={60}
                customTooltip={(props) => {
                    const { payload, active, label } = props;
                    if (!active || !payload) return null;
                    return (
                      <div className="w-56 rounded-tremor-default border border-tremor-border bg-white p-2 text-tremor-default shadow-tremor-dropdown dark:bg-gray-950 dark:border-gray-800">
                        <p className="font-medium text-tremor-content-strong dark:text-gray-50">{label}</p>
                        {payload.map((p, i) => (
                          <div key={i} className="flex items-center justify-between space-x-6">
                            <div className="flex items-center space-x-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="text-tremor-content">{p.dataKey}</span>
                            </div>
                            <span className="font-medium text-tremor-content-strong dark:text-gray-50">{p.value}원</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
              />
            ) : (
              <div className="h-72 flex flex-col items-center justify-center">
                  <p className="text-tremor-content-strong font-medium">데이터 없음</p>
                  <p className="text-tremor-content">선택하신 품목에 대한 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        );
      };

export default BrandAnalysis;
