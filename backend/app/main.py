from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import analyzer, commodities, simulate, news

app = FastAPI(title="sosang")

app.include_router(analyzer.router,    prefix="/api/v1", tags=["Analysis"])
app.include_router(commodities.router, prefix="/api/v1", tags=["Commodities"])
app.include_router(simulate.router,    prefix="/api/v1", tags=["Simulate"])
app.include_router(news.router,        prefix="/api/v1", tags=["News"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "active", "service": "sosang"}
