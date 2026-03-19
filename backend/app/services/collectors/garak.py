import httpx
import os
from datetime import datetime

class GarakCollector:
    def __init__(self):
        self.api_key = os.getenv("GARAK_API_KEY")
        self.base_url = "https://www.garak.co.kr/openapi/service/rest/MarketPriceService/getWholesalePrice"

    async def get_today_price(self, item_name: str):
        """
        Fetches the average auction price for a specific item (e.g., '양파', '배추').
        """
        params = {
            "serviceKey": self.api_key,
            "searchDate": datetime.now().strftime("%Y%m%d"),
            "itemName": item_name,
            "delngPrut": "10", # Example: 10kg unit
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(self.base_url, params=params)
            # Note: Garak API often returns XML by default; 
            # you may need to parse it with xmltodict or similar.
            return response.json()