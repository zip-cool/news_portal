from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "news_portal.db"
UPLOADS_DIR = BASE_DIR / "uploads"
NEWS_UPLOADS_DIR = UPLOADS_DIR / "news"
STATIC_DIR = BASE_DIR / "static"

SECRET_KEY = "news-portal-secret-key-mei-master-project-2026-very-secure-jwt-key"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 48

NEWS_PER_PAGE_DEFAULT = 10
NEWS_PER_PAGE_OPTIONS = [5, 10, 20]
