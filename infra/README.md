# Деплой MindLeaf

Прототип живе на двох сервісах:

| Що | Де | Навіщо |
| --- | --- | --- |
| Backend (FastAPI), PostgreSQL 16, frontend (статичний сайт) | [Render](https://render.com), безкоштовний план, регіон Frankfurt | Бере код прямо з GitHub, дає HTTPS-адреси, сам перезбирає після кожного push у `main` |
| Реєстрація і вхід | [Amazon Cognito](https://aws.amazon.com/cognito/) user pool | Email + пароль з підтвердженням коду; безкоштовно до 50 000 користувачів на місяць |

Уся конфігурація Render — у [`render.yaml`](render.yaml). Після деплою:

- сайт: `https://mindleaf-web.onrender.com`
- API: `https://mindleaf-api.onrender.com` (перевірка: `/api/health` → `{"status":"ok"}`)

Якщо ім'я сервісу на Render уже зайняте, Render додасть до адреси суфікс. Тоді впишіть справжні адреси в змінні з кроку 3 і в Cognito.

## Перше розгортання

Порядок важливий: Cognito треба знати адресу сайту, а сайту — ідентифікатори Cognito.

### Крок 1. Render: база, backend і frontend

1. Увійдіть на render.com через **Sign in with GitHub**.
2. **New → Blueprint**, оберіть репозиторій `mindleaf`.
3. **Blueprint Path:** `infra/render.yaml` → **Apply**.
4. Render попросить значення для змінних без значення (`COGNITO_*`, `VITE_COGNITO_*`). Поки що впишіть у кожну `todo` — справжні з'являться на кроці 3.
5. Зачекайте, поки всі три ресурси стануть **Live** (перша збірка — 5–10 хвилин).

Сайт уже відкривається, але вхід ще не працює.

### Крок 2. Cognito: пул користувачів

У [консолі AWS](https://console.aws.amazon.com/cognito/) (регіон угорі праворуч — **Europe (Frankfurt) eu-central-1**):

1. **Create user pool**.
2. Тип застосунку — **Single-page application (SPA)**, назва — `mindleaf-web`.
3. **Options for sign-in identifiers:** Email. **Self-registration:** увімкнено. **Required attributes:** email.
4. **Return URL:** `https://mindleaf-web.onrender.com/` → **Create user directory**.
5. Відкрийте створений пул → **App clients** → `mindleaf-web` → **Login pages** → **Edit**:
   - **Allowed callback URLs:** `https://mindleaf-web.onrender.com/` і `http://localhost:5173/`
   - **Allowed sign-out URLs:** ті самі дві адреси
   - **OAuth grant types:** Authorization code grant
   - **OpenID Connect scopes:** `openid`, `email`, `profile`
   - **Save changes**
6. Випишіть три значення:
   - **User pool ID** (на сторінці пулу, вигляду `eu-central-1_AbCdEf123`);
   - **Client ID** (App clients → `mindleaf-web`);
   - **Domain** (Branding → Domain, вигляду `https://eu-central-1abcdef.auth.eu-central-1.amazoncognito.com`).

### Крок 3. Ідентифікатори Cognito в Render

На render.com → **mindleaf-api → Environment**:

| Змінна | Значення |
| --- | --- |
| `COGNITO_AUTHORITY` | `https://cognito-idp.eu-central-1.amazonaws.com/<User pool ID>` |
| `COGNITO_CLIENT_ID` | `<Client ID>` |

**mindleaf-web → Environment**:

| Змінна | Значення |
| --- | --- |
| `VITE_COGNITO_AUTHORITY` | те саме, що `COGNITO_AUTHORITY` |
| `VITE_COGNITO_CLIENT_ID` | `<Client ID>` |
| `VITE_COGNITO_DOMAIN` | `<Domain>` (з `https://`, без `/` у кінці) |

Збережіть: **Save, rebuild, and deploy**. Ці значення — публічні ідентифікатори, а не секрети: вони все одно потрапляють у JS-бандл фронтенду.

### Крок 4. Перевірка

1. `https://mindleaf-api.onrender.com/api/health` → `{"status":"ok"}`.
2. `https://mindleaf-web.onrender.com` → **Увійти / Зареєструватися** → **Sign up** → код з пошти → вибір ролі «Репетитор».
3. У кабінеті репетитора додайте учня й видайте код у картці учня. В іншому браузері (або інкогніто) зареєструйтеся ще раз і введіть цей код — відкриється кабінет учня чи батьків.

## Нагадування в Telegram

Бот пише кожному, хто натиснув у MindLeaf «Підключити Telegram»: за годину до заняття (з посиланням на Zoom/Meet) і за добу до дедлайну ДЗ чи тесту. Розсилку раз на 10 хвилин запускає [`.github/workflows/reminders.yml`](../.github/workflows/reminders.yml); що вже надіслано, backend пам'ятає (таблиця `reminders_sent`), тож повторний запуск нічого не дублює.

1. **Бот.** У Telegram відкрийте [@BotFather](https://t.me/BotFather) → `/newbot` → назва `MindLeaf` → ім'я, що закінчується на `bot` (наприклад, `mindleaf_tutor_bot`). BotFather дасть **токен** вигляду `123456789:AA…` — це секрет.
2. **Render → mindleaf-api → Environment:**

   | Змінна | Значення |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | токен від BotFather |
   | `TELEGRAM_BOT_USERNAME` | ім'я бота без `@` |
   | `TELEGRAM_WEBHOOK_SECRET` | будь-який довгий випадковий рядок (Blueprint генерує сам) |
   | `CRON_TOKEN` | будь-який довгий випадковий рядок (Blueprint генерує сам) |

   **Save, rebuild, and deploy.**
3. **Підключити бота до сервера** (один раз, після деплою): Telegram має знати, куди пересилати повідомлення бота.

   ```sh
   curl -X POST -H "X-Cron-Token: <CRON_TOKEN>" https://mindleaf-api.onrender.com/api/internal/telegram/webhook
   ```

   Відповідь `{"ok":true,…}` — готово.
4. **GitHub → репозиторій → Settings → Secrets and variables → Actions → New repository secret:** `API_URL` = `https://mindleaf-api.onrender.com`, `CRON_TOKEN` = те саме значення, що на Render. Перевірити: **Actions → reminders → Run workflow**.

Без `TELEGRAM_BOT_TOKEN` кнопки підключення в інтерфейсі просто немає, а `/api/internal/*` відповідає 404.

## Промокоди та режим оплати

| Змінна | Де задавати | Опис |
| --- | --- | --- |
| `PROMO_CODES` | Render → mindleaf-api → Environment | Формат: `КОД:ДНІВ:МАКС_ВИКОРИСТАНЬ`, розділені комою. Наприклад: `LAUNCH:30:50,BETA:14:10`. Порожнє значення — промокодів немає. Регістр не має значення. |
| `BILLING_MODE` | Render → mindleaf-api → Environment | Значення `disabled` вимикає кнопку «Оформити Pro» (корисно до підключення LiqPay). Промокоди при цьому продовжують працювати. Blueprint задає `disabled` за замовчуванням. |

Щоб додати `PROMO_CODES` на Render: **mindleaf-api → Environment → Edit** → знайти рядок `PROMO_CODES` → вписати значення → **Save changes**.

## Оновлення

Кожен `git push` у `main` перезбирає обидва сервіси. Backend при старті сам накочує нові міграції Alembic.

## Обмеження безкоштовного плану

- **Засинання.** Backend засинає після 15 хвилин без запитів; перший запит після цього чекає до хвилини. Перед показом відкрийте `/api/health`.
- **База.** Безкоштовна PostgreSQL на Render живе 30 днів, потім її треба перестворити або перейти на платний план.
- **Фото ДЗ** лежать на диску контейнера і зникають після перезапуску. Для постійного зберігання — S3 (`STORAGE_BACKEND=s3`, див. `PROJECT.md`) або платний диск Render.
- **ШІ-оцінювач** вимкнено (`AI_GRADER=off`): письмові відповіді в тестах оцінює репетитор.
- **Оплата тарифу** без ключів LiqPay працює в демо-режимі, гроші не списуються. Справжні ключі: `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_SANDBOX` у змінних `mindleaf-api`.

Цільова продакшн-схема (Lambda, Aurora Serverless, S3, CloudFront, Terraform) описана в [`PROJECT.md`](../PROJECT.md#infra); цей Render-деплой — її простіша заміна для прототипу.
