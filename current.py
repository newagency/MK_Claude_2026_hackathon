import requests
import pandas as pd
from datetime import datetime, timedelta

def get_usd_exchange_rates(start_date_str, end_date_str, authkey):
    url = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON"
    
    # 날짜 범위 생성
    start = datetime.strptime(start_date_str, '%Y%m%d')
    end = datetime.strptime(end_date_str, '%Y%m%d')
    date_list = [(start + timedelta(days=x)).strftime('%Y%m%d') for x in range((end - start).days + 1)]
    
    results = []
    
    for date in date_list:
        params = {
            'authkey': authkey,
            'searchdate': date,
            'data': 'AP01' # 환율 데이터 코드
        }
        
        try:
            response = requests.get(url, params=params)
            data = response.json()
            
            # 데이터가 없는 경우(주말/공휴일/오전 11시 이전)는 스킵
            if not data:
                continue
                
            # 전체 통화 중 'USD'만 찾기
            for item in data:
                if item.get('cur_unit') == 'USD':
                    # 가격 데이터에서 쉼표(,) 제거 후 숫자로 변환
                    deal_rate = item.get('deal_bas_r').replace(',', '')
                    
                    results.append({
                        '날짜': date,
                        '통화명': item.get('cur_nm'),
                        '매매기준율': float(deal_rate)
                    })
                    print(f"{date} 환율 수집 완료: {deal_rate}")
                    break
        except Exception as e:
            print(f"{date} 요청 중 오류 발생: {e}")
            
    return pd.DataFrame(results)

# --- 설정 및 실행 ---
MY_AUTHKEY = "1fYthNdGMpgpqNY4CU3WtrvqWZ3RQd45 " # 여기에 직접 발급받은 키를 넣으세요.
df_usd = get_usd_exchange_rates('20250101', '20251231', MY_AUTHKEY)

# CSV 저장
if not df_usd.empty:
    df_usd.to_csv("usd_rates_2025.csv", index=False, encoding="utf-8-sig")
    print("\n저장 완료!")
else:
    print("수집된 데이터가 없습니다.")