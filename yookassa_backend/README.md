# Подключение ЮKassa к лендингу Digital Hands

Мини-бэкенд на FastAPI: создаёт платёж через API ЮKassa и принимает уведомления об оплате.
Секретный ключ хранится только на сервере и никогда не попадает в HTML.

## Что нужно от тебя

1. Создать магазин в личном кабинете ЮKassa: https://yookassa.ru/my
2. В разделе **Настройки → Магазин** взять:
   - `shopId` (номер магазина);
   - `secret key` — тестовый для проверки, live — для реальных платежей.
3. Вписать их в `.env` (скопируй `.env.example` → `.env`).
4. При публикации указать `PUBLIC_BASE_URL`, `RETURN_URL` и `ALLOWED_ORIGINS` со своим доменом.

> Для реальных платежей ЮKassa попросит указать сайт, ИП/самозанятость и пройти модерацию.
> Пока модерация не пройдена — используй тестовый магазин и тестовые ключи.

## Переменные `.env`

```env
YOOKASSA_SHOP_ID=000000
YOOKASSA_SECRET_KEY=test_xxxxxxxxxxxxxxxxxxxxxxxx
PUBLIC_BASE_URL=https://your-domain.ru
RETURN_URL=https://your-domain.ru/success
ALLOWED_ORIGINS=https://your-domain.ru,https://www.your-domain.ru
YOOKASSA_VAT_CODE=1
```

`YOOKASSA_VAT_CODE`: `1` = без НДС. Для своей налоговой формы уточни код в поддержке ЮKassa.

## Запуск локально

```powershell
cd yookassa_backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env        # и вписать свои ключи
uvicorn app:app --reload --port 8000
```

Проверка: http://localhost:8000/health → `{"ok":true,"configured":true}`.

## Статика и синхронизация HTML

Бэкенд раздаёт страницы из папки `static/`. После каждого изменения HTML в корне проекта запускай:

```powershell
powershell -ExecutionPolicy Bypass -File .\sync-static.ps1
```

Скрипт копирует `uslugi-digital.html`, `offer.html`, `privacy.html` в `static/`
и в `public/`, а также создаёт `index.html` в обеих папках (главная страница на `/`).
Для Vercel используется `public/`, для VPS/Docker — `static/`.

Открытие файла напрямую (`file://`) работает, но кнопка «Оплатить онлайн» скрыта —
она появляется только при открытии через сервер (`http(s)://`).

## Как считается сумма

- Цены берутся из `$PRICES` в `app.py`; клиент не может подменить стоимость.
- Скидка 5% применяется и в калькуляторе, и на сервере при сумме от 50 000 ₽.
- Поле `amount` из браузера игнорируется — сервер пересчитывает итог сам.
- Если клиент указал e-mail в калькуляторе, в платёж добавляется чек 54-ФЗ.

## Публикация на VPS

### Вариант 1 — Docker (проще всего)

```bash
# на сервере
scp -r yookassa_backend user@server:/opt/
cd /opt/yookassa_backend
cp .env.example .env && nano .env   # вписать ключи и домен
docker build -t digitalhands .
docker run -d --name digitalhands --env-file .env -p 8000:8000 --restart unless-stopped digitalhands
```

### Вариант 2 — без Docker

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

Дальше — Nginx/Caddy как reverse-proxy с HTTPS на домен.

## Вебхук

В личном кабинете ЮKassa: **Интеграция → HTTP-уведомления** → URL:

```
https://your-domain.ru/api/yookassa/webhook
```

Событие: `payment.succeeded`. Бэкенд не доверяет телу вебхука и перепроверяет платёж через API.
Сейчас факт оплаты только пишется в логи (`PAID: <id> <сумма>`). Чтобы получать заявки,
добавь в `yookassa_webhook` отправку в Telegram или запись в таблицу.

## Тестовая оплата

1. Открой сайт через `http://localhost:8000` (или свой домен).
2. Собери смету, нажми «Оплатить онлайн».
3. Используй тестовую карту из личного кабинета ЮKassa.
4. Проверь редирект на `/success` и строку `PAID: ...` в логах сервера.

## Юридические страницы

`offer.html` и `privacy.html` уже созданы, но содержат явные пометки **ЗАПОЛНИТЬ**.
Перед публикацией впиши реквизиты (статус, ИНН, e-mail, Telegram) и при необходимости
сверь тексты со специалистом. Без этого модерацию ЮKassa пройти не получится.
