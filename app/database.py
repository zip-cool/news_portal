import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import DATA_DIR, DB_PATH, NEWS_UPLOADS_DIR

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS news (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    short_text TEXT NOT NULL,
    full_text TEXT NOT NULL,
    image TEXT DEFAULT 'uploads/news/default.jpg',
    date TEXT NOT NULL,
    is_hot INTEGER DEFAULT 0,
    is_hidden INTEGER DEFAULT 0,
    user_group TEXT DEFAULT 'all',
    FOREIGN KEY (category_id) REFERENCES categories (id)
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    group_name TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    is_confirmed INTEGER DEFAULT 0,
    registration_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    news_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (news_id) REFERENCES news (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS views (
    id TEXT PRIMARY KEY,
    news_id TEXT NOT NULL,
    user_id TEXT,
    date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS searches (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_date ON news (date DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news (category_id);
CREATE INDEX IF NOT EXISTS idx_comments_news ON comments (news_id);
CREATE INDEX IF NOT EXISTS idx_views_news ON views (news_id);
CREATE INDEX IF NOT EXISTS idx_searches_keyword ON searches (keyword);
"""


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Initializes SQLite database tables and directories if they do not exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    NEWS_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    with get_db() as conn:
        conn.executescript(SCHEMA_SQL)
