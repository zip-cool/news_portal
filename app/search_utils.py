import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.database import get_db

RUSSIAN_CONSONANTS = "бвгджзйклмнпрстфхцчшщ"


def last_consonant_pos(text: str) -> Optional[int]:
    """
    Finds index of the last Russian consonant in text.
    Equivalent to PHP's lastConsonantPos($str).
    """
    text_lower = text.lower()
    for i in range(len(text_lower) - 1, -1, -1):
        if text_lower[i] in RUSSIAN_CONSONANTS:
            return i
    return None


def record_search_query(raw_query: str) -> str:
    """
    Records search query into the searches table.
    If query matches an existing keyword within 1-2 trailing characters,
    groups it under the existing keyword.
    """
    query_lower = raw_query.strip().lower()
    if not query_lower:
        return ""

    final_keyword = query_lower

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT keyword FROM searches WHERE keyword != '' ORDER BY date DESC LIMIT 100")
        existing_keywords = [row["keyword"] for row in cur.fetchall()]

        for existing in existing_keywords:
            min_len = min(len(existing), len(query_lower))
            if (min_len > 2 and existing[: min_len - 1] == query_lower[: min_len - 1]) or (
                min_len > 3 and existing[: min_len - 2] == query_lower[: min_len - 2]
            ):
                final_keyword = existing
                break

        search_id = f"search_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}"
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cur.execute(
            "INSERT INTO searches (id, keyword, date) VALUES (?, ?, ?)",
            (search_id, final_keyword, now_str),
        )

    return final_keyword


def filter_news_by_search(news_items: List[Dict[str, Any]], search_query: str) -> List[Dict[str, Any]]:
    """
    Filters news using the PHP morphology/stemming algorithm:
    Matches prefix up to the last consonant.
    """
    query_lower = search_query.strip().lower()
    if not query_lower:
        return news_items

    pos = last_consonant_pos(query_lower)
    if pos is not None:
        search_base = query_lower[: pos + 1]
    else:
        search_base = query_lower

    matched_items = []
    for item in news_items:
        fields = [
            item.get("title", "").lower(),
            item.get("short_text", "").lower(),
            item.get("full_text", "").lower(),
        ]

        found = False
        for text in fields:
            words = re.split(r"\s+", text)
            for word in words:
                # Strip punctuation
                clean_word = re.sub(r"[^\w]", "", word)
                if clean_word.startswith(search_base):
                    found = True
                    break
            if found:
                break

        # Fallback substring check
        if not found and query_lower in " ".join(fields):
            found = True

        if found:
            matched_items.append(item)

    return matched_items
