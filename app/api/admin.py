import re
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.auth import get_required_admin_user
from app.config import NEWS_UPLOADS_DIR
from app.database import get_db

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(get_required_admin_user)])


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class CommentUpdate(BaseModel):
    text: str


class UserAction(BaseModel):
    action: str


# 1. Dashboard
@router.get("/dashboard")
async def get_dashboard():
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM news")
        total_news = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM comments")
        total_comments = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM views")
        total_views = cur.fetchone()[0]

        # Latest comments
        cur.execute(
            """
            SELECT comments.*, users.username, news.title as news_title
            FROM comments
            LEFT JOIN users ON comments.user_id = users.id
            LEFT JOIN news ON comments.news_id = news.id
            ORDER BY comments.date DESC
            LIMIT 5
            """
        )
        latest_comments = [dict(r) for r in cur.fetchall()]

        # Latest news
        cur.execute(
            """
            SELECT news.*, categories.name as category_name,
                   (SELECT COUNT(*) FROM views WHERE views.news_id = news.id) as views_count
            FROM news
            LEFT JOIN categories ON news.category_id = categories.id
            ORDER BY news.date DESC
            LIMIT 5
            """
        )
        latest_news = [dict(r) for r in cur.fetchall()]

    return {
        "counters": {
            "users": total_users,
            "news": total_news,
            "comments": total_comments,
            "views": total_views,
        },
        "latest_comments": latest_comments,
        "latest_news": latest_news,
    }


# 2. News CRUD
@router.get("/news")
async def admin_get_news():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT news.*, categories.name as category_name
            FROM news
            LEFT JOIN categories ON news.category_id = categories.id
            ORDER BY news.date DESC
            """
        )
        news_items = [dict(r) for r in cur.fetchall()]
    return {"news": news_items}


@router.post("/news")
async def admin_create_news(
    title: str = Form(...),
    short_text: str = Form(...),
    content: str = Form(...),
    category_id: str = Form(...),
    is_hot: int = Form(0),
    image: Optional[UploadFile] = File(None),
):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM news")
        max_num = 0
        for row in cur.fetchall():
            m = re.match(r"^news(\d+)$", row["id"])
            if m:
                max_num = max(max_num, int(m.group(1)))
        new_id = f"news{max_num + 1}"

        image_path = "uploads/news/default.jpg"
        if image and image.filename:
            ext = Path(image.filename).suffix.lower() or ".jpg"
            image_filename = f"{new_id}{ext}"
            target_path = NEWS_UPLOADS_DIR / image_filename
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_path = f"uploads/news/{image_filename}"

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            """
            INSERT INTO news (id, category_id, title, short_text, full_text, image, date, is_hot, is_hidden, user_group)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'all')
            """,
            (new_id, category_id, title.strip(), short_text.strip(), content.strip(), image_path, now_str, 1 if is_hot else 0),
        )

    return {"success": True, "id": new_id, "message": "Новость успешно создана"}


@router.put("/news/{news_id}")
async def admin_update_news(
    news_id: str,
    title: str = Form(...),
    short_text: str = Form(...),
    content: str = Form(...),
    category_id: str = Form(...),
    is_hot: int = Form(0),
    image: Optional[UploadFile] = File(None),
):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM news WHERE id = ?", (news_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Новость не найдена")

        new_image_path = None
        if image and image.filename:
            ext = Path(image.filename).suffix.lower() or ".jpg"
            image_filename = f"{news_id}_{int(datetime.now().timestamp())}{ext}"
            target_path = NEWS_UPLOADS_DIR / image_filename
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            new_image_path = f"uploads/news/{image_filename}"

        if new_image_path:
            cur.execute(
                """
                UPDATE news 
                SET title = ?, short_text = ?, full_text = ?, category_id = ?, is_hot = ?, image = ?
                WHERE id = ?
                """,
                (title.strip(), short_text.strip(), content.strip(), category_id, 1 if is_hot else 0, new_image_path, news_id),
            )
        else:
            cur.execute(
                """
                UPDATE news 
                SET title = ?, short_text = ?, full_text = ?, category_id = ?, is_hot = ?
                WHERE id = ?
                """,
                (title.strip(), short_text.strip(), content.strip(), category_id, 1 if is_hot else 0, news_id),
            )

    return {"success": True, "message": "Новость успешно обновлена"}


@router.delete("/news/{news_id}")
async def admin_delete_news(news_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM news WHERE id = ?", (news_id,))
        cur.execute("DELETE FROM comments WHERE news_id = ?", (news_id,))
        cur.execute("DELETE FROM views WHERE news_id = ?", (news_id,))
    return {"success": True, "message": "Новость успешно удалена"}


# 3. Categories CRUD
@router.get("/categories")
async def admin_get_categories():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM categories ORDER BY name ASC")
        categories = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT category_id, COUNT(*) as cnt FROM news GROUP BY category_id")
        counts = {r["category_id"]: r["cnt"] for r in cur.fetchall()}

    for c in categories:
        c["news_count"] = counts.get(c["id"], 0)

    return {"categories": categories}


@router.post("/categories")
async def admin_create_category(payload: CategoryCreate):
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Название категории обязательно")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM categories")
        max_num = 0
        for row in cur.fetchall():
            m = re.match(r"^cat(\d+)$", row["id"])
            if m:
                max_num = max(max_num, int(m.group(1)))
        cat_id = f"cat{max_num + 1}" if max_num > 0 else f"cat_{uuid.uuid4().hex[:6]}"

        cur.execute(
            "INSERT INTO categories (id, name, description) VALUES (?, ?, ?)",
            (cat_id, name_clean, (payload.description or "").strip()),
        )

    return {"success": True, "id": cat_id, "message": "Категория успешно создана"}


@router.put("/categories/{cat_id}")
async def admin_update_category(cat_id: str, payload: CategoryCreate):
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(status_code=400, detail="Название категории обязательно")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE categories SET name = ?, description = ? WHERE id = ?",
            (name_clean, (payload.description or "").strip(), cat_id),
        )

    return {"success": True, "message": "Категория успешно обновлена"}


@router.delete("/categories/{cat_id}")
async def admin_delete_category(cat_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM news WHERE category_id = ?", (cat_id,))
        count = cur.fetchone()[0]
        if count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Невозможно удалить категорию: в ней содержится {count} новостей!",
            )
        cur.execute("DELETE FROM categories WHERE id = ?", (cat_id,))

    return {"success": True, "message": "Категория успешно удалена"}


# 4. Comments CRUD
@router.get("/comments")
async def admin_get_comments():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT comments.*, users.username, news.title as news_title
            FROM comments
            LEFT JOIN users ON comments.user_id = users.id
            LEFT JOIN news ON comments.news_id = news.id
            ORDER BY comments.date DESC
            """
        )
        comments = [dict(r) for r in cur.fetchall()]
    return {"comments": comments}


@router.put("/comments/{comment_id}")
async def admin_update_comment(comment_id: str, payload: CommentUpdate):
    text_clean = payload.text.strip()
    if not text_clean:
        raise HTTPException(status_code=400, detail="Текст комментария не может быть пустым")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE comments SET text = ? WHERE id = ?", (text_clean, comment_id))
    return {"success": True, "message": "Комментарий успешно обновлен"}


@router.delete("/comments/{comment_id}")
async def admin_delete_comment(comment_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
    return {"success": True, "message": "Комментарий успешно удален"}


# 5. Users moderation
@router.get("/users")
async def admin_get_users():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, username, email, group_name, is_active, is_confirmed, registration_date 
            FROM users 
            ORDER BY registration_date DESC
            """
        )
        users = [dict(r) for r in cur.fetchall()]
    return {"users": users}


@router.post("/users/{user_id}/action")
async def admin_user_action(user_id: str, payload: UserAction):
    action = payload.action
    with get_db() as conn:
        cur = conn.cursor()
        if action == "confirm":
            cur.execute("UPDATE users SET is_confirmed = 1 WHERE id = ?", (user_id,))
            msg = "Пользователь подтвержден"
        elif action == "block":
            cur.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
            msg = "Пользователь заблокирован"
        elif action == "unblock":
            cur.execute("UPDATE users SET is_active = 1 WHERE id = ?", (user_id,))
            msg = "Пользователь разблокирован"
        elif action == "make_admin":
            cur.execute("UPDATE users SET group_name = 'admin' WHERE id = ?", (user_id,))
            msg = "Пользователь назначен администратором"
        elif action == "make_user":
            cur.execute("UPDATE users SET group_name = 'user' WHERE id = ?", (user_id,))
            msg = "Права администратора сняты"
        elif action == "delete":
            cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
            cur.execute("DELETE FROM comments WHERE user_id = ?", (user_id,))
            msg = "Пользователь удален"
        else:
            raise HTTPException(status_code=400, detail="Неизвестное действие")

    return {"success": True, "message": msg}


# 6. Statistics
@router.get("/statistics")
async def admin_get_statistics():
    with get_db() as conn:
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM views")
        total_views = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM searches")
        total_searches = cur.fetchone()[0]

        # Top news by views
        cur.execute(
            """
            SELECT news.id, news.title, COUNT(views.id) as views
            FROM views
            JOIN news ON views.news_id = news.id
            GROUP BY news.id, news.title
            ORDER BY views DESC
            LIMIT 10
            """
        )
        top_news = [dict(r) for r in cur.fetchall()]

        # Top search queries
        cur.execute(
            """
            SELECT keyword, COUNT(*) as count
            FROM searches
            WHERE keyword != ''
            GROUP BY keyword
            ORDER BY count DESC
            LIMIT 10
            """
        )
        top_searches = [dict(r) for r in cur.fetchall()]

    return {
        "total_views": total_views,
        "total_searches": total_searches,
        "top_news": top_news,
        "views_chart_labels": [n["title"] for n in top_news],
        "views_chart_data": [n["views"] for n in top_news],
        "top_searches": top_searches,
        "search_chart_labels": [s["keyword"] for s in top_searches],
        "search_chart_data": [s["count"] for s in top_searches],
    }
