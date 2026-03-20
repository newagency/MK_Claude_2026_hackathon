import requests
import pandas as pd
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

# 1. 수집 설정
ENDPOINT = "https://apis.data.go.kr/B552845/priceSequel/info"
SERVICE_KEY = "8a4532663e5ef7d1cea981673ff3a6733874e1d8cdc07dfbd0db0b0930c6d53f"

# 2. 우리가 약속한 'Standard' 필터 기준 (품목명, 품종명, 등급명, 단위크기+단위)
# 이 튜플 리스트에 있는 조합과 정확히 일치하는 데이터만 가져옵니다.
STANDARD_FILTERS = [
    ('계란', '특란30구', '일반란', '30구'),
    ('돼지', '삼겹살', '삼겹살', '100g'),
    ('사과', '후지', '상품', '10개'),
    ('쌀', '20kg', '상품', '20kg'),
    ('천일염', '천일염', '상품', '5kg'),
    ('피마늘', '난지(대서)', '상품', '10kg')
]

# 2025년 날짜 생성
start_date = datetime(2025, 1, 1)
end_date = datetime(2025, 12, 31)
date_list = [(start_date + timedelta(days=x)).strftime('%Y%m%d') for x in range((end_date - start_date).days + 1)]

def fetch_standard_data(date):
    params = {
        'serviceKey': SERVICE_KEY,
        'returnType': 'JSON',
        'pageNo': '1',
        'numOfRows': '999',
        'cond[exmn_ymd::EQ]': date
    }
    
    try:
        response = requests.get(ENDPOINT, params=params, timeout=15)
        if response.status_code != 200: return None
        
        data = response.json()
        items = data.get('response', {}).get('body', {}).get('items', {}).get('item', [])
        
        extracted = []
        for i in items:
            # 현재 행의 정보 조합 생성
            current_unit = f"{i.get('unit_sz', '')}{i.get('unit', '')}"
            current_row = (i.get('item_nm'), i.get('vrty_nm'), i.get('grd_nm'), current_unit)
            
            # 우리가 정한 표준 필터에 있는지 확인
            if current_row in STANDARD_FILTERS:
                extracted.append({
                    '날짜': i.get('exmn_ymd'),
                    '품목명': i.get('item_nm'),
                    '품종명': i.get('vrty_nm'),
                    '등급명': i.get('grd_nm'),
                    '조사일_kg_환산_가격': i.get('exmn_dd_cnvs_avg_prc')
                })
        return extracted
    except:
        return None

# 3. 병렬 실행 및 저장
all_data = []
print(f"2025년 표준 데이터 수집 시작...")

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(fetch_standard_data, d): d for d in date_list}
    for i, future in enumerate(as_completed(futures)):
        res = future.result()
        if res: all_data.extend(res)
        if (i + 1) % 50 == 0: print(f"진행: {i + 1}/{len(date_list)}일 완료")

if all_data:
    df = pd.DataFrame(all_data)
    # 날짜와 품목명으로 정렬 후 저장
    df = df.sort_values(by=['날짜', '품목명'])
    df.to_csv("2025_standard_prices.csv", index=False, encoding="utf-8-sig")
    print(f"\n--- 수집 완료! ---")
    print(f"파일 저장됨: 2025_standard_prices.csv (총 {len(df)}행)")
else:
    print("데이터를 찾지 못했습니다. 인증키나 날짜를 확인해 주세요.")