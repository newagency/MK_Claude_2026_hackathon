import requests

API_KEY = "nnDwKn9in5QVgyVZBCZyc5gmBJYmoYx4EqWhlIf2ews"
url = "https://www.opinet.co.kr/api/dateAvgRecentPrice.do"
params = {
    'certkey': API_KEY,
    'out': 'json',
    'date': '20250107' # 해당 일 포함 이전 7일치 요청
}

response = requests.get(url, params=params)
data = response.json()

# 오피넷 특유의 계층 구조 확인 (RESULT -> OIL)
items = data.get('RESULT', {}).get('OIL', [])
print(f"수집된 데이터 개수: {len(items)}개")
if items:
    print(items[0]) # 첫 번째 데이터 샘플 출력