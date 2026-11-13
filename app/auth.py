"""
========================================================================================
МОДУЛЬ АУТЕНТИФИКАЦИИ И БЕЗОПАСНОСТИ (app/auth.py)
========================================================================================

Здесь реализована серверная часть аутентификации для архитектуры «Толстый клиент»:
1. Хеширование и проверка паролей с помощью алгоритма bcrypt (100% совместимость со старыми
   хешами PHP $2y$ и стандартными Python $2b$).
2. Выпуск JWT-токенов (JSON Web Tokens) при успешном входе пользователя.
3. Проверка (декодирование) JWT-токенов и извлечение данных пользователя.
4. FastAPI-зависимости (Dependencies) для защиты эндпоинтов REST API:
   - get_optional_current_user: получение пользователя, если передан токен (для публичных страниц)
   - get_required_current_user: строгая проверка авторизации (HTTP 401 при отсутствии токена)
   - get_required_admin_user: проверка роли администратора (HTTP 403 при нехватке прав)
========================================================================================
"""

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import JWT_ALGORITHM, JWT_EXPIRATION_HOURS, SECRET_KEY
from app.database import get_db

# Схема извлечения токена из заголовка Authorization: Bearer <token>
# auto_error=False позволяет обрабатывать запросы без обязательного токена (например, для гостей)
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверяет соответствие открытого пароля его захешированному значению.
    Поддерживает префиксы $2y$ (PHP) и $2b$ (Python/bcrypt).
    """
    try:
        h_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(plain_password.encode("utf-8"), h_bytes)
    except Exception:
        # Резервный вариант: если библиотека требует строгий $2b$, нормализуем префикс
        try:
            if hashed_password.startswith("$2y$"):
                norm = "$2b$" + hashed_password[4:]
                return bcrypt.checkpw(plain_password.encode("utf-8"), norm.encode("utf-8"))
        except Exception:
            pass
        return False


def hash_password(plain_password: str) -> str:
    """
    Генерирует криптостойкий хеш пароля с солью (bcrypt).
    Открытый пароль никогда не сохраняется в базе данных.
    """
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(user: Dict[str, Any]) -> str:
    """
    ГЕНЕРАЦИЯ JWT-ТОКЕНА:
    Создает подписанный токен доступа, содержащий:
    - sub (subject): уникальный ID пользователя в БД
    - username: имя пользователя
    - email: электронная почта
    - role: роль/группа пользователя ('admin' или 'user')
    - exp: срок действия токена (по умолчанию 48 часов)
    Токен подписывается секретным ключом SECRET_KEY алгоритмом HS256.
    """
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["group_name"],
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    ВАЛИДАЦИЯ JWT-ТОКЕНА:
    Расшифровывает токен и проверяет его криптографическую подпись и срок действия.
    Если токен подделан или просрочен, возвращает None.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Поиск пользователя в базе данных SQLite по идентификатору ID."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Поиск пользователя в базе данных SQLite по логину (username)."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cur.fetchone()
        return dict(row) if row else None


def authenticate_user(username: str, password: str) -> Dict[str, Any]:
    """
    ПРОЦЕСС АУТЕНТИФИКАЦИИ ПОЛЬЗОВАТЕЛЯ:
    1. Ищет пользователя в SQLite по логину.
    2. Проверяет пароль через bcrypt.
    3. Проверяет статус активности (is_active == 1, не заблокирован).
    4. Проверяет подтверждение аккаунта администратором (is_confirmed == 1).
    5. При успехе выпускает JWT-токен и возвращает его клиенту.
    """
    user = get_user_by_username(username)
    if not user:
        return {"success": False, "message": "Неверное имя пользователя или пароль"}

    if not verify_password(password, user["password"]):
        return {"success": False, "message": "Неверное имя пользователя или пароль"}

    if not user["is_active"]:
        return {"success": False, "message": "Аккаунт заблокирован"}

    if not user["is_confirmed"] and user["group_name"] != "admin":
        return {"success": False, "message": "Аккаунт не подтвержден администратором"}

    token = create_access_token(user)
    safe_user = {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["group_name"],
    }
    return {"success": True, "access_token": token, "user": safe_user}


def register_user(username: str, password: str, email: str) -> Dict[str, Any]:
    """
    РЕГИСТРАЦИЯ НОВОГО ПОЛЬЗОВАТЕЛЯ:
    1. Проверяет уникальность имени пользователя.
    2. Хеширует пароль с помощью bcrypt.
    3. Сохраняет пользователя в SQLite со статусом is_confirmed = 0 (требует подтверждения).
    """
    existing = get_user_by_username(username)
    if existing:
        return {"success": False, "message": "Пользователь с таким именем уже существует"}

    user_id = uuid.uuid4().hex[:13]
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    hashed = hash_password(password)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO users (id, username, password, email, group_name, is_active, is_confirmed, registration_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, username, hashed, email, "user", 1, 0, now_str),
        )

    return {"success": True, "user_id": user_id, "message": "Регистрация успешна. Ожидайте подтверждения администратором."}


# --------------------------------------------------------------------------------------
# FASTAPI DEPENDENCIES (Зависимости для защиты маршрутов REST API)
# --------------------------------------------------------------------------------------

async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    """
    Извлекает пользователя из переданного JWT-токена, если он есть.
    Если токена нет или он недействителен, возвращает None (не блокируя публичный запрос).
    Используется, например, при просмотре новости для фиксации просмотров авторизованных лиц.
    """
    if not credentials or not credentials.credentials:
        return None
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None
    user = get_user_by_id(payload["sub"])
    if not user or not user["is_active"]:
        return None
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["group_name"],
    }


async def get_required_current_user(
    user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
) -> Dict[str, Any]:
    """
    ТРЕБУЕТ ОБЯЗАТЕЛЬНОЙ АУТЕНТИФИКАЦИИ:
    Если токен отсутствует или недействителен — немедленно прерывает выполнение
    с HTTP 401 Unauthorized.
    Используется для операций, доступных только вошедшим пользователям (добавление комментария).
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация (передайте заголовок Authorization: Bearer <token>)",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_required_admin_user(
    user: Dict[str, Any] = Depends(get_required_current_user),
) -> Dict[str, Any]:
    """
    КОНТРОЛЬ ДОСТУПА ПО РОЛИ АДМИНИСТРАТОРА (RBAC):
    1. Проверяет, что пользователь авторизован (get_required_current_user).
    2. Проверяет, что его роль — 'admin'.
    Если пользователь обычный ('user'), возвращает HTTP 403 Forbidden.
    Защищает все эндпоинты панели администратора (/api/admin/*).
    """
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуются права администратора.",
        )
    return user
