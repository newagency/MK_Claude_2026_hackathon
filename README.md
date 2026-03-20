# 사장님 리스크 레이더

소상공인을 위한 원자재 가격 리스크 대시보드.

## 사전 준비

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 및 **실행**
- [Node.js 18+](https://nodejs.org/) 설치
- Anthropic API Key

---

## 시작하기

모든 명령은 **이 저장소 루트**에서 실행합니다.

### 1. 환경변수

```bash
cp backend/.env.example backend/.env
```

`backend/.env`를 열고 **API 키만 교체**합니다. 나머지는 그대로 둡니다.

```
ANTHROPIC_API_KEY=여기에_실제_키_입력
```

> `DB_HOST=db`는 Docker 컨테이너끼리 통신하는 값입니다. **바꾸지 마세요.**

### 2. 데이터 파일

```bash
mkdir -p data
```

`data/mock_garak_5years.json` 파일을 넣어주세요. (없으면 원자재 대시보드가 500 에러)

### 3. DB + Backend 실행

```bash
docker compose up backend db --build -d
```

처음 실행하면 DB 테이블이 자동 생성됩니다. 약 10초 정도 기다려주세요.

### 4. (최초 1회) 뉴스 적재

DB에 뉴스 데이터가 비어 있으므로 한 번 넣어줘야 합니다.

**저장소 루트**에서:

```bash
cd db
python3 -m venv .venv && source .venv/bin/activate && pip install psycopg2-binary
```

그대로 **`db/` 안에서** 이어서:

```bash
DB_HOST=localhost python load_data.py categories mk_news_categories.json
DB_HOST=localhost python load_data.py articles /path/to/2025
```

> `/path/to/2025`를 실제 뉴스 JSON 폴더 경로로 바꿔주세요.
> 전체 적재는 약 5~10분 걸립니다.

### 4-1. 표준 가격 CSV 적재

`2025_standard_prices_filtered.csv`를 DB에 넣고 싶다면 다음 순서로 진행하세요.

```bash
# 저장소 루트에서 CSV를 컨테이너로 복사
docker compose cp 2025_standard_prices_filtered.csv db:/app/2025_standard_prices_filtered.csv

# 기존 데이터 초기화 후 CSV 적재
docker compose exec -T db psql -U sosang -d sosang -c "TRUNCATE standard_prices;"
docker compose exec -T db psql -U sosang -d sosang -c "\copy standard_prices(stat_date,item_name,variety_name,grade_name,price_per_kg) FROM '/app/2025_standard_prices_filtered.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
```

> `standard_prices` 테이블은 `db/init/01_schema.sql`에 정의돼 있으며, `docker compose up db` 시 자동 생성됩니다.

적재 확인 — **저장소 루트로 돌아와서**:

```bash
cd ..
docker compose exec db psql -U sosang -c "SELECT count(*) FROM news_articles;"
```

> `docker compose down -v`로 DB를 초기화하지 않는 한, 이 단계는 **처음 한 번만** 하면 됩니다.

### 5. Frontend 실행

새 터미널을 열고, **저장소 루트**에서:

```bash
cd frontend
npm install
npm run dev
```

### 6. 확인

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |

> 뉴스 첫 조회는 LLM 호출 때문에 **30~60초** 걸립니다. 같은 날짜 재조회는 캐시로 즉시 응답합니다.

---

## 종료 / 재시작

```bash
# 종료
docker compose down

# 재시작 (DB 데이터 유지)
docker compose up backend db -d

# DB 완전 초기화 (뉴스 재적재 필요)
docker compose down -v
docker compose up backend db --build -d
```

> Backend 재시작 후 프론트가 빈 화면이면 → `npm run dev` 재시작 (Vite 프록시 끊김)

---

## 트러블슈팅

| 증상 | 원인 → 해결 |
|------|-------------|
| 뉴스 0건 | 날짜가 DB 범위 밖 (2025-01-01~12-31만 있음) |
| 원자재 500 에러 | `data/mock_garak_5years.json` 없음 → 파일 배치 |
| Backend DB 연결 실패 | `backend/.env`에서 `DB_HOST=db` 확인 |
| `load_data.py` DB 연결 실패 | 명령 앞에 `DB_HOST=localhost` 붙였는지 확인 |
| FE 빈 화면 / 로딩 안 됨 | `npm run dev` 재시작 |
| `.env` 바꿨는데 안 반영 | `docker compose up -d backend` (restart 아님) |
