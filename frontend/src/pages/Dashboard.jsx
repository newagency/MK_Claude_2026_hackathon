import { useState } from 'react';
import { Card, Title, AreaChart, BadgeDelta, Flex, TextInput, Button, List, ListItem } from '@tremor/react';

const Dashboard = () => {
  const [news, setNews] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ news_content: news, item_code: "211" })
      });
      const data = await response.json();
      setReport(data);
    } catch (error) {
      console.error("분석 실패:", error);
    }
    setLoading(false);
  };

  return (
    <div className="p-10 bg-gray-50 min-h-screen">
      <Title className="mb-5">sosang: 소상공인 경제 지침서</Title>
      
      {/* 뉴스 입력창 */}
      <Card className="mb-8">
        <div className="flex gap-4">
          <TextInput 
            placeholder="매경 뉴스 내용을 붙여넣으세요..." 
            value={news}
            onChange={(e) => setNews(e.target.value)}
          />
          <Button loading={loading} onClick={handleAnalyze}>분석 시작</Button>
        </div>
      </Card>

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 차트: 5개년 가격 비교 */}
          <Card>
            <Title>{report.summary.commodity} 가격 추이 (현재 vs 과거 5년)</Title>
            <AreaChart
              className="h-72 mt-4"
              data={report.market_trends.map(d => ({
                date: d.search_date,
                "현재가": d.avg_price_current,
                "3년전": d.avg_price_y3,
              }))}
              index="date"
              categories={["현재가", "3년전"]}
              colors={["indigo", "cyan"]}
            />
          </Card>

          {/* AI 분석 결과: Greedflation 감지 */}
          <Card>
            <Flex alignItems="start">
              <Title>위험 분석 보고서</Title>
              <BadgeDelta deltaType="moderateIncrease">
                위험도: {report.summary.impact_severity}/10
              </BadgeDelta>
            </Flex>
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-bold text-indigo-600 mb-2">💡 AI 요약: {report.insight}</p>
              <Title className="mt-4 text-sm">협상 가이드 (Counter-Arguments)</Title>
              <List className="mt-2">
                {report.summary.counter_arguments.map((arg, i) => (
                  <ListItem key={i}>{arg}</ListItem>
                ))}
              </List>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Dashboard;