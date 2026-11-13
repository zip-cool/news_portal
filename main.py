from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import api_router
from app.config import STATIC_DIR, UPLOADS_DIR
from app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Новостной портал (Толстый клиент / SPA)",
    description="REST API и клиент-серверная архитектура с генерацией UI на стороне клиента (FastAPI + SQLite + JWT + Chart.js)",
    version="3.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение статических файлов толстого клиента и загруженных медиа
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Подключение REST API
app.include_router(api_router)


# Главная страница толстого клиента (SPA Shell)
@app.get("/")
@app.get("/home")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


# Совместимость со старыми PHP-ссылками: редирект в клиентский роутер SPA
@app.get("/index.php")
async def legacy_php_router(
    page: Optional[str] = "home",
    id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    date: Optional[str] = None,
    p: Optional[int] = None,
    per_page: Optional[int] = None,
):
    if page == "news":
        if id:
            return RedirectResponse(url=f"/#news/{id}", status_code=status.HTTP_301_MOVED_PERMANENTLY)
        q = []
        if category:
            q.append(f"category={category}")
        if search:
            q.append(f"search={search}")
        if date:
            q.append(f"date={date}")
        if p:
            q.append(f"page={p}")
        if per_page:
            q.append(f"per_page={per_page}")
        qs = f"?{'&'.join(q)}" if q else ""
        return RedirectResponse(url=f"/#news{qs}", status_code=status.HTTP_301_MOVED_PERMANENTLY)

    mapping = {
        "home": "/#home",
        "login": "/#login",
        "register": "/#register",
        "logout": "/#home",
        "admin": "/#admin",
        "admin_news": "/#admin/news",
        "admin_categories": "/#admin/categories",
        "admin_comments": "/#admin/comments",
        "admin_users": "/#admin/users",
        "admin_statistics": "/#admin/statistics",
    }
    return RedirectResponse(url=mapping.get(page, "/#home"), status_code=status.HTTP_301_MOVED_PERMANENTLY)


# Обработчик ошибок 404
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Если запрос к API, возвращаем структурированный JSON
    if request.url.path.startswith("/api/"):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    # Для веб-страниц возвращаем SPA shell
    return FileResponse(STATIC_DIR / "index.html", status_code=exc.status_code)


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
