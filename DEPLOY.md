# Публикация: GitHub → Vercel → домен → ЮKassa

## 0. Что уже готово в репозитории

- `public/index.html` — лендинг Digital Hands (главная на `/`).
- `public/offer.html`, `public/privacy.html` — юридические страницы.
- `app.py` — точка входа FastAPI для Vercel.
- `yookassa_backend/app.py` — тот же бэкенд для VPS/Docker.
- `vercel.json`, `requirements.txt`, `.python-version` — конфиг Vercel.
- `.vercelignore` — портфолио HUSH.CORP и тяжёлые медиа **не** попадают в деплой.

Локальный репозиторий уже инициализирован и закоммичен. Осталось залить на GitHub.

---

## 1. GitHub

1. Зайди на https://github.com/new и создай **публичный** репозиторий, например `digital-hands-site`.
2. Не ставь галочки README / .gitignore / license — они уже есть локально.
3. Выполни в папке проекта:

```powershell
git remote add origin https://github.com/<ТВОЙ_LOGIN>/digital-hands-site.git
git branch -M main
git push -u origin main
```

Если GitHub попросит авторизацию — используй Personal Access Token вместо пароля
(или установи GitHub CLI: `winget install --id GitHub.GitHubCLI`, затем `gh auth login`).

---

## 2. Vercel

1. https://vercel.com → **Log in with GitHub**.
2. **Add New → Project** → импортируй `digital-hands-site`.
3. Framework Preset определится как **FastAPI** (если нет — выбери Other; конфиг всё равно подхватится).
4. Root Directory — `.` (корень). Build Command и Output Directory не трогай.
5. Перед деплоем добавь Environment Variables (см. шаг 4), либо добавь их после в **Settings → Environment Variables** и сделай Redeploy.
6. **Deploy**.

Проверки после деплоя:

- `/` — лендинг;
- `/offer.html`, `/privacy.html` — юр-страницы;
- `/health` → `{"ok":true,"configured":true}` (после внесения ключей);
- `/api/pay` — только POST, вызвать кнопкой в калькуляторе.

---

## 3. Домен `.ru` (выбранный вариант)

Vercel не продаёт зону `.ru`, поэтому покупаем её на reg.ru (~199–290 ₽/год),
а затем привязываем к проекту Vercel.

1. На https://www.reg.ru/domain/new/ вбей выбранное имя (например, `digital-hands.ru`)
   и оформи регистрацию.
2. В Vercel: проект → **Settings → Domains** → **Add** → ввести тот же домен → **Add Domain**.
3. Vercel покажет нужные DNS-записи. Для зоны `.ru` обычно такие:

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns-0.com` |

4. В личном кабинете reg.ru → **Домены → Управление DNS** добавь эти записи
   (если ATT заменяет DNS-серверы — удали старые A/AAAA/CNAME для `@` и `www`).
5. Дождись распространения DNS (обычно 5–30 минут) — Vercel покажет
   **Valid Configuration** и выпустит бесплатный SSL.

Если выбранный домен занят, попробуй `digitalhands.ru`, `dhands.ru`,
`digital-hands-site.ru` или придумай свой.

---

## 4. Переменные окружения в Vercel

**Settings → Environment Variables**, добавить для Production (и Preview при желании):

```env
YOOKASSA_SHOP_ID=000000
YOOKASSA_SECRET_KEY=test_xxxxxxxxxxxxxxxxxxxxxxxx
PUBLIC_BASE_URL=https://твой-домен.com
RETURN_URL=https://твой-домен.com/success
ALLOWED_ORIGINS=https://твой-домен.com,https://www.твой-домен.com
YOOKASSA_VAT_CODE=1
```

Без этих переменных кнопка «Оплатить онлайн» будет выдавать
`Оплата временно недоступна` — это нормально до подключения ЮKassa.

---

## 5. ЮKassa

1. Создать магазин: https://yookassa.ru/my → Настройки → Магазин.
2. Взять `shopId` и `secret key` (сначала **тестовый**).
3. Вписать их в Environment Variables на Vercel (шаг 4), сделать Redeploy.
4. Проверить `https://твой-домен.com/health` → `configured: true`.
5. В ЮKassa: **Интеграция → HTTP-уведомления** → указать
   `https://твой-домен.com/api/yookassa/webhook`, событие `payment.succeeded`.
6. Пройти калькулятор на сайте, нажать «Оплатить онлайн», оплатить тестовой картой.
7. В логах Vercel (Functions → Runtime Logs) должна появиться строка `PAID: <id> <сумма>`.

Для реальных платежей ЮKassa запросит опубликованный сайт, реквизиты (ИП/самозанятый),
оферту и политику конфиденциальности. Обе страницы уже есть — но в них есть пометки
**ЗАПОЛНИТЬ**: впиши свои реквизиты и контакты перед отправкой на модерацию.

---

## 6. После любых правок HTML

```powershell
powershell -ExecutionPolicy Bypass -File .\yookassa_backend\sync-static.ps1
git add .
git commit -m "Update landing"
git push
```

Vercel сам передеплоит проект после `git push`.
