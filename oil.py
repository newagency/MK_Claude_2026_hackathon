import requests
import pandas as pd
from datetime import datetime, timedelta
import time

def fetch_opinet_2025(api_key):
    url = "https://www.opinet.co.kr/api/dateAvgRecentPrice.do"
    
    # 2025년 데이터를 다 커버하기 위해 7일 간격으로 날짜 생성
    # 1월 7일 호출 시 -> 1/1~1/7 데이터 나옴
    start_date = datetime(2025, 1, 7)
    end_date = datetime(2026, 1, 5) # 2025년 말 데이터까지 포함하기 위함
    
    current_date = start_date
    all_records = []

    print("2025년 유가 데이터 수집 시작...")

    while current_date <= end_date:
        date_str = current_date.strftime('%Y%m%d')
        params = {
            'certkey': api_key,
            'out': 'json',
            'date': date_str
        }
        
        try:
            response = requests.get(url, params=params)
            data = response.json()
            
            # 응답 구조: RESULT -> OIL 리스트 내에 데이터 존재
            oil_list = data.get('RESULT', {}).get('OIL', [])
            
            for oil in oil_list:
                all_records.append({
                    '날짜': oil.get('DATE'),
                    '제품코드': oil.get('PRODCD'),
                    '평균가격': oil.get('PRICE')
                })
            
            print(f"{date_str} 기준 이전 7일 데이터 수집 완료")
            
            # 7일 뒤로 이동
            current_date += timedelta(days=7)
            # API 서버 부하 방지를 위해 잠깐 휴식
            time.sleep(0.5)
            
        except Exception as e:
            print(f"{date_str} 요청 중 오류 발생: {e}")
            break

    # 데이터 정리
    if all_records:
        df = pd.DataFrame(all_records)
        # 7일씩 가져오다 보면 겹치는 날짜가 생길 수 있으므로 중복 제거
        df = df.drop_duplicates(subset=['날짜', '제품코드'])
        # 날짜순 정렬
        df = df.sort_values(by=['날짜', '제품코드'])
        
        # 제품코드 한글 변환 (보기 편하게)
        prod_map = {
            'B034': '고급휘발유', 'B027': '보통휘발유', 
            'D047': '자동차경유', 'C004': '실내등유', 'K015': '자동차부탄'
        }
        df['제품명'] = df['제품코드'].map(prod_map)
        
        # 파일 저장
        df.to_csv("opinet_2025_prices.csv", index=False, encoding="utf-8-sig")
        print(f"\n--- 수집 완료! ---")
        print(f"저장된 파일: opinet_2025_prices.csv (총 {len(df)}행)")
    else:
        print("수집된 데이터가 없습니다.")

# 실행 (본인의 오피넷 API 키를 입력하세요)
fetch_opinet_2025("nnDwKn9in5QVgyVZBCZyc5gmBJYmoYx4EqWhlIf2ews")