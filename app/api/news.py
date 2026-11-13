import math
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.auth import get_optional_current_user, get_required_current_user
from app.config import NEWS_PER_PAGE_DEFAULT, NEWS_PER_PAGE_OPTIONS
from app.database import get_db
from app.search_utils import filter_news_by_search, record_search_query

router = APIRouter(prefix="/news", tags=["news"])


class CommentCreate(BaseModel):
    text: str


@router.get("/home")
async def get_home_data():
    with get_db() as conn:
        cur = conn.cursor()

        # Categories
        cur.execute("SELECT * FROM categories ORDER BY name ASC")
        categories = [dict(r) for r in cur.fetchall()]

        # Category news counts
        cur.execute(
            """
            SELECT category_id, COUNT(*) as cnt 
            FROM news 
            WHERE is_hidden = 0 
            GROUP BY category_id
            """
        )
        counts = {r["category_id"]: r["cnt"] for r in cur.fetchall()}
        for c in categories:
            c["news_count"] = counts.get(c["id"], 0)

        # Hot news
        cur.execute(
            """
            SELECT news.*, categories.name as category_name
            FROM news
            LEFT JOIN categories ON news.category_id = categories.id
            WHERE news.is_hot = 1 AND news.is_hidden = 0
            ORDER BY news.date DESC
            LIMIT 10
            """
        )
        hot_news = [dict(r) for r in cur.fetchall()]

        # Latest 4 news
        cur.execute(
            """
            SELECT news.*, categories.name as category_name
            FROM news
            LEFT JOIN categories ON news.category_id = categories.id
            WHERE news.is_hidden = 0
            ORDER BY news.date DESC
            LIMIT 4
            """
        )
        latest_news = [dict(r) for r in cur.fetchall()]

    return {
        "categories": categories,
        "hot_news": hot_news,
        "latest_news": latest_news,
    }


@router.get("")
async def get_news_list(
    category: Optional[str] = None,
    search: Optional[str] = None,
    date: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(NEWS_PER_PAGE_DEFAULT),
):
    if per_page not in NEWS_PER_PAGE_OPTIONS:
        per_page = NEWS_PER_PAGE_DEFAULT

    with get_db() as conn:
        cur = conn.cursor()
        query = """
            SELECT news.*, categories.name as category_name
            FROM news
            LEFT JOIN categories ON news.category_id = categories.id
            WHERE news.is_hidden = 0
        """
        params = []

        if category:
            query += " AND news.category_id = ?"
            params.append(category)

        if date:
            query += " AND DATE(news.date) = ?"
            params.append(date)

        query += " ORDER BY news.date DESC"
        cur.execute(query, params)
        all_news = [dict(r) for r in cur.fetchall()]

    # Apply search filter
    clean_search = (search or "").strip()
    if clean_search:
        record_search_query(clean_search)
        all_news = filter_news_by_search(all_news, clean_search)

    total_count = len(all_news)
    total_pages = max(1, math.ceil(total_count / per_page))
    if page > total_pages:
        page = total_pages

    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    items = all_news[start_idx:end_idx]

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.get("/{news_id}")
async def get_news_detail(
    news_id: str,
    current_user: Optional[Dict] = Depends(get_optional_current_user),
):
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            SELECT news.*, categories.name as category_name
            FROM news
            LEFT JOIN categories ON news.category_id = categories.id
            WHERE news.id = ?
            """,
            (news_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Новость не найдена")

        news_item = dict(row)

        # Track view if user is logged in
        if current_user:
            user_id = current_user["id"]
            cur.execute(
                "SELECT date FROM views WHERE news_id = ? AND user_id = ? ORDER BY date DESC LIMIT 1",
                (news_id, user_id),
            )
            last_view_row = cur.fetchone()
            should_add = True
            if last_view_row and last_view_row["date"]:
                try:
                    last_view_time = datetime.strptime(last_view_row["date"][:19], "%Y-%m-%d %H:%M:%S")
                    if (datetime.now() - last_view_time).total_seconds() < 300:
                        should_add = False
                except Exception:
                    pass

            if should_add:
                view_id = f"view_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cur.execute(
                    "INSERT INTO views (id, news_id, user_id, date) VALUES (?, ?, ?, ?)",
                    (view_id, news_id, user_id, now_str),
                )

        # Total views
        cur.execute("SELECT COUNT(*) FROM views WHERE news_id = ?", (news_id,))
        total_views = cur.fetchone()[0]

        # Comments
        cur.execute(
            """
            SELECT comments.*, users.username
            FROM comments
            LEFT JOIN users ON comments.user_id = users.id
            WHERE comments.news_id = ?
            ORDER BY comments.date DESC
            """,
            (news_id,),
        )
        comments = [dict(r) for r in cur.fetchall()]

    return {
        "news": news_item,
        "total_views": total_views,
        "comments": comments,
    }


@router.post("/{news_id}/comments")
async def add_news_comment(
    news_id: str,
    payload: CommentCreate,
    current_user: Dict = Depends(get_required_current_user),
):
    comment_text = payload.text.strip()
    if not comment_text:
        raise HTTPException(status_code=400, detail="Текст комментария не может быть пустым")

    comment_id = f"com{int(datetime.now().timestamp())}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM news WHERE id = ?", (news_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Новость не найдена")

        cur.execute(
            "INSERT INTO comments (id, news_id, user_id, text, date) VALUES (?, ?, ?, ?, ?)",
            (comment_id, news_id, current_user["id"], comment_text, now_str),
        )

    return {
        "id": comment_id,
        "news_id": news_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "text": comment_text,
        "date": now_str,
    }
