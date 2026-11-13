# tutor-cabinet — структура репозиторію і контракти

`tutor-cabinet` — монорепозиторій кабінету для репетитора, який працює сам на себе. Репетитор реєструється, веде список учнів, планує заняття, відмічає проведені й записує оплати; система рахує, хто скільки винен. Репетитор також задає домашні завдання й тести.

Профілів три: **репетитор**, **учень** і **батьки**. Учень і батьки входять за кодом запрошення від репетитора й бачать лише картки, до яких їх прив'язано: учень — розклад, ДЗ і тести (здає ДЗ текстом і фото, проходить тести), батьки — те саме плюс оплати й баланс, і можуть скасувати заняття не пізніше ніж за N годин (N задає репетитор, за замовчуванням 24).

Цей документ фіксує **структуру репозиторію і контракти між частинами**: що лежить у кожній папці, які дані ходять між фронтендом, бекендом, базою й AWS. Коду реалізації тут немає. Якщо реалізація розходиться з цим документом, правиться або реалізація, або документ разом з ADR — але не мовчки.

Підходи до структури backend, `lambda_handler`, Cognito, Terraform, Makefile і CI взято з репозиторію лаб Peach (`../lab2/Peach`). Функціональність Spry (зустрічі, звіти, LLM-парсер) сюди не переноситься.

## Незмінні умови продукту

| Що | Значення |
| --- | --- |
| Мова інтерфейсу | українська |
| Валюта | гривня; **усі суми — цілі числа в копійках** (`int`), у JSON і в БД. Гривні з копійками показує тільки фронтенд. |
| Часовий пояс | `Europe/Kyiv`. «Сьогодні», «поточний місяць» і межі днів рахуються в ньому. У БД час зберігається як `timestamptz`. |
| Користувачі | репетитор, учень, батьки; одна роль на акаунт, назавжди. Репетитор бачить лише свої дані, учень і батьки — лише прив'язані картки. |
| Вартість | інфраструктура в AWS не має погодинних платежів: без NAT, без VPC endpoints, без Secrets Manager. Платимо лише за використання (Lambda, Aurora 0 ACU у простої, S3, токени Claude), а це покривають кредити акаунта. |

## Чого в репозиторії немає і не буде

Redis, черг, nginx, ALB, ECS/Fargate, Kubernetes, окремого сервісу авторизації, NAT Gateway, VPC endpoints, Secrets Manager, MinIO. Локально — тільки PostgreSQL і backend (фото ДЗ лежать на docker-томі). У хмарі — S3 + CloudFront для сайту, приватний S3 для фото ДЗ, дві Lambda з одного образу (API у VPC і ШІ-оцінювач поза VPC), EventBridge Scheduler для оцінювача, Aurora, Cognito, Claude Haiku 5.5 в Amazon Bedrock, ECR і IAM-роль для CI.

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
│   │       ├── 0001_initial.py
│   │       ├── 0002_users_and_roles.py
│   │       ├── 0003_invites_and_links.py
│   │       ├── 0004_lesson_cancellation.py
│   │       ├── 0005_homework.py
│   │       └── 0006_quizzes.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── settings.py
│   │   ├── db.py
│   │   ├── lambda_handler.py
│   │   ├── seed.py
│   │   ├── storage.py
│   │   ├── grader/
│   │   │   ├── __init__.py
│   │   │   ├── tasks.py
│   │   │   ├── api_client.py
│   │   │   ├── graders.py
│   │   │   ├── run.py
│   │   │   └── lambda_handler.py
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── jwks.py
│   │   │   └── dependencies.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── period.py
│   │   │   ├── health.py
│   │   │   ├── me.py
│   │   │   ├── students.py
│   │   │   ├── lessons.py
│   │   │   ├── payments.py
│   │   │   ├── dashboard.py
│   │   │   ├── access.py          # коди запрошення й прив'язки (репетитор) + redeem
│   │   │   ├── portal.py          # /api/portal: учень і батьки
│   │   │   ├── homework.py
│   │   │   ├── quizzes.py
│   │   │   ├── internal.py        # /api/internal/grading для оцінювача
│   │   │   └── files.py           # лише локально: файли на томі
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── student.py
│   │   │   ├── lesson.py
│   │   │   ├── payment.py
│   │   │   ├── access.py          # student_links, invites
│   │   │   ├── homework.py
│   │   │   └── quiz.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── common.py
│   │   │   ├── user.py
│   │   │   ├── student.py
│   │   │   ├── lesson.py
│   │   │   ├── payment.py
│   │   │   ├── dashboard.py
│   │   │   ├── access.py
│   │   │   ├── portal.py
│   │   │   ├── homework.py
│   │   │   └── quiz.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── users.py
│   │       ├── students.py
│   │       ├── lessons.py
│   │       ├── payments.py
│   │       ├── balances.py
│   │       ├── dashboard.py
│   │       ├── access.py
│   │       ├── portal.py
│   │       ├── homework.py
│   │       ├── quizzes.py
│   │       ├── grading.py
│   │       ├── clock.py
│   │       └── errors.py
│   └── tests/
│       ├── conftest.py
│       ├── factories.py
│       ├── tokens.py
│       ├── test_schema.py
│       ├── test_migrations.py
│       ├── test_seed.py
│       ├── test_health.py
│       ├── test_auth.py
│       ├── test_students.py
│       ├── test_lessons.py
│       ├── test_payments.py
│       ├── test_balances.py
│       ├── test_dashboard.py
│       ├── test_isolation.py
│       ├── test_access.py
│       ├── test_portal.py
│       ├── test_homework.py
│       ├── test_storage.py
│       ├── test_quizzes.py
│       ├── test_grading.py
│       └── test_lambda_handler.py
├── frontend/                      # кабінет репетитора; екранів учня й батьків ще немає
├── infra/
│   ├── .terraform.lock.hcl
│   ├── versions.tf
│   ├── variables.tf
│   ├── network.tf
│   ├── database.tf
│   ├── api.tf
│   ├── uploads.tf
│   ├── grader.tf
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
        ├── 0006-time-zone-europe-kyiv.md
        ├── 0007-roles-and-invite-codes.md
        ├── 0008-ai-grading-outside-the-vpc.md
        └── 0009-homework-photos-presigned.md
```

## Кореневі файли

| Шлях | Навіщо |
| --- | --- |
| `.github/workflows/` | CI (лінт і тести на кожен push і PR) та деплой на push у `main`. Див. «CI і деплой». |
| `.gitignore` | `node_modules/`, `dist/`, `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `infra/.terraform/`, локальні `.env*`. `infra/.terraform.lock.hcl` **комітиться**. |
| `Makefile` | Контракт деплою й локальних перевірок. CI викликає ті самі цілі. Див. «Makefile». |
| `PROJECT.md` | Цей документ. |
| `README.md` | Що це за продукт, як запустити локально, як задеплоїти. Див. «README.md». |
| `docker-compose.yml` | Увесь локальний runtime: `postgres` і `backend` (плюс том `uploads` для фото ДЗ). `docker compose up` — єдина команда локального запуску. |

## `backend/`

Навіщо: HTTP API кабінету і вся бізнес-логіка (баланси, дашборд, ролі й доступи, ДЗ, тести, ізоляція даних). Один і той самий FastAPI-застосунок працює локально під Uvicorn і в AWS як Lambda через Mangum. З того самого образу працює й ШІ-оцінювач (`app/grader`), окремою Lambda.

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
| anthropic[bedrock] | 2.8.0 (`AnthropicBedrockMantle` для Claude Haiku 5.5) |
| boto3 | 1.44.2 (presigned URL для S3) |
| python-multipart | 0.0.33 (локальне завантаження фото) |
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
| `Dockerfile.lambda` | Образ для Lambda на `public.ecr.aws/lambda/python:3.12`. Ставить пакет **без** dev-залежностей, копіює `app/`, `alembic.ini`, `migrations/`. `CMD ["app.lambda_handler.handler"]`; Lambda оцінювача використовує той самий образ із `image_config.command = ["app.grader.lambda_handler.handler"]`. Платформа `linux/amd64`. |
| `pyproject.toml` | Точні версії залежностей, налаштування ruff і pytest (`testpaths = ["tests"]`). |
| `alembic.ini` | `script_location = migrations`; URL бази не тут, а з `DATABASE_URL` у `migrations/env.py`. |
| `migrations/` | Alembic. Схема БД змінюється **тільки** міграціями: `0001` — чотири початкові таблиці, `0002` — `tutors` → `users` з ролями (і виправлення імен CHECK-обмежень з подвоєним префіксом, які створила `0001`), `0003` — запрошення й прив'язки, `0004` — хто й коли скасував заняття, `0005` — ДЗ, `0006` — тести. Імена обмежень у нових міграціях задаються через `op.f()`, щоб naming convention не додавала префікс удруге; `tests/test_migrations.py` фіксує всі імена. |
| `app/main.py` | Створює `FastAPI`, підключає роутери з `app/api` під префіксом `/api`, `CORSMiddleware` з `CORS_ORIGINS`. Більше нічого. |
| `app/settings.py` | Читає змінні середовища (таблиця нижче) в один незмінний об'єкт `settings`. Не імпортує `app.db`. |
| `app/db.py` | `Base` (DeclarativeBase), engine з `DATABASE_URL` (`pool_pre_ping=True`; у Lambda — пул на одне з'єднання), `get_session` як FastAPI-залежність. |
| `app/lambda_handler.py` | Вхід Lambda. Подія `{"action": "migrate"}` → `alembic upgrade head` і відповідь `{"migrated": true, "revision": "<head>"}`. Будь-яке інше значення `action` → виняток (Lambda повертає `FunctionError`). Подія без `action` → `Mangum(app, lifespan="off")`. |
| `app/seed.py` | `python -m app.seed [--tutor-sub <sub>]`, default `local-dev`: створює репетитора з цим `sub` (якщо нема), 3 учнів, заняття на поточний тиждень, кілька оплат і щонайменше одного боржника. Для першої учениці — акаунти `<sub>-student` і `<sub>-parent`, ДЗ на перевірці і демо-тест (одне призначення відкрите, одне здане й чекає на оцінювача). Повторний запуск видаляє дані **лише цього** репетитора і створює їх заново. Тільки для локальної бази. |
| `app/storage.py` | Сховище фото ДЗ. `S3Storage` — presigned POST/GET (підпис обчислюється локально з креденшелами ролі, мережа не потрібна); `LocalStorage` — файли на томі, доступ через HMAC-підписані URL `/api/files/...`. Ключі лише виду `homework/<lesson_id>/<uuid>.<jpg|png|heic>`. |
| `app/grader/` | ШІ-оцінювач письмових відповідей — окрема Lambda поза VPC. **Не імпортує `app.db` і SQLAlchemy** (перевіряє тест). Забирає роботу через `/api/internal/grading` (`api_client.py`), оцінює `BedrockGrader` (Claude Haiku 5.5, structured output) або `FakeGrader` (локально й у тестах), повертає бали. `run.py` — один прохід і CLI для `make grade`. |
| `app/auth/` | Перевірка Cognito access token. Не імпортує `app.db`. |
| `app/auth/jwks.py` | Джерело ключів: якщо задано `COGNITO_JWKS` — парсить його один раз при старті (невалідний JSON → застосунок не стартує); інакше завантажує `{COGNITO_AUTHORITY}/.well-known/jwks.json` і кешує в процесі. |
| `app/auth/dependencies.py` | `require_claims` (токен → `Claims(sub, ...)` або 401); `get_current_user` (claims + сесія → рядок `users`, створює його без ролі при першому запиті); `get_current_tutor` і `get_current_member` (учень або батьки) — `403`, якщо роль інша. Тести підміняють `get_current_tutor` / `get_current_user` через `app.dependency_overrides`, щоб діяти від імені різних людей. |
| `app/api/` | Тонкі роутери: розбір запиту, виклик сервісу, серіалізація. Без SQL і без бізнес-правил. Один файл на ресурс; `period.py` — спільна пара query `from`/`to` (`from >= to` → 422). |
| `app/models/` | ORM-моделі SQLAlchemy 2.x (`Mapped[...]`), один файл на таблицю. |
| `app/schemas/` | Pydantic v2: тіла запитів і відповідей. Усі моделі запитів мають `extra="forbid"`. `common.py` — спільні типи: `Money` (int, копійки), `AwareDatetime`, `ErrorResponse`. |
| `app/services/` | Бізнес-логіка. Функції репетитора приймають `tutor_id` і фільтрують за ним; функції порталу приймають користувача й пускають лише до прив'язаних карток (`services/access.py`). Це єдине місце, де забезпечується ізоляція даних. |
| `app/services/balances.py` | Єдина формула балансу (див. «Модель даних»), яку використовують і `students`, і `dashboard`. |
| `app/services/clock.py` | «Зараз», «сьогодні» і «поточний місяць» у `Europe/Kyiv`; підмінюється в тестах. |
| `app/services/errors.py` | Доменні винятки: `NotFound` → `404`, `StudentNotFound` і `Invalid(code)` → `422`, `Forbidden` → `403`, `StudentArchived` і `Conflict(code)` → `409`; перетворює їх `app/main.py`. |
| `app/services/grading.py` | API-бік ШІ-оцінювання: оренда зданих тестів на 5 хвилин (`FOR UPDATE SKIP LOCKED`), застосування балів, передача репетитору. |
| `tests/` | pytest проти справжнього PostgreSQL з `TEST_DATABASE_URL`. `conftest.py` створює тестову базу, якщо її нема, проганяє `alembic upgrade head` і загортає кожен тест у транзакцію з відкатом. Токени підписуються тестовим RSA-ключем (`tokens.py`). Фікстури: `as_tutor(...)` (два репетитори), `as_user(...)` (учень, батьки, без ролі — справжні перевірки ролей лишаються), `family` (картка з прив'язаними учнем і батьками, заморожений час), `storage` (фото в тимчасовій теці). `factories.py` створює записи через API. Bedrock у тестах не викликається — лише заглушка клієнта. |

### Змінні середовища backend

| Змінна | Обов'язкова | Локально (compose) | У Lambda (Terraform / деплой) |
| --- | --- | --- | --- |
| `DATABASE_URL` | так | `postgresql+psycopg://tutor:tutor@postgres:5432/tutor_cabinet` | Збирається в `api.tf` з endpoint Aurora і `db_password`. |
| `COGNITO_AUTHORITY` | так | `https://cognito-idp.us-east-1.amazonaws.com/<pool_id>` | Те саме, з `auth.tf`. |
| `COGNITO_CLIENT_ID` | так | ID web-клієнта пулу | Те саме, з `auth.tf`. |
| `COGNITO_JWKS` | ні | не задано → ключі завантажуються за URL | JSON-документ JWKS (`{"keys":[...]}`) рядком; записує `make deploy-backend`. |
| `CORS_ORIGINS` | ні | `http://localhost:5173` | `https://<домен CloudFront>` — і тільки він. |
| `TEST_DATABASE_URL` | тільки для тестів | `postgresql+psycopg://tutor:tutor@postgres:5432/tutor_cabinet_test` | — |
| `STORAGE_BACKEND` | ні | `local` | `s3` |
| `UPLOADS_BUCKET` | для `s3` | — | Бакет фото з `uploads.tf`. |
| `UPLOADS_DIR` | для `local` | `/data/uploads` (том `uploads`) | — |
| `FILES_SECRET` | для `local` | `local-dev-only-secret` | — |
| `PUBLIC_API_URL` | для `local` | `http://localhost:8000` — база посилань `/api/files/...` | — |
| `DEV_AUTH` | ні | `on` — приймати `Bearer dev:<sub>` без Cognito (демо-кнопки входу) | не задається; з `on` backend у Lambda не стартує |
| `GRADER_TOKEN` | ні | `local-dev-grader-token` | Спільний секрет з Lambda оцінювача (`random_password` або sensitive-змінна workspace). Порожній → `/api/internal` відповідає `404`. |
| `AI_GRADER` | ні | `on` | `on`; `off` — письмові відповіді одразу йдуть репетитору (`needs_review`), Bedrock не викликається. |

**Lambda оцінювача** (поза VPC) отримує лише `API_URL` (function URL API), `GRADER_TOKEN`, `GRADER` (`bedrock` \| `fake` \| `off`), `GRADER_MODEL` (default `anthropic.claude-haiku-5-5`) і `AWS_REGION`. Бази вона не бачить.

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

**Користувач** ідентифікується за claim `sub`. При першому автентифікованому запиті створюється рядок `users` **без ролі** (`INSERT ... ON CONFLICT (cognito_sub) DO NOTHING`, потім вибірка — безпечно при паралельних запитах).

### Ролі

| Роль | Як отримати | Що доступно |
| --- | --- | --- |
| `null` | одразу після реєстрації | лише `/api/me` і `POST /api/invites/redeem` |
| `tutor` | `POST /api/me/role {"role": "tutor"}` | усе під `/api/students`, `/api/lessons`, `/api/payments`, `/api/dashboard`, `/api/homework`, `/api/quizzes`, `/api/quiz-assignments` |
| `student` | перший використаний код запрошення з `relation = student` | `/api/portal/*`; здає ДЗ і тести; не бачить грошей і приватних нотаток |
| `parent` | перший використаний код з `relation = parent` | `/api/portal/*`; бачить ціни, оплати й баланс, скасовує заняття; не здає ДЗ і тести |

Роль ставиться один раз і більше не змінюється (ADR 0007). Код іншої ролі → `409 role_conflict`; репетитор кодів не використовує. Ендпоінт чужої ролі → `403 {"detail": "forbidden"}`.

## Модель даних

PostgreSQL 16 (локально) / Aurora PostgreSQL 16 (у хмарі). Усі `id` — UUID v4, генеруються бекендом. Усі `created_at` — `timestamptz not null default now()`. Усі суми — `integer` у копійках.

### `users` (до `0002` — `tutors`)

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `cognito_sub` | text | not null, **unique** |
| `role` | text | null до вибору; `CHECK (role IN ('tutor','student','parent'))` |
| `email` | text | null |
| `name` | text | null |
| `cancel_notice_hours` | integer | not null, default `24`, `0..168`; має сенс лише для репетитора |
| `created_at` | timestamptz | not null |

Колонки `tutor_id` в усіх таблицях посилаються на `users.id`.

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
| `notes` | text | null, ≤ 2000; приватні, учень і батьки їх не бачать |
| `cancelled_by` | uuid | null, FK → `users.id`: хто поставив `cancelled` (репетитор або батьки) |
| `cancelled_at` | timestamptz | null |
| `created_at` | timestamptz | not null |

FK `(student_id, tutor_id)` → `students (id, tutor_id)`: заняття фізично не може належати учневі іншого репетитора. Індекси: `(tutor_id, starts_at)`, `(student_id)`. Зміна статусу з `cancelled` на інший очищає `cancelled_by` і `cancelled_at`.

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

### `student_links` — хто, крім репетитора, бачить картку

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | not null, FK → `users.id` |
| `student_id` | uuid | not null, FK → `students.id` `ON DELETE CASCADE` |
| `relation` | text | `CHECK (relation IN ('student','parent'))` |
| `created_at` | timestamptz | not null |

`unique (user_id, student_id)`; частковий унікальний індекс `uq_student_links_one_student_account (student_id) WHERE relation = 'student'` — у картки щонайбільше один акаунт учня, батьків може бути кілька. Один акаунт може бути прив'язаний до кількох карток, зокрема в різних репетиторів.

### `invites` — одноразові коди

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id`, `student_id` | uuid | FK `(student_id, tutor_id)` → `students (id, tutor_id)` `ON DELETE CASCADE` |
| `relation` | text | `student` \| `parent` |
| `code_hash` | text | unique; SHA-256 нормалізованого коду (сам код не зберігається) |
| `expires_at` | timestamptz | створення + 7 днів |
| `used_at`, `used_by` | timestamptz, uuid | null до використання |
| `created_at` | timestamptz | not null |

Код — 8 символів з алфавіту без `0/O/1/I/L`, показується як `XXXX-XXXX`; при введенні регістр і дефіси ігноруються.

### `homework_submissions` і `submission_photos`

| Колонка | Тип | Обмеження |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id`, `student_id` | uuid | FK `(student_id, tutor_id)` → `students` |
| `lesson_id` | uuid | **unique** (одна відповідь на заняття), FK → `lessons.id` `ON DELETE CASCADE` |
| `text` | text | null, ≤ 5000 |
| `status` | text | `submitted` \| `reviewed` |
| `feedback` | text | null, ≤ 2000 |
| `grade` | integer | null, `1..12` |
| `submitted_at` | timestamptz | not null |
| `reviewed_at` | timestamptz | null |

`submission_photos`: `id`, `submission_id` (FK `ON DELETE CASCADE`), `storage_key` (unique), `position`, `created_at`. До 5 фото на відповідь.

### Тести: `quizzes`, `quiz_questions`, `quiz_assignments`, `quiz_answers`

- `quizzes`: `id`, `tutor_id`, `title` (1–200), `description`, `created_at`, `updated_at`.
- `quiz_questions`: `quiz_id` (`ON DELETE CASCADE`), `position` (unique у межах тесту), `kind` (`single` \| `multiple` \| `text`), `prompt`, `points` (`1..100`), `options` JSONB (`[{"id": "1", "text": "..."}]`, для `text` — null), `correct_options` JSONB (`["1"]`), `reference_answer` (лише для `text`).
- `quiz_assignments`: `tutor_id`, `quiz_id`, `student_id` (складений FK на `students`), `status` (`assigned` → `submitted` \| `needs_review` → `graded`), `due_at`, `score` (null, доки не все оцінено), `max_score`, `submitted_at`, `graded_at`, `ai_claimed_at` (оренда оцінювача). Індекси: `(tutor_id, status)`, `(student_id)`, `(status, submitted_at)`.
- `quiz_answers`: `assignment_id` (`ON DELETE CASCADE`), `question_id`, `selected_options` JSONB, `text_answer`, `points` (null, доки не оцінено; `>= 0`), `feedback`, `graded_by` (`auto` \| `ai` \| `tutor`), `graded_at`; `unique (assignment_id, question_id)`.

Тест, який уже комусь призначено, змінити чи видалити не можна (`409 quiz_in_use`): відповіді посилаються на його питання.

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
- Усі ендпоінти, крім `GET /api/health`, `/api/internal/*` (токен оцінювача) і `/api/files/*` (підпис у URL, лише локально), вимагають валідний токен (інакше `401`). Ендпоінти репетитора працюють тільки з його даними, `/api/portal/*` — тільки з прив'язаними картками.

### Формат помилок

| Код | Коли | Тіло |
| --- | --- | --- |
| `401` | Немає токена або він невалідний | `{"detail": "invalid or missing token"}` |
| `403` | Роль не має доступу до ендпоінта або дії | `{"detail": "forbidden"}` |
| `404` | Запису з таким `id` немає **або він чужий / не прив'язаний** (відповідь однакова) | `{"detail": "not found"}`; для кодів — `{"detail": "invite_not_found"}` |
| `409` | Порушення бізнес-правила | `{"detail": "<code>"}`, коди нижче |
| `422` | Невалідне тіло, query або шлях (у т.ч. не-UUID у `{id}`); посилання на неіснуючого/чужого учня в тілі; доменні перевірки | Стандартний формат FastAPI: `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`; доменні — `{"detail": "<code>"}`: `student_not_found`, `unknown_question`, `wrong_answer_shape`, `points_above_maximum`, `points_out_of_range` |

Коди `409`:

| Код | Коли |
| --- | --- |
| `student_archived` | заняття або тест для архівного учня |
| `role_already_set` | `POST /api/me/role` для акаунта, який уже учень чи батьки |
| `tutor_only_setting` | `cancel_notice_hours` у `PATCH /api/me` не від репетитора |
| `role_conflict`, `already_linked`, `student_already_linked` | код запрошення не підходить цьому акаунту або картці |
| `lesson_not_planned`, `cancel_too_late` | скасування батьками |
| `no_homework`, `already_reviewed`, `bad_photo_key` | здача ДЗ |
| `quiz_in_use`, `not_submitted`, `already_submitted` | тести |

### Ізоляція даних

- Кожен запит до БД фільтрується за `tutor_id` поточного репетитора — у `services/`, не в роутерах.
- Чужий запис за `{id}` → `404`, так само як неіснуючий.
- `student_id` у тілі `POST /api/lessons` і `POST /api/payments` має належати поточному репетитору; інакше `422 {"detail": "student_not_found"}`. Додатковий захист — складені FK у БД.
- `tutor_id` ніколи не приймається від клієнта і ніколи не повертається.
- Учень і батьки бачать лише картки з `student_links`; чужа картка, заняття, ДЗ чи тест → `404`. Прибрана репетитором прив'язка одразу забирає доступ.
- Що приховано в порталі: `lessons.notes` (завжди), ціни, оплати й баланс (від учня), коментар до оплати (від усіх), правильні варіанти тесту (до здачі), еталонні відповіді (завжди).

---

### `GET /api/health`

Без автентифікації. **Не торкається БД** (щоб health check не будив Aurora).

- Відповідь `200`: `{"status": "ok"}`

### Профіль: `/api/me`

**`User`**: `id` uuid, `role` `"tutor"` \| `"student"` \| `"parent"` \| null, `email` string \| null (з claim, якщо є), `name` string \| null, `cancel_notice_hours` integer, `created_at` datetime.

| Метод і шлях | Запит | Відповідь | Помилки |
| --- | --- | --- | --- |
| `GET /api/me` | — | `200` `User`; створюється без ролі при першому виклику | `401` |
| `PATCH /api/me` | `name` string 1–200, `cancel_notice_hours` integer `0..168` (лише репетитор) | `200` `User` | `401`, `409 tutor_only_setting`, `422` |
| `POST /api/me/role` | `{"role": "tutor"}` — інших значень немає (`422`) | `200` `User`; повторний виклик репетитора теж `200` | `401`, `409 role_already_set` |

### Запрошення й доступи

Репетитор (усе в межах своєї картки, чужа → `404`):

| Метод і шлях | Запит | Відповідь |
| --- | --- | --- |
| `POST /api/students/{id}/invites` | `{"relation": "student" \| "parent"}` | `201` `{id, relation, expires_at, created_at, code}` — `code` лише тут; `409 student_already_linked`, якщо в картки вже є акаунт учня |
| `GET /api/students/{id}/invites` | — | `200` активні (невикористані, нестрочені) коди без самого коду |
| `DELETE /api/students/{id}/invites/{invite_id}` | — | `204` |
| `GET /api/students/{id}/links` | — | `200` `[{id, relation, user_name, user_email, created_at}]` |
| `DELETE /api/students/{id}/links/{link_id}` | — | `204`; акаунт втрачає доступ до картки, роль лишається |

Будь-який акаунт, крім репетитора: `POST /api/invites/redeem` `{"code": "K7PM-4XQR"}` → `200` `{student_id, student_full_name, relation}`. Перший код ставить роль. Помилки: `404 invite_not_found` (немає, використаний, прострочений, відкликаний), `409 role_conflict | already_linked | student_already_linked`.

### Портал учня й батьків: `/api/portal`

Роль `student` або `parent`, інакше `403`.

| Метод і шлях | Хто | Відповідь |
| --- | --- | --- |
| `GET /api/portal/students` | обидва | `[{id, full_name, subject, tutor_name, relation, archived, balance}]`; `balance` — лише батькам, учню `null` |
| `GET /api/portal/lessons` | обидва | query `from`, `to`, `student_id`; `PortalLesson[]` за `starts_at` |
| `GET /api/portal/lessons/{id}` | обидва | `PortalLesson` |
| `POST /api/portal/lessons/{id}/cancel` | батьки (учень → `403`) | `PortalLesson` зі статусом `cancelled`; `409 lesson_not_planned`, `409 cancel_too_late` |
| `GET /api/portal/payments` | батьки (учень → `403`) | query `student_id`, `from`, `to`; `[{id, student_id, student_full_name, amount, paid_at, method}]` |

**`PortalLesson`**: `id`, `student_id`, `student_full_name`, `tutor_name`, `starts_at`, `duration_minutes`, `status`, `topic`, `homework`, `price` (лише батькам), `cancelled_at`, `cancelled_by_role`, `can_cancel` (для поточного користувача), `cancel_deadline`. Поля `notes` немає.

**Правило скасування:** лише `planned`, лише батьки, і не пізніше `starts_at − cancel_notice_hours` репетитора (за замовчуванням 24 год). Пізніше скасувати може тільки репетитор через `PATCH /api/lessons/{id}/status`. Скасоване заняття на баланс не впливає. Репетитор бачить у `Lesson` поля `cancelled_at` і `cancelled_by_role` (`tutor` \| `parent`).

### Домашні завдання

Учень (батьки на запис → `403`; заняття без `homework` → `409 no_homework`; після перевірки → `409 already_reviewed`):

| Метод і шлях | Запит | Відповідь |
| --- | --- | --- |
| `POST /api/portal/lessons/{id}/homework/uploads` | `{content_type: "image/jpeg" \| "image/png" \| "image/heic", size_bytes: 1..10485760}` | `{url, fields, key, expires_at}` — браузер шле файл `multipart/form-data` на `url`: усі `fields`, потім `file`. Посилання діє 15 хвилин. |
| `PUT /api/portal/lessons/{id}/homework` | `{text?: string ≤ 5000, photo_keys?: string[] ≤ 5}` (хоч щось одне) | `200` `Homework`; замінює попередню відповідь, доки репетитор не перевірив; чужий ключ → `409 bad_photo_key` |
| `GET /api/portal/lessons/{id}/homework` | учень і батьки | `200` `Homework` або `404`, якщо ще не здано |

Репетитор: `GET /api/homework?status=submitted&student_id=` (черга, від найстарішої), `GET /api/homework/{id}`, `PATCH /api/homework/{id}/review` `{feedback?: string ≤ 2000, grade?: 1..12}` (хоч щось одне) → статус `reviewed`.

**`Homework`**: `id`, `lesson_id`, `lesson_starts_at`, `task` (текст ДЗ із заняття), `student_id`, `student_full_name`, `text`, `photos: [{key, url}]` (`url` — тимчасове, 15 хвилин), `status`, `feedback`, `grade`, `submitted_at`, `reviewed_at`.

Локально (лише `STORAGE_BACKEND=local`) завантаження й видача йдуть через `POST /api/files/upload` і `GET /api/files/{key}?expires=&signature=` — HMAC-підпис замість токена, як у presigned S3. У хмарі цих ендпоінтів немає (`404`), браузер працює з S3 напряму.

### Тести (квізи)

Репетитор:

| Метод і шлях | Що робить |
| --- | --- |
| `GET /api/quizzes`, `POST /api/quizzes` | список (`question_count`, `max_score`, `assignment_count`) і створення |
| `GET`, `PUT`, `DELETE /api/quizzes/{id}` | читання (з правильними відповідями й еталонами), заміна, видалення; змінювати й видаляти — лише поки не призначено (`409 quiz_in_use`) |
| `POST /api/quizzes/{id}/assignments` | `{student_id, due_at?}` → `201` `Assignment`; чужий учень → `422 student_not_found`, архівний → `409 student_archived` |
| `GET /api/quiz-assignments?student_id=&status=` | `?status=needs_review` — черга письмових відповідей для репетитора |
| `GET`, `DELETE /api/quiz-assignments/{id}` | деталі з відповідями й балами; видалення призначення |
| `PATCH /api/quiz-assignments/{id}/answers/{question_id}` | `{points: 0..max, feedback?}` — поставити або змінити бали будь-якої відповіді; `409 not_submitted`, `422 points_above_maximum` |

**`QuizIn`**: `title` 1–200, `description?` ≤ 2000, `questions` 1–50. Питання: `kind`, `prompt` 1–2000, `points` 1–100 (default 1); для `single`/`multiple` — `options: [{text, correct}]` (2–10; `single` — рівно один правильний, `multiple` — хоча б один); для `text` — `reference_answer` 1–2000 і без `options`. Id варіантів — `"1"`, `"2"`, … у порядку подання.

Учень і батьки: `GET /api/portal/quiz-assignments?student_id=`, `GET /api/portal/quiz-assignments/{id}`. Здає лише учень: `POST /api/portal/quiz-assignments/{id}/submit` `{answers: [{question_id, selected_options?, text_answer? ≤ 2000}]}` — один раз (`409 already_submitted`), батьки → `403`.

**Оцінювання при здачі:**
- `single` / `multiple` — повні бали лише за точно правильний набір, інакше 0 (`graded_by = auto`);
- порожня письмова відповідь — 0 одразу;
- непорожня письмова — статус `submitted`, чекає на ШІ-оцінювача; при `AI_GRADER=off` — `needs_review`, чекає на репетитора;
- коли бали є в усіх відповідей — `graded`, `score` = сума.

Учню й батькам правильні варіанти показуються лише після здачі, еталонні відповіді — ніколи.

### ШІ-оцінювач: `/api/internal/grading`

Лише для Lambda оцінювача; заголовок `X-Grader-Token` (порівняння за сталий час). Без налаштованого `GRADER_TOKEN` — `404`, з неправильним — `401`.

| Метод і шлях | Що робить |
| --- | --- |
| `POST /api/internal/grading/claim?limit=1..20` | Орендує на 5 хвилин найстаріші `submitted` тести, які ніхто не тримає, і віддає їхні неоцінені письмові відповіді: `[{assignment_id, quiz_title, questions: [{question_id, prompt, reference_answer, max_points, answer}]}]`. Два запуски одночасно не отримають той самий тест — двічі не платимо. |
| `POST /api/internal/grading/{id}/result` | `{model, results: [{question_id, points, feedback?}]}`; бали `0..max` (`422 points_out_of_range`). Відповіді без балів ідуть репетитору (`needs_review`). Тест, що вже не чекає на оцінювача → `404 not_waiting_for_grader`. |
| `POST /api/internal/grading/{id}/failed` | Відмова моделі чи помилка → `needs_review`. |

Оцінювач не повторює невдалі спроби: будь-яка помилка передає тест репетитору, тож зламана модель чи промпт не можуть витрачати гроші в циклі.

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
| `homework_to_review` | integer | ДЗ зі статусом `submitted` |
| `quizzes_to_review` | integer | Тести зі статусом `needs_review` |

`Debtor`: `student_id` string (uuid), `full_name` string, `balance` integer (від'ємний), `archived` boolean.

- Помилки: `401`, `403`.

## `frontend/`

Навіщо: односторінковий кабінет українською для трьох ролей.

- **Вхід.** Після входу `App.tsx` завантажує `GET /api/me` і обирає кабінет за роллю. Якщо `role` = `null`, показується `RoleChoicePage`: «Я репетитор» або код запрошення.
- **Репетитор:** дашборд (з лічильниками перевірки), учні, заняття, оплати, `/homework` (черга ДЗ), `/quizzes` (конструктор тестів, призначення), `/quiz-assignments/<id>` (відповіді й ручні бали); у картці учня — вкладка «Доступ учня й батьків» (`StudentAccessPanel`).
- **Учень і батьки** (`src/pages/portal/`): головна, `/schedule` (скасування для батьків), `/homework` і `/lessons/<id>/homework` (здача з фото — лише учень), `/quizzes` і `/quizzes/<id>` (проходження — лише учень), `/payments` (лише батьки).
- **Звідки береться токен** знає лише `src/auth/session.ts` (`useSession()`): справжній Cognito через `react-oidc-context` або демо-вхід. `VITE_DEV_LOGIN=true` (є лише в `frontend/.env.development`, тобто тільки в `npm run dev`) показує три кнопки входу в seed-акаунти; backend приймає `Bearer dev:<sub>` лише з `DEV_AUTH=on`.

Чого ще немає: налаштувань профілю (ім'я, `cancel_notice_hours`) і редагування тесту до призначення.

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

`name: tutor-cabinet`. Два сервіси, іменовані томи `pgdata` (база) і `uploads` (фото ДЗ, змонтований у backend як `/data/uploads`).

| Сервіс | Образ / build | Порт | Залежить від | Готовність (healthcheck) |
| --- | --- | --- | --- | --- |
| `postgres` | `postgres:16`; `POSTGRES_USER=tutor`, `POSTGRES_PASSWORD=tutor`, `POSTGRES_DB=tutor_cabinet`; том `pgdata:/var/lib/postgresql/data` | `5432` лише всередині мережі compose (на хост не публікується) | — | `pg_isready -U tutor -d tutor_cabinet`; `interval: 5s`, `timeout: 3s`, `retries: 12` |
| `backend` | `build: ./backend` (`Dockerfile`, `python:3.12-slim`); змінні з таблиці «Змінні середовища backend»; `COGNITO_AUTHORITY`/`COGNITO_CLIENT_ID` беруться з оточення shell або `.env`, а до створення пулу мають заглушки (тоді всі захищені ендпоінти відповідають `401`) | `8000:8000` | `postgres` з `condition: service_healthy` | `python -c` з `urllib.request.urlopen("http://127.0.0.1:8000/api/health")`; `interval: 5s`, `timeout: 3s`, `retries: 12`, `start_period: 10s`. Стає healthy лише після `alembic upgrade head` і старту Uvicorn. |

Backend з'єднується з базою за хостом `postgres`. Тестова база `tutor_cabinet_test` живе в тому самому контейнері; її створює `tests/conftest.py`. Оцінювач локально — не сервіс, а разовий `make grade` (контейнер з образу backend, звертається до `http://backend:8000`).

## `infra/`

Навіщо: уся хмарна інфраструктура як код. Terraform, **одна root module**, без підмодулів. State і запуски — у HCP Terraform workspace в режимі **remote execution**; змінні й AWS-доступ задаються у workspace. `terraform apply` виконується тільки в HCP Terraform після мержу — у Makefile його немає. Поки тільки опис файлів.

| Файл | Що описує |
| --- | --- |
| `versions.tf` | `required_version >= 1.10`; блок `cloud` (організація команди, workspace `tutor-cabinet`); провайдер `hashicorp/aws ~> 6.0`, регіон `var.region`; `default_tags { PROJECT_NAME = var.project_name, ManagedBy = "terraform" }` — тег на всіх ресурсах. |
| `variables.tf` | `region` (default `us-east-1`), `project_name` (default `tutor-cabinet`), `domain_prefix` (Cognito), `google_client_id`, `google_client_secret` (sensitive), `db_password` (sensitive), `github_repository` (`owner/name`), `backend_image_tag` (тег першого образу; далі образ оновлює деплой). Значень у репозиторії немає — вони у змінних workspace. |
| `network.tf` | Власний VPC; дві приватні підмережі у двох AZ (вимога DB subnet group); без Internet Gateway, без NAT, без VPC endpoints — API Lambda не викликає AWS API (presigned URL для S3 підписуються локально, а Bedrock кличе інша Lambda поза VPC). Security groups: `lambda` (egress лише 5432 до `db`), `db` (ingress 5432 лише від `lambda`). |
| `database.tf` | DB subnet group; Aurora PostgreSQL 16 cluster, Serverless v2 `min_capacity = 0`, `max_capacity = 1`, auto-pause; один інстанс `db.serverless`; шифрування сховища; бекапи 7 днів; фінальний snapshot при видаленні; master-пароль з `var.db_password`. |
| `api.tf` | ECR-репозиторій бекенду (теги `IMMUTABLE`, бо тег = commit SHA); IAM-роль Lambda з `AWSLambdaVPCAccessExecutionRole`; CloudWatch log group (14 днів); Lambda `package_type = "Image"`, `linux/amd64` (x86_64), 512 MB, timeout 30 s, `vpc_config` з підмережами й SG `lambda`; env `DATABASE_URL`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `CORS_ORIGINS`, `COGNITO_JWKS` (початково `{"keys":[]}`), `STORAGE_BACKEND=s3`, `UPLOADS_BUCKET`, `GRADER_TOKEN`, `AI_GRADER`; роль має `s3:PutObject`/`s3:GetObject` на `homework/*` бакета фото (без цього presigned URL підписуються, але S3 їх відхиляє); `lifecycle.ignore_changes` на `image_uri` і `COGNITO_JWKS`, бо їх оновлює деплой; function URL з `authorization_type = "NONE"` (автентифікацію робить застосунок) і **без** блоку `cors` (CORS робить FastAPI — один механізм локально і в хмарі). |
| `uploads.tf` | Приватний S3-бакет фото ДЗ: block public access, шифрування SSE-S3, CORS лише для домену сайту (`POST` для завантаження, `GET` для перегляду), без версіонування. Обмеження типу й розміру задає presigned POST (`Content-Type`, `content-length-range` до 10 МБ). |
| `grader.tf` | Lambda оцінювача з того самого ECR-образу (`image_config.command = ["app.grader.lambda_handler.handler"]`), **без `vpc_config`** (має інтернет без NAT), 256 MB, timeout 120 s, без reserved concurrency (на нових акаунтах загальний ліміт буває 10 і резерв не застосується; від подвійного оцінювання захищає оренда); env `API_URL` (function URL API), `GRADER_TOKEN`, `GRADER=bedrock`, `GRADER_MODEL=anthropic.claude-haiku-5-5`. Роль: логи + `bedrock-mantle:CreateInference` лише на цю модель. EventBridge Scheduler раз на хвилину (у межах безкоштовного ліміту). `aws_budgets_budget` на $1 за Bedrock і AWS Marketplace з e-mail-алертом — перші два бюджети безкоштовні. `GRADER_TOKEN` — `random_password` у state HCP. |
| `site.tf` | Приватний S3-бакет (block public access, без website hosting); CloudFront distribution з Origin Access Control; bucket policy дозволяє `s3:GetObject` лише цій distribution; `default_root_object = "index.html"`; 403/404 → `/index.html` з кодом 200 для SPA-маршрутів; `PriceClass_100`; сертифікат CloudFront за замовчуванням. |
| `auth.tf` | Cognito user pool (email як username, автоверифікація email, self sign-up); Google identity provider; публічний web-клієнт (code flow, PKCE, без секрету, scopes `openid email profile`, callback/logout — домен CloudFront і `http://localhost:5173/`); домен managed login версії 2 і branding. |
| `ci.tf` | GitHub OIDC provider (`token.actions.githubusercontent.com`); IAM-роль деплою з довірою лише для `repo:${var.github_repository}:ref:refs/heads/main`. Права: push у ECR-репозиторій бекенду; `lambda:GetFunctionConfiguration`, `UpdateFunctionConfiguration`, `UpdateFunctionCode`, `InvokeFunction` на функцію бекенду; `s3:ListBucket`/`PutObject`/`DeleteObject` на бакет сайту; `cloudfront:CreateInvalidation` на distribution. Довготривалих ключів немає. |
| `outputs.tf` | `site_url`, `api_url`, `cognito_authority`, `cognito_client_id`, `cognito_domain`, `ecr_repository_url`, `lambda_function_name`, `grader_function_name`, `uploads_bucket`, `frontend_bucket`, `cloudfront_distribution_id`, `deploy_role_arn`. Імена збігаються зі змінними Makefile. Деплой оновлює код обох Lambda тим самим образом. |

### Цільова схема в AWS (us-east-1)

```text
браузер ──HTTPS──▶ CloudFront (OAC) ──▶ S3 (приватний): статичний фронтенд
   │
   ├──OIDC code+PKCE──▶ Cognito managed login (email+пароль, Google)
   │
   ├──HTTPS + Bearer──▶ Lambda function URL ──▶ API Lambda (FastAPI + Mangum, образ з ECR)
   │                          ▲                     │  у VPC, приватні підмережі, без NAT
   │                          │                     └──5432──▶ Aurora Serverless v2 PostgreSQL (0–1 ACU)
   │                          │ X-Grader-Token
   │                          │
   │             Lambda оцінювача (той самий образ, поза VPC) ◀── EventBridge Scheduler, раз на хвилину
   │                          └──HTTPS──▶ Amazon Bedrock: Claude Haiku 5.5
   │
   └──presigned POST / GET──▶ S3 (приватний): фото ДЗ
```

Чому оцінювач поза VPC: API Lambda без NAT і без VPC endpoints не може дістатися до Bedrock, а NAT (~$33/міс) чи interface endpoint (~$7/міс за AZ) мають погодинну оплату. Lambda поза VPC має інтернет безкоштовно; бази вона не бачить і працює лише через `/api/internal/grading` (ADR 0008).

Наслідок `min_capacity = 0`: після простою перший запит чекає, поки Aurora прокинеться (порядку 15 секунд). Фронтенд показує стан завантаження і не вважає це помилкою; timeout Lambda 30 s.

## Makefile

Навіщо: єдиний рецепт деплою й локальних перевірок. `terraform apply` тут немає.

**Зараз реалізовано** лише локальні цілі; усі вони виконуються в образі backend (`docker compose run --rm --build backend ...`), тож локально потрібен тільки Docker:

| Ціль | Що робить |
| --- | --- |
| `lint` | `lint-frontend`, потім `ruff check .` і `ruff format --check .` |
| `test` | `pytest` (compose підніме й дочекається `postgres`) |
| `seed` | `python -m app.seed --tutor-sub "$(TUTOR_SUB)"`, `TUTOR_SUB` default `local-dev` |
| `migrate-local` | `alembic upgrade head` на локальній базі (backend і так мігрує при старті; ціль — для нової ревізії, поки він працює) |
| `grade` | Один прохід оцінювача проти запущеного `docker compose up`. `GRADER=fake` (default, безкоштовно) або `GRADER=bedrock` (Claude Haiku 5.5 з локальними AWS-креденшелами: монтує `~/.aws`, передає `AWS_PROFILE`; частки цента за тест). |
| `lint-frontend` | `npm ci`, `npm run lint`, `npm run format:check` у `frontend/`; `lint` залежить від неї. |

Цілі деплою нижче з'являться разом з `infra/`; тоді CI викликатиме ці ж цілі й не дублюватиме їхніх команд.

Змінні деплою за замовчуванням читаються з `terraform -chdir=infra output -raw <name>` (локально, після `terraform login`); у CI вони задаються явно з repository variables GitHub. AWS-доступ дає викликач (локальний профіль або OIDC-роль у CI) — у Makefile ключів немає.

| Ціль | Потрібні змінні | Що робить |
| --- | --- | --- |
| `deploy-backend` | `ECR_REPOSITORY_URL`, `LAMBDA_FUNCTION_NAME`, `GRADER_FUNCTION_NAME`, `COGNITO_AUTHORITY`; `IMAGE_TAG` (default — повний `git rev-parse HEAD`), `AWS_REGION` (default `us-east-1`) | Відмовляється при брудному робочому дереві. Логін у ECR. Якщо образу з тегом `IMAGE_TAG` ще нема — `docker buildx build -f backend/Dockerfile.lambda --platform linux/amd64 --provenance=false` і push. Завантажує `${COGNITO_AUTHORITY}/.well-known/jwks.json`, записує його в `COGNITO_JWKS`, зберігаючи решту змінних функції; чекає `function-updated`. Оновлює код обох функцій (API й оцінювача) на `<repo>:<IMAGE_TAG>`; чекає `function-updated`. |
| `migrate` | `LAMBDA_FUNCTION_NAME`, `AWS_REGION` | `aws lambda invoke` з payload `{"action": "migrate"}`; падає, якщо у відповіді є `FunctionError` або немає `"migrated": true`. |
| `deploy-frontend` | `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `API_URL`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN` | `npm ci` і `npm run build` з `VITE_*`; `aws s3 sync frontend/dist/` з `--delete` (хешовані assets — `max-age=31536000, immutable`, `index.html` — `no-cache`); інвалідація CloudFront `/*`. |
| `infra-plan` | `terraform login` у HCP | `terraform -chdir=infra fmt -check`, `init`, `validate`, `plan` (план виконується віддалено в HCP Terraform). |

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
| `0007-roles-and-invite-codes.md` | Три ролі, одна на акаунт; учні й батьки отримують роль і доступ через одноразовий код, а не за email (у access token Cognito немає email). |
| `0008-ai-grading-outside-the-vpc.md` | Оцінювач — окрема Lambda поза VPC з Claude Haiku 5.5 на Bedrock; без NAT і endpoints; оренда завдань і «без повторів» як захист від витрат. |
| `0009-homework-photos-presigned.md` | Фото ДЗ напряму в S3 через presigned URL, підписані локально; локально — том і HMAC-посилання замість MinIO. |

Файли `0001`–`0006` ще не написані; `0007`–`0009` є.

## README.md

Навіщо: перша сторінка для нової людини в репозиторії. Розділи:

1. **Що це** — 3–4 речення про продукт з першого абзацу цього документа.
2. **Локальний запуск** — встановити Docker Desktop, `docker compose up`, API на `http://localhost:8000`, перевірка `curl http://localhost:8000/api/health`. Фронтенд — `cd frontend && npm ci && npm run dev`. `make seed TUTOR_SUB=...` для демо-даних (з акаунтами учня й батьків); як дізнатися свій `sub`. `make grade`, `make lint`, `make test`.
3. **Деплой** — звичайний шлях: мерж у `main`, далі все робить `deploy.yml`. Ручний шлях: ті самі цілі Makefile з локальними AWS-креденшелами. Інфраструктура: PR зі змінами в `infra/` → `make infra-plan` → apply у HCP Terraform після мержу.
4. **Перше розгортання** — порядок bootstrap: змінні workspace → перший apply створює ECR (Lambda потребує вже наявного образу, тому перший apply йде з `-target` на ECR-репозиторій) → `make deploy-backend`-ом push образу з тегом у `backend_image_tag` → повний apply → заповнити repository variables з `terraform output` → `make migrate`.
5. **Посилання** — `PROJECT.md`, `docs/adr/`.

## Відкриті питання

- **Email користувача.** Access token Cognito не містить `email`, а API Lambda без інтернету не може викликати `/oauth2/userInfo`, тож `users.email` на практиці порожній. Ім'я тепер задається через `PATCH /api/me`. Якщо email знадобиться репетитору (наприклад, у списку прив'язаних акаунтів) — pre-token-generation trigger у Cognito, окремим ADR.
- **Чи покривають кредити AWS Claude на Bedrock.** Моделі Anthropic на Bedrock продаються через AWS Marketplace, а промокредити офіційно на Marketplace не поширюються; відгуки користувачів суперечливі. Тому: бюджет $1 з алертом, перевірка Cost Explorer після першого справжнього оцінювання і вимикач `AI_GRADER=off` / `GRADER=off`. Доступ до `anthropic.claude-haiku-5-5` може вимагати увімкнення в консолі Bedrock (Model access).
- **Незавершені завантаження фото.** Файл, який завантажили, але не здали в ДЗ, лишається в S3. Обсяг малий (до 10 МБ на файл); якщо стане помітно — щоденне прибирання ключів без рядка в `submission_photos`.
- **Демо-вхід** (`DEV_AUTH`, `VITE_DEV_LOGIN`) — лише для локального перегляду. Обидва перемикачі вимкнені за замовчуванням; в AWS backend з `DEV_AUTH=on` не стартує.
