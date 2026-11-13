# tutor-cabinet — структура репозиторію і контракти

`tutor-cabinet` — монорепозиторій кабінету для репетитора, який працює сам на себе. Репетитор реєструється, веде список учнів, планує заняття, відмічає проведені й записує оплати; система рахує, хто скільки винен. Учні й батьки входу не мають.

Цей документ фіксує **структуру репозиторію і контракти між частинами**: що лежить у кожній папці, які дані ходять між фронтендом, бекендом, базою й AWS. Коду реалізації тут немає. Якщо реалізація розходиться з цим документом, правиться або реалізація, або документ разом з ADR — але не мовчки.

Підходи до структури backend, `lambda_handler`, Cognito, Terraform, Makefile і CI взято з репозиторію лаб Peach (`../lab2/Peach`). Функціональність Spry (зустрічі, звіти, LLM-парсер) сюди не переноситься.

## Незмінні умови продукту

| Що | Значення |
| --- | --- |
| Мова інтерфейсу | українська |
| Валюта | гривня; **усі суми — цілі числа в копійках** (`int`), у JSON і в БД. Гривні з копійками показує тільки фронтенд. |
| Часовий пояс | `Europe/Kyiv`. «Сьогодні», «поточний місяць» і межі днів рахуються в ньому. У БД час зберігається як `timestamptz`. |
| Користувачі | тільки репетитори; кожен бачить лише свої дані. |

## Чого в репозиторії немає і не буде

Redis, черг, nginx, ALB, ECS/Fargate, Kubernetes, окремого сервісу авторизації, NAT Gateway, VPC endpoints, Secrets Manager. Локально — тільки PostgreSQL і backend. У хмарі — S3 + CloudFront, одна Lambda, Aurora, Cognito, ECR і IAM-роль для CI.

## Дерево репозиторію

```text
tutor-cabinet/
├── .github/
│   └── workflows/
│       └── backend.yml            # ci.yml і deploy.yml додаються разом з frontend/ та infra/
├── .gitignore
├── Makefile
├── PROJECT.md
├── README.md
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── Dockerfile.lambda
│   ├── .dockerignore
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── migrations/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 0001_initial.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── settings.py
│   │   ├── db.py
│   │   ├── lambda_handler.py
│   │   ├── seed.py
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── jwks.py
│   │   │   └── dependencies.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── health.py
│   │   │   ├── me.py
│   │   │   ├── students.py
│   │   │   ├── lessons.py
│   │   │   ├── payments.py
│   │   │   └── dashboard.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── tutor.py
│   │   │   ├── student.py
│   │   │   ├── lesson.py
│   │   │   └── payment.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── common.py
│   │   │   ├── tutor.py
│   │   │   ├── student.py
│   │   │   ├── lesson.py
│   │   │   ├── payment.py
│   │   │   └── dashboard.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── tutors.py
│   │       ├── students.py
│   │       ├── lessons.py
│   │       ├── payments.py
│   │       ├── balances.py
│   │       ├── dashboard.py
│   │       └── clock.py
│   └── tests/
│       ├── conftest.py
│       ├── test_health.py
│       ├── test_auth.py
│       ├── test_students.py
│       ├── test_lessons.py
│       ├── test_payments.py
│       ├── test_balances.py
│       ├── test_dashboard.py
│       ├── test_isolation.py
│       └── test_lambda_handler.py
├── frontend/                      # поки тільки опис, див. розділ frontend/
├── infra/
│   ├── .terraform.lock.hcl
│   ├── versions.tf
│   ├── variables.tf
│   ├── network.tf
│   ├── database.tf
│   ├── api.tf
│   ├── site.tf
│   ├── auth.tf
│   ├── ci.tf
│   └── outputs.tf
└── docs/
    └── adr/
        ├── 0001-monorepo-layout.md
        ├── 0002-backend-on-lambda-function-url.md
        ├── 0003-aurora-serverless-v2-scale-to-zero.md
        ├── 0004-cognito-jwks-in-env.md
        ├── 0005-money-in-kopecks-computed-balance.md
        └── 0006-time-zone-europe-kyiv.md
```

## Кореневі файли

| Шлях | Навіщо |
| --- | --- |
| `.github/workflows/` | CI (лінт і тести на кожен push і PR) та деплой на push у `main`. Див. «CI і деплой». |
| `.gitignore` | `node_modules/`, `dist/`, `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `infra/.terraform/`, локальні `.env*`. `infra/.terraform.lock.hcl` **комітиться**. |
| `Makefile` | Контракт деплою й локальних перевірок. CI викликає ті самі цілі. Див. «Makefile». |
| `PROJECT.md` | Цей документ. |
| `README.md` | Що це за продукт, як запустити локально, як задеплоїти. Див. «README.md». |
| `docker-compose.yml` | Увесь локальний runtime: `postgres` і `backend`. `docker compose up` — єдина команда локального запуску. |

## `backend/`

Навіщо: HTTP API кабінету і вся бізнес-логіка (баланси, дашборд, ізоляція даних). Один і той самий FastAPI-застосунок працює локально під Uvicorn і в AWS як Lambda через Mangum.

### Версії

| Що | Версія |
| --- | --- |
| Python | 3.12 (`requires-python = "==3.12.*"`) |
| Локальний образ | `python:3.12-slim` |
| Lambda-образ | `public.ecr.aws/lambda/python:3.12` |
| fastapi | 0.111.0 |
| pydantic | 2.8.2 |
| SQLAlchemy | 2.0.31 |
| alembic | 1.13.2 |
| psycopg[binary] | 3.1.19 |
| uvicorn | 0.30.1 |
| mangum | 0.17.0 |
| PyJWT[crypto] | 2.10.1 |
| tzdata | 2024.1 (щоб `zoneinfo("Europe/Kyiv")` працював і в slim-, і в Lambda-образі) |
| setuptools (build backend) | 70.1.1 |
| **dev:** pytest | 8.3.3 |
| **dev:** httpx | 0.27.0 (для `fastapi.testclient`) |
| **dev:** ruff | 0.6.9 |

Ruff: `target-version = "py312"`, `line-length = 88`, `select = ["E", "F", "I", "B", "UP"]`; форматування — `ruff format`.

### Файли

| Шлях | Навіщо |
| --- | --- |
| `Dockerfile` | Локальний образ на `python:3.12-slim`. Ставить пакет з dev-залежностями (`.[dev]`), щоб `pytest` і `ruff` працювали в контейнері. `CMD`: `alembic upgrade head`, потім `uvicorn app.main:app --host 0.0.0.0 --port 8000`. |
| `Dockerfile.lambda` | Образ для Lambda на `public.ecr.aws/lambda/python:3.12`. Ставить пакет **без** dev-залежностей, копіює `app/`, `alembic.ini`, `migrations/`. `CMD ["app.lambda_handler.handler"]`. Платформа `linux/amd64`. |
| `pyproject.toml` | Точні версії залежностей, налаштування ruff і pytest (`testpaths = ["tests"]`). |
| `alembic.ini` | `script_location = migrations`; URL бази не тут, а з `DATABASE_URL` у `migrations/env.py`. |
| `migrations/` | Alembic. Схема БД змінюється **тільки** міграціями. `0001_initial.py` створює чотири таблиці з розділу «Модель даних». |
| `app/main.py` | Створює `FastAPI`, підключає роутери з `app/api` під префіксом `/api`, `CORSMiddleware` з `CORS_ORIGINS`. Більше нічого. |
| `app/settings.py` | Читає змінні середовища (таблиця нижче) в один незмінний об'єкт `settings`. Не імпортує `app.db`. |
| `app/db.py` | `Base` (DeclarativeBase), engine з `DATABASE_URL` (`pool_pre_ping=True`; у Lambda — пул на одне з'єднання), `get_session` як FastAPI-залежність. |
| `app/lambda_handler.py` | Вхід Lambda. Подія `{"action": "migrate"}` → `alembic upgrade head` і відповідь `{"migrated": true, "revision": "<head>"}`. Будь-яке інше значення `action` → виняток (Lambda повертає `FunctionError`). Подія без `action` → `Mangum(app, lifespan="off")`. |
| `app/seed.py` | `python -m app.seed [--tutor-sub <sub>]`, default `local-dev`: створює репетитора з цим `sub` (якщо нема), 3 учнів, заняття на поточний тиждень, кілька оплат і щонайменше одного боржника. Повторний запуск видаляє дані **лише цього** репетитора і створює їх заново. Тільки для локальної бази. |
| `app/auth/` | Перевірка Cognito access token. Не імпортує `app.db`. |
| `app/auth/jwks.py` | Джерело ключів: якщо задано `COGNITO_JWKS` — парсить його один раз при старті (невалідний JSON → застосунок не стартує); інакше завантажує `{COGNITO_AUTHORITY}/.well-known/jwks.json` і кешує в процесі. |
| `app/auth/dependencies.py` | `require_claims` (токен → `Claims(sub, ...)` або 401) і `get_current_tutor` (claims + сесія → рядок `tutors`, створює його при першому запиті). Усі роутери, крім `health`, залежать від `get_current_tutor`; тести підміняють її через `app.dependency_overrides`, щоб працювати від імені двох різних репетиторів. |
| `app/api/` | Тонкі роутери: розбір запиту, виклик сервісу, серіалізація. Без SQL і без бізнес-правил. Один файл на ресурс. |
| `app/models/` | ORM-моделі SQLAlchemy 2.x (`Mapped[...]`), один файл на таблицю. |
| `app/schemas/` | Pydantic v2: тіла запитів і відповідей. Усі моделі запитів мають `extra="forbid"`. `common.py` — спільні типи: `Money` (int, копійки), `AwareDatetime`, `ErrorResponse`. |
| `app/services/` | Бізнес-логіка. Кожна функція приймає `tutor_id` першим аргументом і фільтрує за ним — це єдине місце, де забезпечується ізоляція даних. |
| `app/services/balances.py` | Єдина формула балансу (див. «Модель даних»), яку використовують і `students`, і `dashboard`. |
| `app/services/clock.py` | «Зараз», «сьогодні» і «поточний місяць» у `Europe/Kyiv`; підмінюється в тестах. |
| `tests/` | pytest проти справжнього PostgreSQL з `TEST_DATABASE_URL`. `conftest.py` створює тестову базу, якщо її нема, проганяє `alembic upgrade head` і загортає кожен тест у транзакцію з відкатом. Токени підписуються тестовим RSA-ключем, переданим через `COGNITO_JWKS`. |

### Змінні середовища backend

| Змінна | Обов'язкова | Локально (compose) | У Lambda (Terraform / деплой) |
| --- | --- | --- | --- |
| `DATABASE_URL` | так | `postgresql+psycopg://tutor:tutor@postgres:5432/tutor_cabinet` | Збирається в `api.tf` з endpoint Aurora і `db_password`. |
| `COGNITO_AUTHORITY` | так | `https://cognito-idp.us-east-1.amazonaws.com/<pool_id>` | Те саме, з `auth.tf`. |
| `COGNITO_CLIENT_ID` | так | ID web-клієнта пулу | Те саме, з `auth.tf`. |
| `COGNITO_JWKS` | ні | не задано → ключі завантажуються за URL | JSON-документ JWKS (`{"keys":[...]}`) рядком; записує `make deploy-backend`. |
| `CORS_ORIGINS` | ні | `http://localhost:5173` | `https://<домен CloudFront>` — і тільки він. |
| `TEST_DATABASE_URL` | тільки для тестів | `postgresql+psycopg://tutor:tutor@postgres:5432/tutor_cabinet_test` | — |

Значення Cognito в `docker-compose.yml` — публічні ідентифікатори (вони й так є у фронтенд-бандлі), не секрети. Локальний backend перевіряє токени того самого dev-пулу, що й хмара.

## Автентифікація

**Провайдер:** Amazon Cognito user pool з managed login (версія 2). Способи входу: email + пароль і «Continue with Google». Self sign-up увімкнено; email — ім'я користувача, підтверджується кодом.

**Фронтенд** — публічний клієнт без секрету. OIDC authorization code flow з PKCE через `react-oidc-context`. Scopes: `openid email profile`. Callback і logout URL: `https://<домен CloudFront>/` і `http://localhost:5173/`. До кожного запиту в `/api/*`, крім `/api/health`, додає `Authorization: Bearer <access_token>`. ID token на бекенд не надсилається.

**Бекенд** приймає тільки access token і перевіряє:

1. заголовок має вигляд `Bearer <token>`;
2. підпис RS256 ключем з JWKS пулу (за `kid`);
3. `exp` не минув;
4. `iss` == `COGNITO_AUTHORITY`;
5. `token_use` == `access`;
6. `client_id` == `COGNITO_CLIENT_ID` (у access token Cognito немає `aud`, тому перевіряється `client_id`).

Будь-яка невдача → `401 {"detail": "invalid or missing token"}` із заголовком `WWW-Authenticate: Bearer`. Невідомий `kid`: локально — одне перезавантаження JWKS, потім 401; у Lambda — одразу 401 (ключі тільки з `COGNITO_JWKS`).

**Чому JWKS у змінній середовища:** Lambda стоїть у VPC без NAT і не має виходу в інтернет, тож не може завантажити `jwks.json`. Деплой (`make deploy-backend`) завантажує JWKS на машині, де він запущений, і записує в `COGNITO_JWKS`. Якщо Cognito змінить ключі, достатньо повторити `make deploy-backend`. Деталі — ADR 0004.

**Репетитор** ідентифікується за claim `sub`. При першому автентифікованому запиті до будь-якого ендпоінта створюється рядок `tutors` (`INSERT ... ON CONFLICT (cognito_sub) DO NOTHING`, потім вибірка — безпечно при паралельних запитах).

## Модель даних

PostgreSQL 16 (локально) / Aurora PostgreSQL 16 (у хмарі). Усі `id` — UUID v4, генеруються бекендом. Усі `created_at` — `timestamptz not null default now()`. Усі суми — `integer` у копійках.

### `tutors`

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `cognito_sub` | text | not null, **unique** |
| `email` | text | null |
| `name` | text | null |
| `created_at` | timestamptz | not null |

### `students`

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id` | uuid | not null, FK → `tutors.id` |
| `full_name` | text | not null, 1–200 символів |
| `phone` | text | null, ≤ 32 |
| `telegram` | text | null, ≤ 64 |
| `parent_name` | text | null, ≤ 200 |
| `parent_phone` | text | null, ≤ 32 |
| `subject` | text | null, ≤ 100 |
| `default_price` | integer | not null, `>= 0` |
| `notes` | text | null, ≤ 2000 |
| `archived` | boolean | not null, default `false` |
| `created_at` | timestamptz | not null |

Індекси: `(tutor_id, archived)`. Додатково `unique (id, tutor_id)` — ціль для складених FK нижче.

### `lessons`

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id` | uuid | not null, FK → `tutors.id` |
| `student_id` | uuid | not null |
| `starts_at` | timestamptz | not null |
| `duration_minutes` | integer | not null, `1..720` |
| `price` | integer | not null, `>= 0` |
| `status` | text | not null, `CHECK (status IN ('planned','done','cancelled','missed'))`, default `planned` |
| `topic` | text | null, ≤ 200 |
| `homework` | text | null, ≤ 2000 |
| `notes` | text | null, ≤ 2000 |
| `created_at` | timestamptz | not null |

FK `(student_id, tutor_id)` → `students (id, tutor_id)`: заняття фізично не може належати учневі іншого репетитора. Індекси: `(tutor_id, starts_at)`, `(student_id)`.

### `payments`

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id` | uuid | not null, FK → `tutors.id` |
| `student_id` | uuid | not null |
| `amount` | integer | not null, `> 0` |
| `paid_at` | timestamptz | not null |
| `method` | text | not null, `CHECK (method IN ('cash','card','transfer'))` |
| `comment` | text | null, ≤ 500 |
| `created_at` | timestamptz | not null |

FK `(student_id, tutor_id)` → `students (id, tutor_id)`. Індекси: `(tutor_id, paid_at)`, `(student_id)`.

### Баланс

```
balance(student) = Σ payments.amount  −  Σ lessons.price where lessons.status = 'done'
```

- Рахується завжди за весь час, на льоту, у `services/balances.py` одним SQL-запитом. Окремої колонки балансу немає.
- `balance < 0` — учень винен `−balance` копійок; `balance > 0` — передоплата; `0` — розрахунок.
- `planned`, `cancelled`, `missed` на баланс не впливають. Хочеш брати гроші за пропуск — став `done`.
- `price` заняття копіюється з `default_price` учня в момент створення; зміна `default_price` пізніше не змінює вже створені заняття.
- Архівація не обнуляє баланс: борг архівного учня лишається боргом.

## Backend API

Загальні правила для всіх ендпоінтів:

- Усе під `/api`, тіла й відповіді — JSON (`Content-Type: application/json`).
- Дати-час — ISO 8601 **з offset**. У запитах час без offset → `422`. У відповідях час віддається в `Europe/Kyiv`, наприклад `"2026-11-13T16:00:00+02:00"`.
- Гроші — `integer`, копійки.
- Невідомі поля в тілі запиту → `422` (`extra="forbid"`).
- Пагінації немає: обсяги одного репетитора малі. Списки повертаються цілком.
- Усі ендпоінти, крім `GET /api/health`, вимагають валідний токен (інакше `401`) і працюють тільки з даними поточного репетитора.

### Формат помилок

| Код | Коли | Тіло |
| --- | --- | --- |
| `401` | Немає токена або він невалідний | `{"detail": "invalid or missing token"}` |
| `404` | Запису з таким `id` немає **або він чужий** (відповідь однакова) | `{"detail": "not found"}` |
| `409` | Порушення бізнес-правила | `{"detail": "<code>"}`, коди нижче |
| `422` | Невалідне тіло, query або шлях (у т.ч. не-UUID у `{id}`); посилання на неіснуючого/чужого учня в тілі | Стандартний формат FastAPI: `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`; для учня — `{"detail": "student_not_found"}` |

Коди `409`: `student_archived` — спроба створити заняття для архівного учня.

### Ізоляція даних

- Кожен запит до БД фільтрується за `tutor_id` поточного репетитора — у `services/`, не в роутерах.
- Чужий запис за `{id}` → `404`, так само як неіснуючий.
- `student_id` у тілі `POST /api/lessons` і `POST /api/payments` має належати поточному репетитору; інакше `422 {"detail": "student_not_found"}`. Додатковий захист — складені FK у БД.
- `tutor_id` ніколи не приймається від клієнта і ніколи не повертається.

---

### `GET /api/health`

Без автентифікації. **Не торкається БД** (щоб health check не будив Aurora).

- Відповідь `200`: `{"status": "ok"}`

### `GET /api/me`

Поточний репетитор; створюється при першому виклику (як і при першому виклику будь-якого іншого захищеного ендпоінта).

- Відповідь `200` — `Tutor`:

| Поле | Тип | Примітка |
| --- | --- | --- |
| `id` | string (uuid) | |
| `email` | string \| null | з claim `email`, якщо він є в токені |
| `name` | string \| null | з claim `name`, якщо він є в токені |
| `created_at` | string (datetime) | |

- Помилки: `401`.

### Учні

**`Student`** (відповідь):

| Поле | Тип |
| --- | --- |
| `id` | string (uuid) |
| `full_name` | string |
| `phone` | string \| null |
| `telegram` | string \| null |
| `parent_name` | string \| null |
| `parent_phone` | string \| null |
| `subject` | string \| null |
| `default_price` | integer (копійки) |
| `notes` | string \| null |
| `archived` | boolean |
| `created_at` | string (datetime) |
| `balance` | integer (копійки; від'ємний = борг) |

**`StudentCreate`** (тіло POST): `full_name` string 1–200 **обов'язкове**; `default_price` integer `0..100000000` **обов'язкове**; `phone`, `telegram`, `parent_name`, `parent_phone`, `subject`, `notes` — string \| null, необов'язкові, з обмеженнями довжини з таблиці `students`. Рядки обрізаються від пробілів; порожній рядок зберігається як `null`.

**`StudentUpdate`** (тіло PATCH): ті самі поля плюс `archived` boolean, усі необов'язкові. Оновлюються тільки передані поля. `full_name`, `default_price`, `archived` не можуть бути `null` → `422`.

| Метод і шлях | Запит | Відповідь | Помилки |
| --- | --- | --- | --- |
| `GET /api/students` | query `archived`: boolean, default `false` | `200` `Student[]`, сортування за `full_name` | `401`, `422` |
| `POST /api/students` | `StudentCreate` | `201` `Student` (`balance` = 0) | `401`, `422` |
| `GET /api/students/{id}` | — | `200` `Student` (архівні теж віддаються) | `401`, `404`, `422` |
| `PATCH /api/students/{id}` | `StudentUpdate` | `200` `Student` | `401`, `404`, `422` |
| `DELETE /api/students/{id}` | — | `204` без тіла. Це **архівація** (`archived = true`), не видалення; повторний виклик теж `204`. Розархівувати — `PATCH {"archived": false}`. | `401`, `404`, `422` |

### Заняття

**`Lesson`** (відповідь):

| Поле | Тип |
| --- | --- |
| `id` | string (uuid) |
| `student_id` | string (uuid) |
| `student_full_name` | string |
| `starts_at` | string (datetime) |
| `duration_minutes` | integer |
| `price` | integer (копійки) |
| `status` | `"planned"` \| `"done"` \| `"cancelled"` \| `"missed"` |
| `topic` | string \| null |
| `homework` | string \| null |
| `notes` | string \| null |
| `created_at` | string (datetime) |

**`LessonCreate`**: `student_id` uuid **обов'язкове**; `starts_at` datetime з offset **обов'язкове**; `duration_minutes` integer `1..720`, default `60`; `price` integer `0..100000000`, default — `default_price` учня; `status`, default `planned` (дозволяє внести вже проведене заняття заднім числом); `topic`, `homework`, `notes` — string \| null.

**`LessonUpdate`**: `starts_at`, `duration_minutes`, `price`, `topic`, `homework`, `notes` — усі необов'язкові. `student_id` і `status` тут **не приймаються** (`422`): учня в занятті не змінюють, статус змінюється окремим ендпоінтом.

**`LessonStatusUpdate`**: `{"status": "planned" | "done" | "cancelled" | "missed"}`. Дозволений перехід з будь-якого статусу в будь-який (включно з виправленням помилкового `done`); баланс перераховується автоматично, бо не зберігається.

| Метод і шлях | Запит | Відповідь | Помилки |
| --- | --- | --- | --- |
| `GET /api/lessons` | query, усі необов'язкові: `from` datetime (включно), `to` datetime (не включно) — фільтр за `starts_at`; `student_id` uuid; `status` одне зі значень статусу | `200` `Lesson[]`, сортування за `starts_at` зростанням | `401`, `422` (у т.ч. `from >= to`, час без offset) |
| `POST /api/lessons` | `LessonCreate` | `201` `Lesson` | `401`, `409 student_archived`, `422` (у т.ч. `student_not_found`) |
| `GET /api/lessons/{id}` | — | `200` `Lesson` | `401`, `404`, `422` |
| `PATCH /api/lessons/{id}` | `LessonUpdate` | `200` `Lesson` | `401`, `404`, `422` |
| `PATCH /api/lessons/{id}/status` | `LessonStatusUpdate` | `200` `Lesson` | `401`, `404`, `422` |
| `DELETE /api/lessons/{id}` | — | `204` без тіла; запис видаляється | `401`, `404`, `422` |

`GET /api/lessons` з `student_id` чужого або неіснуючого учня повертає `200 []`.

### Оплати

**`Payment`** (відповідь):

| Поле | Тип |
| --- | --- |
| `id` | string (uuid) |
| `student_id` | string (uuid) |
| `student_full_name` | string |
| `amount` | integer (копійки, > 0) |
| `paid_at` | string (datetime) |
| `method` | `"cash"` \| `"card"` \| `"transfer"` |
| `comment` | string \| null |
| `created_at` | string (datetime) |

**`PaymentCreate`**: `student_id` uuid **обов'язкове**; `amount` integer `1..100000000` **обов'язкове**; `method` **обов'язкове**; `paid_at` datetime з offset, default — зараз; `comment` string ≤ 500 \| null. Оплату архівному учневі приймати **можна** (закриття боргу).

**`PaymentUpdate`**: `amount`, `paid_at`, `method`, `comment` — необов'язкові. `student_id` не приймається (`422`).

| Метод і шлях | Запит | Відповідь | Помилки |
| --- | --- | --- | --- |
| `GET /api/payments` | query, усі необов'язкові: `student_id` uuid; `from` datetime (включно), `to` datetime (не включно) — фільтр за `paid_at` | `200` `Payment[]`, сортування за `paid_at` спаданням | `401`, `422` |
| `POST /api/payments` | `PaymentCreate` | `201` `Payment` | `401`, `422` (у т.ч. `student_not_found`) |
| `GET /api/payments/{id}` | — | `200` `Payment` | `401`, `404`, `422` |
| `PATCH /api/payments/{id}` | `PaymentUpdate` | `200` `Payment` | `401`, `404`, `422` |
| `DELETE /api/payments/{id}` | — | `204` без тіла; запис видаляється | `401`, `404`, `422` |

### `GET /api/dashboard`

Усі межі періодів — у `Europe/Kyiv` на момент запиту.

- Відповідь `200` — `Dashboard`:

| Поле | Тип | Зміст |
| --- | --- | --- |
| `date` | string (`YYYY-MM-DD`) | Сьогоднішня дата в Києві |
| `today` | `Lesson[]` | Заняття з `starts_at` у `[сьогодні 00:00, завтра 00:00)`, **усі статуси**, за часом |
| `upcoming` | `Lesson[]` | Заняття зі статусом `planned` у `[завтра 00:00, сьогодні + 8 днів 00:00)` — наступні 7 днів, за часом |
| `income_month` | integer (копійки) | Сума `payments.amount` з `paid_at` у поточному календарному місяці (касовий принцип: що реально отримано) |
| `debt_total` | integer (копійки, ≥ 0) | Сума `−balance` по всіх учнях з `balance < 0`, включно з архівними |
| `debtors` | `Debtor[]` | Учні з `balance < 0`, від найбільшого боргу |

`Debtor`: `student_id` string (uuid), `full_name` string, `balance` integer (від'ємний), `archived` boolean.

- Помилки: `401`.

## `frontend/`

Навіщо: односторінковий кабінет репетитора українською. Поки що **тільки опис**: папка створюється разом з першим кодом фронтенду, а цей розділ — контракт для неї.

### Версії

Node 20.15.1. React 18.3.1, react-dom 18.3.1, Vite 5.4.0, @vitejs/plugin-react 4.3.1, TypeScript 5.5.4, Tailwind CSS 3.4.7, postcss 8.4.40, autoprefixer 10.4.19, react-oidc-context 3.3.1, oidc-client-ts 3.5.0. shadcn/ui — локальні файли компонентів у `src/components/ui/` плюс class-variance-authority 0.7.0, clsx 2.1.1, tailwind-merge 2.4.0, lucide-react 0.424.0; пакети Radix, які тягне конкретний компонент, фіксуються точною версією в момент додавання. Лінт: ESLint 9.10.0 (+ typescript-eslint 8.6.0, eslint-plugin-react-hooks 5.1.0), Prettier 3.3.3. Усі версії в `package.json` — точні, без `^`; `package-lock.json` комітиться.

### Структура

| Шлях | Навіщо |
| --- | --- |
| `package.json` | Залежності й скрипти: `dev`, `build`, `lint` (`eslint .`), `format:check` (`prettier --check .`). |
| `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `prettier.config.js`, `components.json` | Конфігурація інструментів. |
| `index.html` | Точка монтування, `lang="uk"`. |
| `src/main.tsx` | Корінь: `AuthProvider` з `react-oidc-context`. |
| `src/App.tsx` | Вибір сторінки за шляхом: `/` дашборд, `/students`, `/students/<id>`, `/lessons`, `/payments`. Неавторизованому — сторінка входу. |
| `src/auth/oidc.ts` | Конфіг OIDC: authority, client_id, `redirect_uri = location.origin + "/"`, scopes, logout через домен Cognito. |
| `src/api/client.ts` | Єдиний `fetch`-обгортка: база `VITE_API_URL`, `Authorization: Bearer`, розбір помилок. На `401` — повторний вхід. |
| `src/api/{me,students,lessons,payments,dashboard}.ts` | Типізовані клієнти ендпоінтів; TS-типи дзеркалять схеми з розділу «Backend API». |
| `src/pages/` | Сторінки: дашборд, список учнів, картка учня (заняття, оплати, баланс), розклад, оплати. |
| `src/components/` | Форми й списки сторінок; `ui/` — shadcn/ui. |
| `src/lib/money.ts` | Копійки ↔ рядок `1 234,50 ₴` (`Intl.NumberFormat("uk-UA", { currency: "UAH" })`). Введення гривень → копійки без float-помилок. |
| `src/lib/datetime.ts` | Відображення й введення часу в `Europe/Kyiv`; на бекенд іде ISO 8601 з offset. |

### Змінні збірки

| Змінна | Звідки |
| --- | --- |
| `VITE_API_URL` | Локально `http://localhost:8000`; у хмарі — Lambda function URL (output `api_url`) |
| `VITE_COGNITO_AUTHORITY` | output `cognito_authority` |
| `VITE_COGNITO_CLIENT_ID` | output `cognito_client_id` |
| `VITE_COGNITO_DOMAIN` | output `cognito_domain` (для logout) |

Фронтенд звертається до API напряму на function URL (cross-origin), тому бекенд відкриває CORS лише для домену сайту. Локально фронтенд запускається `npm run dev` на порту 5173 поза compose.

## `docker-compose.yml`

Навіщо: повний локальний runtime. `docker compose up` з кореня — єдина команда запуску; нічого, крім Docker, не потрібно.

`name: tutor-cabinet`. Два сервіси, один іменований том `pgdata`.

| Сервіс | Образ / build | Порт | Залежить від | Готовність (healthcheck) |
| --- | --- | --- | --- | --- |
| `postgres` | `postgres:16`; `POSTGRES_USER=tutor`, `POSTGRES_PASSWORD=tutor`, `POSTGRES_DB=tutor_cabinet`; том `pgdata:/var/lib/postgresql/data` | `5432` лише всередині мережі compose (на хост не публікується) | — | `pg_isready -U tutor -d tutor_cabinet`; `interval: 5s`, `timeout: 3s`, `retries: 12` |
| `backend` | `build: ./backend` (`Dockerfile`, `python:3.12-slim`); змінні з таблиці «Змінні середовища backend»; `COGNITO_AUTHORITY`/`COGNITO_CLIENT_ID` беруться з оточення shell або `.env`, а до створення пулу мають заглушки (тоді всі захищені ендпоінти відповідають `401`) | `8000:8000` | `postgres` з `condition: service_healthy` | `python -c` з `urllib.request.urlopen("http://127.0.0.1:8000/api/health")`; `interval: 5s`, `timeout: 3s`, `retries: 12`, `start_period: 10s`. Стає healthy лише після `alembic upgrade head` і старту Uvicorn. |

Backend з'єднується з базою за хостом `postgres`. Тестова база `tutor_cabinet_test` живе в тому самому контейнері; її створює `tests/conftest.py`.

## `infra/`

Навіщо: уся хмарна інфраструктура як код. Terraform, **одна root module**, без підмодулів. State і запуски — у HCP Terraform workspace в режимі **remote execution**; змінні й AWS-доступ задаються у workspace. `terraform apply` виконується тільки в HCP Terraform після мержу — у Makefile його немає. Поки тільки опис файлів.

| Файл | Що описує |
| --- | --- |
| `versions.tf` | `required_version >= 1.10`; блок `cloud` (організація команди, workspace `tutor-cabinet`); провайдер `hashicorp/aws ~> 6.0`, регіон `var.region`; `default_tags { PROJECT_NAME = var.project_name, ManagedBy = "terraform" }` — тег на всіх ресурсах. |
| `variables.tf` | `region` (default `us-east-1`), `project_name` (default `tutor-cabinet`), `domain_prefix` (Cognito), `google_client_id`, `google_client_secret` (sensitive), `db_password` (sensitive), `github_repository` (`owner/name`), `backend_image_tag` (тег першого образу; далі образ оновлює деплой). Значень у репозиторії немає — вони у змінних workspace. |
| `network.tf` | Власний VPC; дві приватні підмережі у двох AZ (вимога DB subnet group); без Internet Gateway, без NAT, без VPC endpoints — Lambda не викликає AWS API. Security groups: `lambda` (egress лише 5432 до `db`), `db` (ingress 5432 лише від `lambda`). |
| `database.tf` | DB subnet group; Aurora PostgreSQL 16 cluster, Serverless v2 `min_capacity = 0`, `max_capacity = 1`, auto-pause; один інстанс `db.serverless`; шифрування сховища; бекапи 7 днів; фінальний snapshot при видаленні; master-пароль з `var.db_password`. |
| `api.tf` | ECR-репозиторій бекенду (теги `IMMUTABLE`, бо тег = commit SHA); IAM-роль Lambda з `AWSLambdaVPCAccessExecutionRole`; CloudWatch log group (14 днів); Lambda `package_type = "Image"`, `linux/amd64` (x86_64), 512 MB, timeout 30 s, `vpc_config` з підмережами й SG `lambda`; env `DATABASE_URL`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `CORS_ORIGINS`, `COGNITO_JWKS` (початково `{"keys":[]}`); `lifecycle.ignore_changes` на `image_uri` і `COGNITO_JWKS`, бо їх оновлює деплой; function URL з `authorization_type = "NONE"` (автентифікацію робить застосунок) і **без** блоку `cors` (CORS робить FastAPI — один механізм локально і в хмарі). |
| `site.tf` | Приватний S3-бакет (block public access, без website hosting); CloudFront distribution з Origin Access Control; bucket policy дозволяє `s3:GetObject` лише цій distribution; `default_root_object = "index.html"`; 403/404 → `/index.html` з кодом 200 для SPA-маршрутів; `PriceClass_100`; сертифікат CloudFront за замовчуванням. |
| `auth.tf` | Cognito user pool (email як username, автоверифікація email, self sign-up); Google identity provider; публічний web-клієнт (code flow, PKCE, без секрету, scopes `openid email profile`, callback/logout — домен CloudFront і `http://localhost:5173/`); домен managed login версії 2 і branding. |
| `ci.tf` | GitHub OIDC provider (`token.actions.githubusercontent.com`); IAM-роль деплою з довірою лише для `repo:${var.github_repository}:ref:refs/heads/main`. Права: push у ECR-репозиторій бекенду; `lambda:GetFunctionConfiguration`, `UpdateFunctionConfiguration`, `UpdateFunctionCode`, `InvokeFunction` на функцію бекенду; `s3:ListBucket`/`PutObject`/`DeleteObject` на бакет сайту; `cloudfront:CreateInvalidation` на distribution. Довготривалих ключів немає. |
| `outputs.tf` | `site_url`, `api_url`, `cognito_authority`, `cognito_client_id`, `cognito_domain`, `ecr_repository_url`, `lambda_function_name`, `frontend_bucket`, `cloudfront_distribution_id`, `deploy_role_arn`. Імена збігаються зі змінними Makefile. |

### Цільова схема в AWS (us-east-1)

```text
браузер ──HTTPS──▶ CloudFront (OAC) ──▶ S3 (приватний): статичний фронтенд
   │
   ├──OIDC code+PKCE──▶ Cognito managed login (email+пароль, Google)
   │
   └──HTTPS + Bearer──▶ Lambda function URL ──▶ Lambda (FastAPI + Mangum, образ з ECR)
                                                   │  у VPC, приватні підмережі, без NAT
                                                   └──5432──▶ Aurora Serverless v2 PostgreSQL (0–1 ACU)
```

Наслідок `min_capacity = 0`: після простою перший запит чекає, поки Aurora прокинеться (порядку 15 секунд). Фронтенд показує стан завантаження і не вважає це помилкою; timeout Lambda 30 s.

## Makefile

Навіщо: єдиний рецепт деплою й локальних перевірок. `terraform apply` тут немає.

**Зараз реалізовано** лише локальні цілі; усі вони виконуються в образі backend (`docker compose run --rm --build backend ...`), тож локально потрібен тільки Docker:

| Ціль | Що робить |
| --- | --- |
| `lint` | `ruff check .` і `ruff format --check .` |
| `test` | `pytest` (compose підніме й дочекається `postgres`) |
| `seed` | `python -m app.seed --tutor-sub "$(TUTOR_SUB)"`, `TUTOR_SUB` default `local-dev` |
| `migrate-local` | `alembic upgrade head` на локальній базі (backend і так мігрує при старті; ціль — для нової ревізії, поки він працює) |

Цілі деплою нижче з'являться разом з `infra/`; тоді CI викликатиме ці ж цілі й не дублюватиме їхніх команд.

Змінні деплою за замовчуванням читаються з `terraform -chdir=infra output -raw <name>` (локально, після `terraform login`); у CI вони задаються явно з repository variables GitHub. AWS-доступ дає викликач (локальний профіль або OIDC-роль у CI) — у Makefile ключів немає.

| Ціль | Потрібні змінні | Що робить |
| --- | --- | --- |
| `deploy-backend` | `ECR_REPOSITORY_URL`, `LAMBDA_FUNCTION_NAME`, `COGNITO_AUTHORITY`; `IMAGE_TAG` (default — повний `git rev-parse HEAD`), `AWS_REGION` (default `us-east-1`) | Відмовляється при брудному робочому дереві. Логін у ECR. Якщо образу з тегом `IMAGE_TAG` ще нема — `docker buildx build -f backend/Dockerfile.lambda --platform linux/amd64 --provenance=false` і push. Завантажує `${COGNITO_AUTHORITY}/.well-known/jwks.json`, записує його в `COGNITO_JWKS`, зберігаючи решту змінних функції; чекає `function-updated`. Оновлює код функції на `<repo>:<IMAGE_TAG>`; чекає `function-updated`. |
| `migrate` | `LAMBDA_FUNCTION_NAME`, `AWS_REGION` | `aws lambda invoke` з payload `{"action": "migrate"}`; падає, якщо у відповіді є `FunctionError` або немає `"migrated": true`. |
| `deploy-frontend` | `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `API_URL`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN` | `npm ci` і `npm run build` з `VITE_*`; `aws s3 sync frontend/dist/` з `--delete` (хешовані assets — `max-age=31536000, immutable`, `index.html` — `no-cache`); інвалідація CloudFront `/*`. |
| `infra-plan` | `terraform login` у HCP | `terraform -chdir=infra fmt -check`, `init`, `validate`, `plan` (план виконується віддалено в HCP Terraform). |
| `lint` (розширення) | — | Коли з'явиться frontend — додатково `npm ci`, `npm run lint`, `npm run format:check`. |

Порядок деплою: `deploy-backend` → `migrate` → `deploy-frontend`. Міграцію запускає вже новий образ, бо ревізії Alembic лежать у ньому. Тому кожна міграція має бути сумісною з попередньою версією коду (спершу додаємо, прибираємо — в наступному релізі).

## CI і деплой (`.github/workflows/`)

**Зараз є** `backend.yml`: на кожен `push` у будь-яку гілку — `actions/setup-python@v5` (3.12), `pip install ".[dev]"`, `ruff check .`, `ruff format --check .`, `pytest` у `backend/` з service container `postgres:16` і `TEST_DATABASE_URL`. AWS-доступу не має.

Цільовий стан після появи frontend/ та infra/ (`backend.yml` тоді поглинається `ci.yml`):

| Файл | Тригери | Що робить |
| --- | --- | --- |
| `ci.yml` | `pull_request`; `push` у будь-яку гілку, крім `main`; `workflow_call` | Job `backend`: `actions/setup-python@v5` (3.12), `pip install "./backend[dev]"`, `ruff check backend`, `ruff format --check backend`, `pytest` у `backend/` з service container `postgres:16` і `TEST_DATABASE_URL`. Job `frontend`: `actions/setup-node@v4` (20.15.1), `npm ci`, `npm run lint`, `npm run format:check` у `frontend/`. AWS-доступу не має. |
| `deploy.yml` | `push` у `main` | Спершу викликає `ci.yml` (`uses: ./.github/workflows/ci.yml`). Потім job `deploy` (`needs` на CI, `concurrency: deploy` без скасування): `permissions: id-token: write, contents: read`; `aws-actions/configure-aws-credentials@v4` з `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}` і `us-east-1`; `docker/setup-buildx-action@v3`; `make deploy-backend IMAGE_TAG=${{ github.sha }}`, `make migrate`, `make deploy-frontend`. |

Repository variables GitHub (не secrets — у них немає секретів): `AWS_DEPLOY_ROLE_ARN`, `ECR_REPOSITORY_URL`, `LAMBDA_FUNCTION_NAME`, `API_URL`, `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`. Значення копіюються з `terraform output` один раз після першого apply.

## `docs/adr/`

Навіщо: архітектурні рішення з контекстом і відкинутими альтернативами — щоб через пів року було видно, *чому* так. Формат як у Peach: статус, контекст, рішення, наслідки. Мова — українська. Новий ADR — коли змінюється будь-який контракт із цього документа.

| ADR | Рішення |
| --- | --- |
| `0001-monorepo-layout.md` | Один репозиторій з `backend/`, `frontend/`, `infra/`; шари backend; Makefile як єдиний рецепт деплою. |
| `0002-backend-on-lambda-function-url.md` | Lambda container image + function URL замість ECS/Fargate чи ALB: платимо за запити, один образ для API і міграцій. |
| `0003-aurora-serverless-v2-scale-to-zero.md` | Aurora Serverless v2 0–1 ACU: ціна в простої проти холодного старту; пароль у змінній середовища замість Secrets Manager, бо без NAT для нього потрібен платний interface endpoint. |
| `0004-cognito-jwks-in-env.md` | VPC без NAT → JWKS у `COGNITO_JWKS` на деплої; що робити при ротації ключів. |
| `0005-money-in-kopecks-computed-balance.md` | Гроші — цілі копійки; баланс рахується, а не зберігається. |
| `0006-time-zone-europe-kyiv.md` | `timestamptz` у БД, `Europe/Kyiv` для «сьогодні»/«місяця» і для відповідей API. |

## README.md

Навіщо: перша сторінка для нової людини в репозиторії. Розділи:

1. **Що це** — 3–4 речення про продукт з першого абзацу цього документа.
2. **Локальний запуск** — встановити Docker Desktop, `docker compose up`, API на `http://localhost:8000`, перевірка `curl http://localhost:8000/api/health`. Фронтенд — `cd frontend && npm ci && npm run dev`. `make seed TUTOR_SUB=...` для демо-даних; як дізнатися свій `sub`. `make lint`, `make test`.
3. **Деплой** — звичайний шлях: мерж у `main`, далі все робить `deploy.yml`. Ручний шлях: ті самі цілі Makefile з локальними AWS-креденшелами. Інфраструктура: PR зі змінами в `infra/` → `make infra-plan` → apply у HCP Terraform після мержу.
4. **Перше розгортання** — порядок bootstrap: змінні workspace → перший apply створює ECR (Lambda потребує вже наявного образу, тому перший apply йде з `-target` на ECR-репозиторій) → `make deploy-backend`-ом push образу з тегом у `backend_image_tag` → повний apply → заповнити repository variables з `terraform output` → `make migrate`.
5. **Посилання** — `PROJECT.md`, `docs/adr/`.

## Відкриті питання

- **Email та ім'я репетитора.** Access token Cognito за замовчуванням не містить `email` і `name`, а Lambda без інтернету не може викликати `/oauth2/userInfo`. Тому `tutors.email` і `tutors.name` nullable і на практиці лишаться порожніми; фронтенд показує email з власного OIDC-профілю. Якщо бекенду ці поля знадобляться — окремий ADR: або `PATCH /api/me`, або pre-token-generation trigger у Cognito, який додає claims в access token.
