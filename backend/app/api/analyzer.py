from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm.architect import EconomicArchitect
from app.services.collectors.mock_loader import MockGarakLoader

router = APIRouter()
architect = EconomicArchitect()
mock_loader = MockGarakLoader()

class AnalysisRequest(BaseModel):
    news_content: str
    item_code: str = "211"  # 해커톤 시연용 디폴트 (고구마)

@router.post("/analyze")
async def analyze_impact(request: AnalysisRequest):
    print(f"DEBUG: Received request for {request.item_code}") # 터미널 확인용
    try:
        # LLM 분석 실행 (동기 함수면 await 빼고 호출)
        ai_analysis = architect.analyze_news(request.news_content)
        
        # 더미 데이터 로드
        market_data = mock_loader.get_price_trend(request.item_code)
        
        return {
            "summary": ai_analysis,
            "market_trends": market_data
        }
    except Exception as e:
        print(f"ERROR OCCURRED: {str(e)}") # 여기서 실제 에러 원인이 찍힙니다
        raise HTTPException(status_code=500, detail=str(e))