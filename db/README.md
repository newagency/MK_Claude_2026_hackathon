# DB Setup (로컬 재생산 가이드)

## 사전 준비

- Docker Desktop 실행
- 뉴스 데이터 월별 폴더 (01~12) 가 로컬에 존재
- 카테고리 JSON은 `db/mk_news_categories.json`에 포함되어 있음

## Step 1. PostgreSQL 컨테이너 시작

```bash
# 프로젝트 루트에서 실행
docker compose up db -d
```

최초 실행 시 `db/init/01_schema.sql`이 자동으로 실행되어 테이블이 생성됩니다.

> 스키마를 초기화하고 싶다면:
> ```bash
> docker compose down -v   # 볼륨 삭제
> docker compose up db -d  # 재생성
> ```

## Step 2. Python 의존성 (backend venv 사용)

```bash
cd backend
source .venv/bin/activate   # 또는 .venv\Scripts\activate (Windows)
# psycopg2-binary는 requirements.txt에 이미 포함
```

## Step 3. 카테고리 마스터 적재

```bash
cd db
python load_data.py categories mk_news_categories.json
```

## Step 4. 뉴스 기사 적재

```bash
# 전체 (01~12월)
python load_data.py articles /path/to/2025

# 특정 월만
python load_data.py articles /path/to/2025/03
```

> 19만 건 전체 적재 시 약 5~10분 소요됩니다.

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DB_HOST` | `localhost` | DB 호스트 |
| `DB_PORT` | `5432` | DB 포트 |
| `DB_NAME` | `sosang` | DB 이름 |
| `DB_USER` | `sosang` | DB 유저 |
| `DB_PASSWORD` | `sosang` | DB 비밀번호 |

기본값이 docker-compose 설정과 동일하므로 별도 설정 없이 바로 사용 가능합니다.

## 접속 확인

```bash
# psql로 직접 확인
docker compose exec db psql -U sosang -c "SELECT count(*) FROM news_articles;"
```
