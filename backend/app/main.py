"""Knowledge Intelligence Engine - Main Application Entry."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.db.base import init_db
from app.api.routes import router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Seed default categories
    from app.db.base import SessionLocal
    from app.models.entities import Category
    from app.ingestion.pipeline import slugify
    db = SessionLocal()
    try:
        if db.query(Category).count() == 0:
            defaults = [
                ("Science", None, "🔬", "#3b82f6"),
                ("Technology", None, "💻", "#8b5cf6"),
                ("World", None, "🌍", "#10b981"),
                ("Business", None, "📈", "#f59e0b"),
                ("History", None, "📜", "#ef4444"),
                ("Health", None, "🏥", "#ec4899"),
            ]
            for name, parent, icon, color in defaults:
                db.add(Category(name=name, slug=slugify(name), path=name, icon=icon, color=color))
            # Subcategories
            db.flush()
            tech = db.query(Category).filter(Category.slug == "technology").first()
            science = db.query(Category).filter(Category.slug == "science").first()
            if tech:
                for sub in ["Programming", "AI & Machine Learning", "Web Development", "Infrastructure"]:
                    db.add(Category(name=sub, slug=slugify(sub), parent_id=tech.id, path=f"Technology/{sub}"))
            if science:
                for sub in ["Physics", "Biology", "Chemistry", "Mathematics"]:
                    db.add(Category(name=sub, slug=slugify(sub), parent_id=science.id, path=f"Science/{sub}"))
            db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Offline Knowledge Intelligence Engine",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/health",
        "message": "Offline Knowledge Intelligence Engine is running.",
    }
