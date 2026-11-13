# tutor-cabinet

Кабінет для репетиторів, які працюють самі на себе. Репетитор реєструється, веде список учнів, планує заняття, відмічає проведені й записує оплати, а система рахує, хто скільки винен. Репетитор також задає домашні завдання й тести.

Профілів три: **репетитор**, **учень** і **батьки**. Учень і батьки входять за одноразовим кодом, який репетитор видає в картці учня:
- **учень** бачить розклад, здає ДЗ (текст і фото) і проходить тести;
- **батьки** бачать те саме, а також оплати й баланс, і можуть скасувати заняття не пізніше ніж за 24 години (цей строк налаштовує репетитор).

Тести з варіантами відповідей перевіряються одразу. Письмові відповіді оцінює Claude Haiku 5.5 (Amazon Bedrock), а репетитор може змінити будь-яку оцінку.

Інтерфейс українською, гроші в гривнях (в API і в базі — цілі копійки), час — `Europe/Kyiv`.

Структура репозиторію і контракти між частинами описані в [PROJECT.md](PROJECT.md). Зараз у репозиторії є backend, frontend і локальне оточення. `infra/` поки що існує тільки як опис.

> **Фронтенд поки вміє лише кабінет репетитора.** Екранів вибору ролі, коду запрошення, порталу учня й батьків, ДЗ і тестів ще немає (перелік — у [PROJECT.md → frontend](PROJECT.md#frontend)). Новий акаунт без ролі отримує `403` на сторінках репетитора, доки не викличе `POST /api/me/role`.

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
| `make lint` | `ruff check`, `ruff format --check` (backend) + ESLint і Prettier (frontend) |
| `make test` | `pytest` проти PostgreSQL з compose (окрема база `tutor_cabinet_test`) |
| `make seed` | Демо-дані: репетитор `local-dev`, 3 учні, заняття на поточний тиждень, оплати, боржник. Для першої учениці — акаунти `local-dev-student` і `local-dev-parent`, ДЗ на перевірці й тест, який чекає на оцінювача. Повторний запуск оновлює дані лише цього репетитора. |
| `make seed TUTOR_SUB=<sub>` | Те саме, але для вашого Cognito `sub`, щоб побачити демо-дані після входу |
| `make migrate-local` | `alembic upgrade head` на локальній базі (backend і так мігрує при старті) |
| `make grade` | Один прохід ШІ-оцінювача проти запущеного backend. За замовчуванням `GRADER=fake`: безкоштовно, бали за збігом слів з еталоном. |
| `make grade GRADER=bedrock` | Справжній Claude Haiku 5.5 з вашими AWS-креденшелами (`~/.aws`, `AWS_PROFILE`); частки цента за тест. Може знадобитися увімкнути модель у консолі Bedrock → Model access. |

Почати з чистої бази: `docker compose down -v`.

## Локальний запуск фронтенду

Потрібен Node.js 20. Фронтенд запускається окремо від compose.

```sh
cd frontend
npm ci
npm run dev
```

Відкрийте http://localhost:5173. Для входу потрібен Cognito-пул — задайте змінні збірки в `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000
VITE_COGNITO_AUTHORITY=https://cognito-idp.us-east-1.amazonaws.com/<pool_id>
VITE_COGNITO_CLIENT_ID=<client_id>
VITE_COGNITO_DOMAIN=https://<domain>.auth.us-east-1.amazoncognito.com
```

Поки пулу немає — фронтенд покаже сторінку входу, але кнопка «Увійти» нікуди не переведе.

| Команда | Що робить |
| --- | --- |
| `npm run dev` | Vite dev-сервер на http://localhost:5173 |
| `npm run build` | TypeScript + Vite production-збірка в `dist/` |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier перевірка форматування |

## Як влаштовано backend

```text
backend/app/
├── api/        роутери: розбір запиту → виклик сервісу → відповідь
├── services/   бізнес-логіка: баланс, дашборд, доступи, ДЗ, тести, ізоляція
├── models/     ORM (SQLAlchemy 2.x)
├── schemas/    Pydantic v2: тіла запитів і відповідей
├── auth/       перевірка Cognito access token; get_current_tutor / get_current_member
├── grader/     ШІ-оцінювач: окрема Lambda поза VPC, без доступу до бази
├── storage.py  фото ДЗ: presigned S3 у хмарі, том + підписані посилання локально
├── db.py, settings.py
└── lambda_handler.py   Mangum для HTTP; {"action": "migrate"} → alembic upgrade head
```

- **Баланс учня** = сума оплат − сума `price` занять зі статусом `done`. Від'ємний баланс означає борг. Баланс не зберігається, а рахується в `services/balances.py`.
- **Ролі.** Новий акаунт не має ролі. Репетитор обирає її сам (`POST /api/me/role`), учень і батьки отримують з першого коду (`POST /api/invites/redeem`). Ендпоінт чужої ролі повертає `403`.
- **Ізоляція.** Запити репетитора фільтруються за ним самим, запити учня й батьків — за прив'язаними картками. Чужий запис повертає `404`, а заняття, оплата чи тест для чужого учня — `422 student_not_found`. Додатковий захист на рівні БД — складені FK `(student_id, tutor_id)`.
- **ШІ-оцінювач** забирає письмові відповіді через `/api/internal/grading` (секретний заголовок), оцінює їх і повертає бали. Будь-яка помилка передає тест репетитору без повторної спроби, тож зламана модель не витрачає гроші в циклі.
- **Нова міграція:** `docker compose run --rm -v "$PWD/backend:/app" backend alembic revision -m "..."`. Модель і міграції не повинні розходитися — `alembic check` має казати «No new upgrade operations detected».

## CI

`.github/workflows/backend.yml` на кожен push запускає `ruff check`, `ruff format --check` і `pytest` з PostgreSQL 16 як service container.

## Деплой

Ще не реалізовано. Цільова схема — AWS us-east-1 без погодинних платежів:
- фронтенд у приватному S3 за CloudFront;
- backend — цей самий FastAPI як Lambda container image (`backend/Dockerfile.lambda`) з function URL у VPC поруч з Aurora Serverless v2;
- ШІ-оцінювач — той самий образ окремою Lambda поза VPC, раз на хвилину через EventBridge Scheduler;
- фото ДЗ — у приватному S3;
- автентифікація через Cognito, деплой з GitHub Actions через OIDC-роль. Інфраструктуру, цілі Makefile і порядок першого розгортання описано в [PROJECT.md](PROJECT.md#infra); вони з'являться разом з `infra/`.
