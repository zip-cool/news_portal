"""
========================================================================================
МАРШРУТЫ REST API ДЛЯ АУТЕНТИФИКАЦИИ И РЕГИСТРАЦИИ (app/api/auth.py)
========================================================================================

Данный модуль предоставляет REST API эндпоинты, к которым обращается «Толстый клиент»:
- POST /api/auth/login    -> принимает JSON {username, password}, возвращает JWT-токен и данные профиля.
- POST /api/auth/register -> принимает JSON с данными для регистрации, валидирует их и создает аккаунт.
- GET  /api/auth/me       -> защищенный эндпоинт, возвращает данные текущего пользователя по JWT-токену.
========================================================================================
"""

import re
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import (
    authenticate_user,
    get_required_current_user,
    register_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# Pydantic-схемы для строгой валидации входящих JSON-данных от толстого клиента
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str


@router.post("/login")
async def api_login(payload: LoginRequest):
    """
    ЭНДПОИНТ ВХОДА (LOGIN):
    1. Клиент (браузер) отправляет асинхронный POST-запрос с JSON {username, password}.
    2. Сервер проверяет пользователя в БД и пароль через bcrypt.
    3. При успешной проверке генерируется JWT-токен.
    4. Токен и базовая информация о пользователе возвращаются клиенту.
    5. Клиент сохраняет этот токен в localStorage для последующих авторизованных запросов.
    """
    username = payload.username.strip()
    password = payload.password
    result = authenticate_user(username, password)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["message"],
        )
    return {
        "access_token": result["access_token"],
        "token_type": "bearer",
        "user": result["user"],
    }


@router.post("/register")
async def api_register(payload: RegisterRequest):
    """
    ЭНДПОИНТ РЕГИСТРАЦИИ (REGISTER):
    1. Клиент отправляет форму регистрации (логин, email, пароль, подтверждение).
    2. Сервер выполняет валидацию длины логина, сложности пароля и формата email.
    3. Создается запись в БД с хешированным паролем и флагом is_confirmed = 0.
    4. Возвращается сообщение об успешной отправке заявки администратору.
    """
    username = payload.username.strip()
    email = payload.email.strip()
    password = payload.password
    confirm_password = payload.confirm_password

    # Серверная валидация данных
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Имя пользователя должно содержать минимум 3 символа")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен содержать минимум 6 символов")

    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Пароли не совпадают")

    email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Некорректный email адрес")

    result = register_user(username, password, email)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


@router.get("/me")
async def api_get_current_user(user: Dict = Depends(get_required_current_user)):
    """
    ЭНДПОИНТ ПРОВЕРКИ ТЕКУЩЕЙ СЕССИИ (WHOAMI):
    Клиент вызывает этот эндпоинт при запуске приложения, передавая сохраненный JWT.
    Если токен действителен, сервер подтверждает личность и возвращает актуальную роль.
    Если токен просрочен, зависимость get_required_current_user вернет 401 Unauthorized.
    """
    return {"user": user}
