# 사장님 리스크 레이더 (Sosang Risk Radar)

소상공인을 위한 원자재 가격 리스크 대시보드. 뉴스 기반 영향 분석, 원자재 가격 추이, 매크로 시뮬레이션을 제공합니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| Frontend | React 18, Vite 5, Tailwind CSS, Tremor |
| Database | PostgreSQL 16 |
| AI/LLM | Anthropic Claude |
| Infra | Docker, Docker Compose |

## 프로젝트 구조

```
MK_Claude_2026_hackathon/
├── docker-compose.yml
├── backend/                 # FastAPI 백엔드
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py
│       ├── api/             # 라우터 (analyzer, commodities, simulate, news)
│       ├── schemas/         # Pydantic 모델
│       └── services/        # LLM, 데이터 수집, 뉴스 매칭
├── frontend/                # React SPA
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── pages/           # RiskDashboard, WhatIfEngine, LinkAuditor
│       └── components/
├── db/                      # DB 스키마 및 데이터 로더
│   ├── init/01_schema.sql
│   ├── load_data.py
│   └── mk_news_categories.json
└── data/                    # 런타임 데이터 (gitignored)
    └── mock_garak_5years.json
```

## 사전 준비

- **Docker Desktop** 설치 및 실행
- **Node.js 18+** (`npm run dev`용)
- **Anthropic API Key** (뉴스 매칭·분석 등 LLM 기능)
- **(선택)** **Python 3.x** — DB에 뉴스를 처음 넣을 때 `db/load_data.py`만 필요 (Docker만으로는 적재 스크립트가 자동 실행되지 않음)
- **(선택)** MK 뉴스 JSON — `load_data.py articles`에 넘길 월별 폴더(01~12) 데이터

## 시작하기

**실행 위치:** 아래에서 `docker compose`로 시작하는 모든 명령은 **이 저장소 루트**( `docker-compose.yml` 이 있는 폴더)에서 실행하세요. `cd db` 등으로 하위 폴더에 있으면 compose를 못 찾을 수 있습니다.

### Step 1. 환경변수 설정

```bash
cp backend/.env.example backend/.env
```

`backend/.env`를 열어 **`ANTHROPIC_API_KEY`를 실제 키로 바꿉니다.** (`sk-ant-...` 그대로 두면 LLM API가 동작하지 않습니다.) 나머지는 아래와 같이 맞추면 됩니다:

```dotenv
ANTHROPIC_API_KEY=sk-ant-...   # 필수 - Anthropic API 키
GARAK_API_KEY=                 # 선택

DB_HOST=db                     # Docker Compose 사용 시 반드시 "db" (localhost 아님)
DB_PORT=5432
DB_NAME=sosang
DB_USER=sosang
DB_PASSWORD=sosang
```

> **주의**: `DB_HOST`는 반드시 `db`로 설정하세요. Docker 컨테이너끼리는 서비스명으로 통신합니다. `localhost`로 설정하면 뉴스 API 등이 동작하지 않습니다.

### Step 2. 데이터 디렉토리 준비

**저장소 루트**에서:

```bash
mkdir -p data
# 이어서 mock_garak_5years.json 을 data/ 안에 두기 (수동 복사·다운로드)
```

| 파일 | 필수 여부 | 설명 |
|------|-----------|------|
| `data/mock_garak_5years.json` | **필수** | 없으면 `/api/v1/commodities`(대시보드 원자재)가 500 오류 |
| 뉴스 JSON 디렉토리 | 뉴스 기능 쓸 때 | 아래 Step 3-보강에서 `load_data.py`로 적재 |

### Step 3. DB + Backend 시작

**프로젝트 루트**에서 실행합니다.

```bash
docker compose up backend db --build -d
```

- 최초(또는 `docker compose down -v` 이후)에는 `db/init/01_schema.sql`만 자동 적용됩니다.
- **테이블은 생기지만 `news_articles` 등 데이터는 비어 있습니다.** 뉴스 탭/API를 쓰려면 Step 3-보강을 한 번 해야 합니다.
- 이미 적재해 둔 Docker 볼륨(`postgres_data`)이 있으면 Step 3-보강은 생략 가능합니다.

### Step 3-보강. (최초 1회) 뉴스 DB 적재

**선행 조건:** Step 3까지 끝내서 `db` 컨테이너가 떠 있고, 포트 `5432`가 막히지 않았을 것.

호스트에서 스크립트를 돌릴 때는 DB에 **localhost:5432**로 붙습니다. (`backend/.env`의 `DB_HOST=db`와 별개입니다.)

macOS / Linux:

```bash
cd db
python3 -m venv .venv
source .venv/bin/activate
pip install psycopg2-binary

export DB_HOST=localhost DB_PORT=5432 DB_NAME=sosang DB_USER=sosang DB_PASSWORD=sosang

python load_data.py categories mk_news_categories.json
python load_data.py articles /path/to/2025    # 실제 뉴스 JSON 상위 경로로 변경
```

Windows (PowerShell)에서는 `export` 대신:

```powershell
cd db
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install psycopg2-binary

$env:DB_HOST="localhost"; $env:DB_PORT="5432"; $env:DB_NAME="sosang"; $env:DB_USER="sosang"; $env:DB_PASSWORD="sosang"

python load_data.py categories mk_news_categories.json
python load_data.py articles C:\path\to\2025
```

> `backend/.venv`가 있고 `psycopg2-binary`가 깔려 있으면 `db` 대신 그 venv를 써도 됩니다.  
> 전체 기사 적재는 약 5~10분 걸릴 수 있습니다.

적재 확인 (**반드시 저장소 루트로 이동한 뒤**):

```bash
cd ..    # db 폴더에 있다면 루트로
docker compose exec db psql -U sosang -c "SELECT count(*) FROM news_articles;"
```

### Step 4. Frontend 실행 (새 터미널)

**저장소 루트**에서:

```bash
cd frontend
npm install
npm run dev
```

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| PostgreSQL | localhost:5432 |

### 종료 및 재시작

```bash
# 종료
docker compose down

# .env 수정 후 재시작 (restart는 env를 다시 읽지 않으므로 up 사용)
docker compose up -d backend

# DB 초기화 후 재시작 (데이터 전체 삭제)
docker compose down -v
docker compose up backend db --build -d
```

### 볼륨 초기화 후 뉴스만 다시 넣기

`docker compose down -v`로 DB를 비운 뒤에는 Step 3부터 다시 하고, **Step 3-보강**을 반복하면 됩니다. 볼륨을 지우지 않았다면 재적재할 필요 없습니다.

## 환경변수

`backend/.env` 파일에 설정합니다.

| 변수 | Docker 값 | 설명 |
|------|-----------|------|
| `ANTHROPIC_API_KEY` | (필수 입력) | Anthropic API 키 |
| `GARAK_API_KEY` | — | 가락시장 도매가 API 키 (선택) |
| `DB_HOST` | **`db`** | Backend **컨테이너** 안에서 DB 접속: `db`. 호스트에서 `load_data.py` 실행 시: `localhost` |
| `DB_PORT` | `5432` | PostgreSQL 포트 |
| `DB_NAME` | `sosang` | 데이터베이스 이름 |
| `DB_USER` | `sosang` | DB 사용자 |
| `DB_PASSWORD` | `sosang` | DB 비밀번호 |

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/v1/commodities` | 원자재 가격 현황 (3년 평균 대비, Rocket & Feather) |
| `GET` | `/api/v1/news/daily?date=YYYY-MM-DD` | 일별 뉴스 매칭 (LLM 기반 뉴스→원자재 연결) |
| `POST` | `/api/v1/analyze` | 뉴스 영향 분석 (인과 체인, 탐욕플레이션 점수) |
| `POST` | `/api/v1/simulate` | 매크로 What-If 시뮬레이션 (환율, 유가, 최저임금) |

## 주요 기능

- **리스크 대시보드**: 원자재별 3년 평균 대비 현재가, 가격 비대칭(Rocket & Feather) 탐지
- **What-If 엔진**: 환율/유가/최저임금 변동 시 식재료 원가 영향 시뮬레이션
- **뉴스 분석**: Claude 기반 뉴스→원자재 영향 매칭 및 인과 체인 분석

## 데이터 요구사항

| 파일 | 위치 | 설명 |
|------|------|------|
| `mock_garak_5years.json` | `data/` | **필수** — 가락시장 5년 도매가 (원자재 API) |
| 뉴스 JSON | 외부 경로 | 뉴스 기능 시 **적재 필요** — 월별 폴더(01~12) 구조 |
| `mk_news_categories.json` | `db/` | 카테고리 마스터 (저장소에 포함, `load_data.py categories`로 넣음) |

## 동작 체크리스트 (이것만으로 되는지)

| 단계 | README만 따르면 |
|------|-----------------|
| FE / BE / DB 기동 | Step 1~4, **명령은 저장소 루트에서** (`docker compose` / `cd frontend`) |
| 원자재 대시보드 | `data/mock_garak_5years.json`을 **직접 준비**해야 함 (저장소에 없을 수 있음) |
| 일별 뉴스·LLM 매칭 | **Step 3-보강 + 실제 뉴스 JSON 경로** 없으면 DB가 비어 있음 |
| API 키 | `ANTHROPIC_API_KEY`를 **실제 값**으로 교체해야 LLM 호출 성공 |
| `cp .env.example` 후 Docker 백엔드 | `DB_HOST=db` — `.env.example`과 일치 |
| 첫 기동 직후 | DB가 준비될 때까지 수 초 걸릴 수 있음; 백엔드가 한두 번 연결 실패 후 정상일 수 있음 |

## DB 접속 확인

저장소 루트에서:

```bash
docker compose exec db psql -U sosang -c "SELECT count(*) FROM news_articles;"
```
