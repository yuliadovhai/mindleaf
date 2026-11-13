# tutor-cabinet

Кабінет для репетиторів, які працюють самі на себе. Репетитор реєструється, веде список учнів, планує заняття, відмічає проведені й записує оплати, а система рахує, хто скільки винен. Учні й батьки входу не мають.

Інтерфейс українською, гроші в гривнях (в API і в базі — цілі копійки), час — `Europe/Kyiv`.

Структура репозиторію і контракти між частинами описані в [PROJECT.md](PROJECT.md). Зараз у репозиторії є backend, локальне оточення і CI для backend. `frontend/` і `infra/` поки що існують тільки як опис.

## Локальний запуск

Потрібен лише Docker Desktop (або Docker Engine з Compose v2).

```sh
docker compose up --build
```

Ця команда піднімає PostgreSQL 16, чекає, поки база буде готова, накочує міграції Alembic і запускає API на http://localhost:8000.

- Перевірка: `curl http://localhost:8000/api/health` → `{"status":"ok"}`
- Документація ендпоінтів (Swagger UI): http://localhost:8000/docs

Усі ендпоінти, крім `/api/health`, вимагають `Authorization: Bearer <Cognito access token>`. Поки Cognito-пул не створено (`infra/`), вони відповідають `401`. Коли пул з'явиться, вистачить передати його значення:

```sh
COGNITO_AUTHORITY=https://cognito-idp.us-east-1.amazonaws.com/<pool_id> \
COGNITO_CLIENT_ID=<client_id> \
docker compose up --build
```

(або записати ці дві змінні в `.env` у корені — compose підхопить їх сам).

### Команди

Усі цілі виконуються в образі backend, тому локальний Python не потрібен.

| Команда | Що робить |
| --- | --- |
| `make lint` | `ruff check` і `ruff format --check` |
| `make test` | `pytest` проти PostgreSQL з compose (окрема база `tutor_cabinet_test`) |
| `make seed` | Демо-дані: репетитор `local-dev`, 3 учні, заняття на поточний тиждень, оплати, боржник. Повторний запуск оновлює дані лише цього репетитора. |
| `make seed TUTOR_SUB=<sub>` | Те саме, але для вашого Cognito `sub`, щоб побачити демо-дані після входу |
| `make migrate-local` | `alembic upgrade head` на локальній базі (backend і так мігрує при старті) |

Почати з чистої бази: `docker compose down -v`.

## Як влаштовано backend

```text
backend/app/
├── api/        роутери: розбір запиту → виклик сервісу → відповідь
├── services/   бізнес-логіка: баланс, дашборд, ізоляція за tutor_id
├── models/     ORM (SQLAlchemy 2.x)
├── schemas/    Pydantic v2: тіла запитів і відповідей
├── auth/       перевірка Cognito access token, get_current_tutor
├── db.py, settings.py
└── lambda_handler.py   Mangum для HTTP; {"action": "migrate"} → alembic upgrade head
```

- **Баланс учня** = сума оплат − сума `price` занять зі статусом `done`. Від'ємний баланс означає борг. Баланс не зберігається, а рахується в `services/balances.py`.
- **Ізоляція.** Кожен запит фільтрується за поточним репетитором. Чужий запис повертає `404`, а заняття чи оплата для чужого учня — `422 student_not_found`. Додатковий захист на рівні БД — складені FK `(student_id, tutor_id)`.
- **Нова міграція:** `docker compose run --rm -v "$PWD/backend:/app" backend alembic revision -m "..."`. Модель і міграції не повинні розходитися — `alembic check` має казати «No new upgrade operations detected».

## CI

`.github/workflows/backend.yml` на кожен push запускає `ruff check`, `ruff format --check` і `pytest` з PostgreSQL 16 як service container.

## Деплой

Ще не реалізовано. Цільова схема — AWS us-east-1: фронтенд у приватному S3 за CloudFront, backend — цей самий FastAPI як Lambda container image (`backend/Dockerfile.lambda`) з function URL у VPC поруч з Aurora Serverless v2, автентифікація через Cognito, деплой з GitHub Actions через OIDC-роль. Інфраструктуру, цілі Makefile і порядок першого розгортання описано в [PROJECT.md](PROJECT.md#infra); вони з'являться разом з `infra/` і `frontend/`.
