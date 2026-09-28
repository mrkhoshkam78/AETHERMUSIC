"""Application configuration - all local, offline-first."""
from pathlib import Path
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    APP_NAME: str = "Knowledge Intelligence Engine"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Paths - all local
    BASE_DIR: Path = Path(__file__).resolve().parents[2]
    DATA_DIR: Path = BASE_DIR.parent / "data"
    UPLOAD_DIR: Path = DATA_DIR / "uploads"
    EXPORT_DIR: Path = DATA_DIR / "exports"
    DB_PATH: Path = DATA_DIR / "knowledge.db"
    CHROMA_DIR: Path = DATA_DIR / "chroma"

    # Database
    DATABASE_URL: str = Field(default="")

    # Crawler defaults
    CRAWL_DEFAULT_DEPTH: int = 2
    CRAWL_DEFAULT_MAX_PAGES: int = 50
    CRAWL_RATE_LIMIT_DELAY: float = 1.0  # seconds between requests
    CRAWL_TIMEOUT: int = 30
    CRAWL_USER_AGENT: str = "KnowledgeEngine/1.0 (+local; offline-knowledge-bot)"
    CRAWL_RESPECT_ROBOTS: bool = True
    CRAWL_MAX_CONTENT_SIZE: int = 5 * 1024 * 1024  # 5MB

    # Chunking
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 120
    MIN_CHUNK_LENGTH: int = 50

    # Search
    SEARCH_DEFAULT_LIMIT: int = 20
    SEARCH_MAX_LIMIT: int = 100
    BM25_WEIGHT: float = 0.45
    SEMANTIC_WEIGHT: float = 0.35
    FUZZY_WEIGHT: float = 0.10
    METADATA_WEIGHT: float = 0.10

    # AI (optional, modular)
    AI_ENABLED: bool = False
    AI_PROVIDER: str = "none"  # none | ollama | sentence-transformers
    OLLAMA_BASE_URL: str = "http://127.0.0.1:11434"
    OLLAMA_MODEL: str = "llama3.2"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384

    # Security
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS: set = {
        ".pdf", ".txt", ".md", ".docx", ".csv", ".json", ".html", ".htm", ".xml"
    }

    class Config:
        env_file = ".env"
        extra = "ignore"

    def model_post_init(self, __context):
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"sqlite:///{self.DB_PATH}"
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        self.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        self.CHROMA_DIR.mkdir(parents=True, exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
