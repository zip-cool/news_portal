from fastapi import APIRouter

from app.database import get_db

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("")
async def get_categories():
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM categories ORDER BY name ASC")
        categories = [dict(r) for r in cur.fetchall()]

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

    return {"categories": categories}
