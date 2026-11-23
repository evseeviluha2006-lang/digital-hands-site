"""
Мини-бэкенд для приёма оплаты через ЮKassa.

Маршруты:
  POST /api/pay              — создать платёж, вернуть ссылку на оплату
  POST /api/yookassa/webhook — уведомления ЮKassa об оплате
  GET  /success              — страница «спасибо»
  GET  /health               — проверка настройки

Секретный ключ ЮKassa НИКОГДА не попадает во фронтенд — только сюда.
"""
import base64
import os
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()

SHOP_ID = os.getenv("YOOKASSA_SHOP_ID", "").strip()
SECRET_KEY = os.getenv("YOOKASSA_SECRET_KEY", "").strip()
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
RETURN_URL = os.getenv("RETURN_URL", f"{PUBLIC_BASE_URL}/success")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
VAT_CODE = os.getenv("YOOKASSA_VAT_CODE", "1")

# Каталог цен на сервере: клиент не может подменить стоимость.
PRICES = {
    "Лендинг / визитка (1 стр.)": 19900,
    "Сайт-визитка (до 5 стр.)": 29900,
    "Корпоративный сайт (до 10 стр.)": 49900,
    "Интернет-магазин": 89900,
    "Telegram-бот: заявки": 12900,
    "Telegram-бот: каталог + оплата": 24900,
    "Подключение ЮKassa": 4900,
    "ЮKassa + чеки (54-ФЗ)": 9900,
    "Мудборд": 20000,
    "Креативы: пакет 5": 3900,
    "Креативы: пакет 10": 6900,
}

app = FastAPI(title="Digital Hands — payments")

app.add_middleware(
    CORSMiddleware,
    # В .env можно задать ALLOWED_ORIGINS=https://site.ru,https://www.site.ru
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class PayItem(BaseModel):
    name: str
    price: int


class PayRequest(BaseModel):
    items: list[PayItem] = Field(default_factory=list)
    amount: int | None = None  # ориентир для фронтенда; сумма считается на сервере
    email: str | None = None   # для чека 54-ФЗ, необязательно
    description: str = "Оплата digital-услуг"


def _auth_header() -> str:
    token = base64.b64encode(f"{SHOP_ID}:{SECRET_KEY}".encode()).decode()
    return f"Basic {token}"


@app.get("/health")
def health():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return {
        "ok": True,
        "configured": bool(SHOP_ID and SECRET_KEY),
        "cwd": os.getcwd(),
        "base": base,
        "public_exists": os.path.isdir(os.path.join(base, "public")),
        "public_files": os.listdir(os.path.join(base, "public"))[:10] if os.path.isdir(os.path.join(base, "public")) else [],
    }


@app.post("/api/pay")
async def create_payment(req: PayRequest):
    if not (SHOP_ID and SECRET_KEY):
        raise HTTPException(500, "ЮKassa не настроена: заполните .env")

    subtotal = 0
    for item in req.items:
        if item.name not in PRICES or PRICES[item.name] != item.price:
            raise HTTPException(400, f"Неизвестная услуга или цена: {item.name}")
        subtotal += item.price

    if subtotal <= 0 or subtotal > 300_000:
        raise HTTPException(400, "Некорректная сумма")

    # Та же логика, что и в калькуляторе: скидка 5% от 50 000 ₽.
    discount = round(subtotal * 0.05) if subtotal >= 50_000 else 0
    total = subtotal - discount

    payload = {
        "amount": {"value": f"{total}.00", "currency": "RUB"},
        "confirmation": {"type": "redirect", "return_url": RETURN_URL},
        "capture": True,
        "description": req.description[:128],
    }

    # Чек по 54-ФЗ формируем только если клиент указал e-mail.
    if req.email and "@" in req.email:
        payload["receipt"] = {
            "customer": {"email": req.email[:128]},
            "items": [{
                "description": req.description[:128],
                "quantity": "1.00",
                "amount": {"value": f"{total}.00", "currency": "RUB"},
                "vat_code": VAT_CODE,
                "payment_mode": "full_payment",
                "payment_subject": "service",
            }],
        }
    headers = {
        "Authorization": _auth_header(),
        "Idempotence-Key": str(uuid.uuid4()),
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.yookassa.ru/v3/payments", json=payload, headers=headers
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(502, f"ЮKassa: {resp.status_code} {resp.text[:300]}")

    data = resp.json()
    return {
        "id": data["id"],
        "url": data["confirmation"]["confirmation_url"],
        "status": data["status"],
        "subtotal": subtotal,
        "discount": discount,
        "total": total,
    }


@app.post("/api/yookassa/webhook")
async def yookassa_webhook(request: Request):
    """
    ЮKassa не подписывает вебхуки, поэтому телу запроса не доверяем:
    берём id платежа и перепроверяем его через API.
    """
    event = await request.json()
    if event.get("type") != "payment.succeeded":
        return {"ok": True}

    payment_id = (event.get("object") or {}).get("id")
    if not payment_id:
        return {"ok": True}

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"https://api.yookassa.ru/v3/payments/{payment_id}",
            headers={"Authorization": _auth_header()},
        )

    if resp.status_code == 200:
        payment = resp.json()
        if payment.get("status") == "payment.succeeded":
            # TODO: здесь отметить заказ оплаченным —
            # запись в БД, сообщение в Telegram, строка в Google Sheets.
            print("PAID:", payment["id"], payment["amount"]["value"])

    return {"ok": True}


@app.get("/success")
def success():
    return HTMLResponse("""
<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Оплата прошла — Digital Hands</title>
<style>
 body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7fb;color:#101828;
      display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
 .card{background:#fff;border:1px solid #e4e7ec;border-radius:18px;padding:38px;max-width:520px;text-align:center;
       box-shadow:0 10px 30px rgba(16,24,40,.08)}
 .ok{width:56px;height:56px;border-radius:50%;background:#d1fae5;color:#059669;display:grid;place-items:center;
     font-size:28px;margin:0 auto 18px}
 h1{font-size:26px;margin-bottom:10px}p{color:#667085;font-size:15px}
 a{display:inline-block;margin-top:22px;background:#2563eb;color:#fff;padding:12px 20px;border-radius:12px;
   font-weight:700;text-decoration:none}
</style></head><body><div class="card">
 <div class="ok">✓</div><h1>Оплата прошла. Спасибо!</h1>
 <p>Мы получили уведомление о платеже и свяжемся с вами в течение дня, чтобы подтвердить смету и сроки.</p>
 <a href="/">Вернуться на сайт</a>
</div></body></html>
""")


# Раздача статики: Vercel использует public/, VPS/Docker — static/.
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _static_dir in (
    os.path.join(_BASE_DIR, "public"),
    "public",
    os.path.join(_BASE_DIR, "static"),
    "static",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"),
):
    if os.path.isdir(_static_dir):
        app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")
        break
