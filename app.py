"""
Точка входа для Vercel.

Vercel ищет FastAPI-объект с именем `app` в app.py в корне проекта.
Сам бэкенд лежит в yookassa_backend/app.py и переиспользуется и здесь,
и при запуске на VPS/Docker.
"""
from yookassa_backend.app import app

__all__ = ["app"]
