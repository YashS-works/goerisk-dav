from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from utils.cache import DataCache
from routers import countries, simulation, analytics, quiz

cache = DataCache()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🌍 GeoRisk DAV Backend Starting...")
    print("📡 Fetching data from all APIs...")
    await cache.initialize()
    countries.set_cache(cache)
    simulation.set_cache(cache)
    analytics.set_cache(cache)
    quiz.set_cache(cache)
    print("✅ All data loaded. Server ready.")
    yield
    print("🛑 Server shutting down...")
    cache.clear()

app = FastAPI(
    title       = "GeoRisk DAV API",
    description = "Geopolitical Spillover Analytics Backend",
    version     = "1.0.0",
    lifespan    = lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(
    countries.router,
    prefix = "/data",
    tags   = ["Countries"]
)
app.include_router(
    simulation.router,
    prefix = "/simulate",
    tags   = ["Simulation"]
)
app.include_router(
    analytics.router,
    prefix = "/analytics",
    tags   = ["Analytics"]
)
app.include_router(
    quiz.router,
    prefix = "/quiz",
    tags   = ["Quiz & Insights"]
)

@app.get("/")
def root():
    return {
        "status":  "running",
        "project": "GeoRisk DAV",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status": "ok",
        **cache.get_summary()
    }