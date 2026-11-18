# MindLeaf (tutor-cabinet) — repository structure and contracts

`tutor-cabinet` is the monorepo of MindLeaf, a cabinet for a self-employed tutor. The tutor signs up, keeps a list of students, plans lessons, marks the ones held and records payments; the system calculates who owes how much. The tutor also assigns homework and quizzes.

There are three profiles: **tutor**, **student** and **parent**. Students and parents sign in with an invite code from the tutor and see only the cards they are linked to: a student sees the schedule, homework and quizzes (hands in homework as text and photos, takes quizzes); a parent sees the same plus payments and the balance, and can cancel a lesson no later than N hours before it (N is set by the tutor, 24 by default).

This document records the **repository structure and the contracts between its parts**: what lives in each folder and what data flows between the frontend, the backend, the database and AWS. There is no implementation code here. If the implementation diverges from this document, either the implementation or the document (together with an ADR) is corrected — but never silently.

> **Current state.** The prototype is deployed on Render (see [`infra/README.md`](infra/README.md)). Sections that describe AWS (Lambda, Aurora, S3, CloudFront, Terraform, the deploy Makefile targets and `deploy.yml`) describe the **target production setup, which is not implemented yet**. Features added after this document was first written — meeting links, Telegram reminders, sign-in with Google, promo codes, the privacy page — are described in [`README.md`](README.md) and [`infra/README.md`](infra/README.md).

The approaches to the backend structure, `lambda_handler`, Cognito, Terraform, the Makefile and CI were taken from the Peach lab repository (`../lab2/Peach`). Spry's functionality (meetings, reports, the LLM parser) is not carried over here.

## Fixed product constraints

| What | Value |
| --- | --- |
| UI language | Ukrainian |
| Currency | hryvnia; **all amounts are integers in kopecks** (`int`), in JSON and in the DB. Only the frontend shows hryvnias with kopecks. |
| Time zone | `Europe/Kyiv`. "Today", "the current month" and day boundaries are computed in it. Time is stored in the DB as `timestamptz`. |
| Users | tutor, student, parent; one role per account, forever. A tutor sees only their own data; students and parents see only the cards they are linked to. |
| Plans | only the tutor pays. **Free:** up to 3 active students, no AI. **Pro:** 199 UAH/month or 1990 UAH/year, unlimited students, AI grading and quiz generation. Subscription via LiqPay with automatic renewal. When Pro has ended and there are more than 3 active students, the tutor's cabinet becomes read-only (archiving students is still allowed). Students and parents do not notice the plan. |
| Cost | the AWS infrastructure has no hourly charges: no NAT, no VPC endpoints, no Secrets Manager. We pay only for usage (Lambda, Aurora at 0 ACU when idle, S3, Claude tokens), which the account credits cover. |

## What the repository does not and will not contain

Redis, queues, nginx, ALB, ECS/Fargate, Kubernetes, a separate auth service, NAT Gateway, VPC endpoints, Secrets Manager, MinIO. Locally — only PostgreSQL and the backend (homework photos live on a docker volume). In the cloud — S3 + CloudFront for the site, a private S3 bucket for homework photos, two Lambdas from one image (the API inside the VPC and the AI grader outside it), EventBridge Scheduler for the grader, Aurora, Cognito, Claude Haiku 5.5 on Amazon Bedrock, ECR and an IAM role for CI.

## Repository tree

The tree as originally planned; the current repository additionally has migrations `0010`–`0012`, the Telegram and reminder modules, `infra/render.yaml` + `infra/README.md` instead of the Terraform files, and `docs/screenshots/`.

```text
tutor-cabinet/
├── .github/
│   └── workflows/
│       └── backend.yml            # ci.yml and deploy.yml are added together with frontend/ and infra/
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
│   │       ├── 0006_quizzes.py
│   │       ├── 0007_materials.py
│   │       ├── 0008_homework_assignments.py
│   │       └── 0009_quiz_drafts_and_generation.py
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
│   │   │   ├── generators.py
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
│   │   │   ├── access.py          # invite codes and links (tutor) + redeem
│   │   │   ├── portal.py          # /api/portal: student and parent
│   │   │   ├── homework.py
│   │   │   ├── quizzes.py
│   │   │   ├── materials.py
│   │   │   ├── internal.py        # /api/internal/{grading,generation} for the AI worker
│   │   │   └── files.py           # local only: files on a volume
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── student.py
│   │   │   ├── lesson.py
│   │   │   ├── payment.py
│   │   │   ├── access.py          # student_links, invites
│   │   │   ├── homework.py        # + homework_assignments, homework_materials
│   │   │   ├── material.py
│   │   │   └── quiz.py            # + quiz_generations
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
│   │   │   ├── material.py
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
│   │       ├── generation.py
│   │       ├── materials.py
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
│       ├── test_materials.py
│       ├── test_homework_assignments.py
│       ├── test_generation.py
│       └── test_lambda_handler.py
├── frontend/                      # tutor, student and parent cabinets
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
        ├── 0009-homework-photos-presigned.md
        ├── 0010-quiz-generation-from-materials.md
        └── 0011-tariffs-and-liqpay.md
```

## Root files

| Path | Purpose |
| --- | --- |
| `.github/workflows/` | CI (lint and tests on every push and PR) and deployment on push to `main`. See "CI and deployment". |
| `.gitignore` | `node_modules/`, `dist/`, `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `infra/.terraform/`, local `.env*`. `infra/.terraform.lock.hcl` **is committed**. |
| `Makefile` | The contract for deployment and local checks. CI calls the same targets. See "Makefile". |
| `PROJECT.md` | This document. |
| `README.md` | What the product is, how to run it locally, how to deploy it. See "README.md". |
| `docker-compose.yml` | The whole local runtime: `postgres` and `backend` (plus the `uploads` volume for homework photos). `docker compose up` is the only command for running locally. |

## `backend/`

Purpose: the cabinet's HTTP API and all the business logic (balances, dashboard, roles and access, homework, quizzes, data isolation). The same FastAPI application runs locally under Uvicorn and in AWS as a Lambda via Mangum. The AI grader (`app/grader`) runs from the same image as a separate Lambda.

### Versions

| What | Version |
| --- | --- |
| Python | 3.12 (`requires-python = "==3.12.*"`) |
| Local image | `python:3.12-slim` |
| Lambda image | `public.ecr.aws/lambda/python:3.12` |
| fastapi | 0.111.0 |
| pydantic | 2.8.2 |
| SQLAlchemy | 2.0.31 |
| alembic | 1.13.2 |
| psycopg[binary] | 3.1.19 |
| uvicorn | 0.30.1 |
| mangum | 0.17.0 |
| PyJWT[crypto] | 2.10.1 |
| anthropic[bedrock] | 2.8.0 (`AnthropicBedrockMantle` for Claude Haiku 5.5) |
| boto3 | 1.44.2 (presigned URLs for S3) |
| python-multipart | 0.0.33 (local photo uploads) |
| tzdata | 2024.1 (so that `zoneinfo("Europe/Kyiv")` works in both the slim and the Lambda image) |
| setuptools (build backend) | 70.1.1 |
| **dev:** pytest | 8.3.3 |
| **dev:** httpx | 0.27.0 (for `fastapi.testclient`) |
| **dev:** ruff | 0.6.9 |

Ruff: `target-version = "py312"`, `line-length = 88`, `select = ["E", "F", "I", "B", "UP"]`; formatting — `ruff format`.

### Files

| Path | Purpose |
| --- | --- |
| `Dockerfile` | Local image on `python:3.12-slim`. Installs the package with dev dependencies (`.[dev]`) so that `pytest` and `ruff` work in the container. `CMD`: `alembic upgrade head`, then `uvicorn app.main:app --host 0.0.0.0 --port 8000`. |
| `Dockerfile.lambda` | Lambda image on `public.ecr.aws/lambda/python:3.12`. Installs the package **without** dev dependencies, copies `app/`, `alembic.ini`, `migrations/`. `CMD ["app.lambda_handler.handler"]`; the grader Lambda uses the same image with `image_config.command = ["app.grader.lambda_handler.handler"]`. Platform `linux/amd64`. |
| `pyproject.toml` | Exact dependency versions, ruff and pytest settings (`testpaths = ["tests"]`). |
| `alembic.ini` | `script_location = migrations`; the database URL is not here but comes from `DATABASE_URL` in `migrations/env.py`. |
| `migrations/` | Alembic. The DB schema changes **only** through migrations: `0001` — four initial tables, `0002` — `tutors` → `users` with roles (and a fix for CHECK constraint names with a doubled prefix created by `0001`), `0003` — invites and links, `0004` — who cancelled a lesson and when, `0005` — homework, `0006` — quizzes, `0007` — materials, `0008` — standalone homework, `0009` — drafts and quiz generation, `0010` — subscriptions and LiqPay, `0011` — meeting links and Telegram reminders, `0012` — promo codes. Constraint names in new migrations are set with `op.f()` so that the naming convention does not add the prefix twice; `tests/test_migrations.py` pins all names. |
| `app/main.py` | Creates `FastAPI`, mounts the routers from `app/api` under the `/api` prefix, `CORSMiddleware` with `CORS_ORIGINS`. Nothing else. |
| `app/settings.py` | Reads the environment variables (table below) into one immutable `settings` object. Does not import `app.db`. |
| `app/db.py` | `Base` (DeclarativeBase), the engine from `DATABASE_URL` (`pool_pre_ping=True`; in Lambda — a pool of one connection), `get_session` as a FastAPI dependency. |
| `app/lambda_handler.py` | The Lambda entry point. Event `{"action": "migrate"}` → `alembic upgrade head` and the response `{"migrated": true, "revision": "<head>"}`. Any other `action` value → an exception (Lambda returns `FunctionError`). An event without `action` → `Mangum(app, lifespan="off")`. |
| `app/seed.py` | `python -m app.seed [--tutor-sub <sub>]`, default `local-dev`: creates a tutor with that `sub` (if missing), 3 students, lessons for the current week, a few payments and at least one student in debt. For the first student — the accounts `<sub>-student` and `<sub>-parent`, homework awaiting review and a demo quiz (one assignment open, one handed in and waiting for the grader). Running it again deletes the data of **this tutor only** and recreates it. Local database only. |
| `app/storage.py` | Storage for homework photos and materials. `S3Storage` — presigned POST/GET (the signature is computed locally from the role's credentials, no network needed); `LocalStorage` — files on a volume, accessed via HMAC-signed URLs `/api/files/...`. Only two kinds of keys: `homework/<lesson_id or homework_id>/<uuid>.<jpg|png|heic>` and `materials/<tutor_id>/<uuid>.<pdf|jpg|png|txt|md>`. |
| `app/grader/` | The AI worker — a separate Lambda outside the VPC. **Does not import `app.db` or SQLAlchemy** (a test checks this). Per run: grades written answers (`/api/internal/grading`; `BedrockGrader` or `FakeGrader`), then generates quiz drafts from materials (`/api/internal/generation`; `BedrockGenerator` or `FakeGenerator`, `generators.py`). Both use Claude Haiku 5.5 with structured output. `run.py` — one run and the CLI for `make grade`. |
| `app/auth/` | Cognito access token verification. Does not import `app.db`. |
| `app/auth/jwks.py` | Key source: if `COGNITO_JWKS` is set, parses it once at startup (invalid JSON → the app does not start); otherwise downloads `{COGNITO_AUTHORITY}/.well-known/jwks.json` and caches it in the process. |
| `app/auth/dependencies.py` | `require_claims` (token → `Claims(sub, ...)` or 401); `get_current_user` (claims + session → the `users` row, created without a role on the first request); `get_current_tutor` and `get_current_member` (student or parent) — `403` if the role is different. Tests override `get_current_tutor` / `get_current_user` via `app.dependency_overrides` to act as different people. |
| `app/api/` | Thin routers: parse the request, call a service, serialize. No SQL and no business rules. One file per resource; `period.py` — the shared `from`/`to` query pair (`from >= to` → 422). |
| `app/models/` | SQLAlchemy 2.x ORM models (`Mapped[...]`), one file per table. |
| `app/schemas/` | Pydantic v2: request and response bodies. All request models have `extra="forbid"`. `common.py` — shared types: `Money` (int, kopecks), `AwareDatetime`, `ErrorResponse`. |
| `app/services/` | Business logic. Tutor functions take `tutor_id` and filter by it; portal functions take the user and allow access only to linked cards (`services/access.py`). This is the only place where data isolation is enforced. |
| `app/services/balances.py` | The single balance formula (see "Data model"), used by both `students` and `dashboard`. |
| `app/services/clock.py` | "Now", "today" and "the current month" in `Europe/Kyiv`; replaced in tests. |
| `app/services/errors.py` | Domain exceptions: `NotFound` → `404`, `StudentNotFound` and `Invalid(code)` → `422`, `Forbidden` → `403`, `StudentArchived` and `Conflict(code)` → `409`; `app/main.py` converts them. |
| `app/services/grading.py` | The API side of AI grading: leasing handed-in quizzes for 5 minutes (`FOR UPDATE SKIP LOCKED`), applying the points, handing over to the tutor. |
| `app/services/generation.py` | The quiz generation queue: requests (up to 3 unfinished per tutor), leasing by the worker, saving the result as a draft. |
| `app/services/materials.py` | The materials library, card access to materials, the list for the portal. |
| `tests/` | pytest against a real PostgreSQL from `TEST_DATABASE_URL`. `conftest.py` creates the test database if it is missing, runs `alembic upgrade head` and wraps each test in a rolled-back transaction. Tokens are signed with a test RSA key (`tokens.py`). Fixtures: `as_tutor(...)` (two tutors), `as_user(...)` (student, parent, no role — the real role checks stay in place), `family` (a card with a linked student and parent, frozen time), `storage` (photos in a temporary folder). `factories.py` creates records through the API. Bedrock is never called in tests — only a client stub. |

### Backend environment variables

| Variable | Required | Locally (compose) | In Lambda (Terraform / deploy) |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql+psycopg://tutor:tutor@postgres:5432/tutor_cabinet` | Built in `api.tf` from the Aurora endpoint and `db_password`. |
| `COGNITO_AUTHORITY` | yes | `https://cognito-idp.<region>.amazonaws.com/<pool_id>` | The same, from `auth.tf`. |
| `COGNITO_CLIENT_ID` | yes | the pool's web client ID | The same, from `auth.tf`. |
| `COGNITO_JWKS` | no | not set → keys are downloaded from the URL | The JWKS document (`{"keys":[...]}`) as a string; written by `make deploy-backend`. |
| `CORS_ORIGINS` | no | `http://localhost:5173` | `https://<CloudFront domain>` — and only that. |
| `TEST_DATABASE_URL` | tests only | `postgresql+psycopg://tutor:tutor@postgres:5432/tutor_cabinet_test` | — |
| `STORAGE_BACKEND` | no | `local` | `s3` |
| `UPLOADS_BUCKET` | for `s3` | — | The photo bucket from `uploads.tf`. |
| `UPLOADS_DIR` | for `local` | `/data/uploads` (the `uploads` volume) | — |
| `FILES_SECRET` | for `local` | `local-dev-only-secret` | — |
| `PUBLIC_API_URL` | for `local` | `http://localhost:8000` — the base of `/api/files/...` links | — |
| `DEV_AUTH` | no | `on` — accept `Bearer dev:<sub>` without Cognito (demo sign-in buttons) | not set; with `on` the backend refuses to start in Lambda |
| `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY` | no | empty → demo payment; `sandbox_...` keys from `.env` → the real LiqPay form (but the callback cannot reach localhost) | Sensitive workspace variables. Without them, payment is disabled in Lambda (`409 billing_disabled`). |
| `LIQPAY_SANDBOX` | no | `1` | `1` for test keys, `0` in production |
| `SITE_URL` | no | `http://localhost:5173` | `https://<CloudFront domain>`: where LiqPay sends the payer back |
| `GRADER_TOKEN` | no | `local-dev-grader-token` | A secret shared with the grader Lambda (`random_password` or a sensitive workspace variable). Empty → `/api/internal` answers `404`. |
| `AI_GRADER` | no | `on` | `on`; `off` — written answers go straight to the tutor (`needs_review`), Bedrock is not called. |

The Render deployment also uses `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_TOKEN`, `PROMO_CODES` and `BILLING_MODE` — see [`infra/README.md`](infra/README.md).

**The grader Lambda** (outside the VPC) receives only `API_URL` (the API's function URL), `GRADER_TOKEN`, `GRADER` (`bedrock` \| `fake` \| `off`), `GRADER_MODEL` (default `anthropic.claude-haiku-5-5`) and `AWS_REGION`. It never sees the database.

The Cognito values in `docker-compose.yml` are public identifiers (they are in the frontend bundle anyway), not secrets. The local backend verifies tokens from the same dev pool as the cloud.

## Authentication

**Provider:** an Amazon Cognito user pool with managed login (version 2). Sign-in methods: email + password and "Continue with Google". Self sign-up is enabled; the email is the username and is confirmed with a code.

**Frontend** — a public client without a secret. OIDC authorization code flow with PKCE via `react-oidc-context`. Scopes: `openid email profile`. Callback and logout URLs: the site's URL (`https://<site domain>/`) and `http://localhost:5173/`. Adds `Authorization: Bearer <access_token>` to every request to `/api/*` except `/api/health`. The ID token is not sent to the backend.

**Backend** accepts only the access token and checks:

1. the header has the form `Bearer <token>`;
2. the RS256 signature with a key from the pool's JWKS (by `kid`);
3. `exp` has not passed;
4. `iss` == `COGNITO_AUTHORITY`;
5. `token_use` == `access`;
6. `client_id` == `COGNITO_CLIENT_ID` (Cognito access tokens have no `aud`, so `client_id` is checked).

Any failure → `401 {"detail": "invalid or missing token"}` with the `WWW-Authenticate: Bearer` header. Unknown `kid`: locally — one JWKS reload, then 401; in Lambda — 401 straight away (keys come only from `COGNITO_JWKS`).

**Why JWKS is in an environment variable:** the Lambda sits in a VPC without NAT and has no internet access, so it cannot download `jwks.json`. The deploy (`make deploy-backend`) downloads the JWKS on the machine it runs on and writes it into `COGNITO_JWKS`. If Cognito rotates its keys, running `make deploy-backend` again is enough. Details — ADR 0004. (On Render the backend has internet access and downloads the JWKS itself.)

**The user** is identified by the `sub` claim. On the first authenticated request a `users` row is created **without a role** (`INSERT ... ON CONFLICT (cognito_sub) DO NOTHING`, then a select — safe under concurrent requests).

### Roles

| Role | How to get it | What is available |
| --- | --- | --- |
| `null` | right after sign-up | only `/api/me` and `POST /api/invites/redeem` |
| `tutor` | `POST /api/me/role {"role": "tutor"}` | everything under `/api/students`, `/api/lessons`, `/api/payments`, `/api/dashboard`, `/api/homework`, `/api/quizzes`, `/api/quiz-assignments` |
| `student` | the first redeemed invite code with `relation = student` | `/api/portal/*`; hands in homework and quizzes; does not see money or private notes |
| `parent` | the first redeemed code with `relation = parent` | `/api/portal/*`; sees prices, payments and the balance, cancels lessons; does not hand in homework or quizzes |

The role is set once and never changes (ADR 0007). A code for another role → `409 role_conflict`; tutors do not redeem codes. An endpoint of another role → `403 {"detail": "forbidden"}`.

## Data model

PostgreSQL 16 (locally and on Render) / Aurora PostgreSQL 16 (in the target AWS setup). All `id`s are UUID v4, generated by the backend. All `created_at` are `timestamptz not null default now()`. All amounts are `integer` in kopecks.

### `users` (before `0002` — `tutors`)

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `cognito_sub` | text | not null, **unique** |
| `role` | text | null until chosen; `CHECK (role IN ('tutor','student','parent'))` |
| `email` | text | null |
| `name` | text | null |
| `cancel_notice_hours` | integer | not null, default `24`, `0..168`; meaningful only for a tutor |
| `telegram_chat_id`, `telegram_link_token` | bigint, text | null, unique (migration `0011`): the Telegram chat for reminders and the one-time token that links it |
| `created_at` | timestamptz | not null |

The `tutor_id` columns in all tables reference `users.id`.

### `students`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id` | uuid | not null, FK → `tutors.id` |
| `full_name` | text | not null, 1–200 characters |
| `phone` | text | null, ≤ 32 |
| `telegram` | text | null, ≤ 64 |
| `parent_name` | text | null, ≤ 200 |
| `parent_phone` | text | null, ≤ 32 |
| `subject` | text | null, ≤ 100 |
| `default_price` | integer | not null, `>= 0` |
| `notes` | text | null, ≤ 2000 |
| `meeting_url` | text | null (migration `0011`): the student's usual Zoom/Meet link |
| `archived` | boolean | not null, default `false` |
| `created_at` | timestamptz | not null |

Indexes: `(tutor_id, archived)`. Additionally `unique (id, tutor_id)` — the target of the composite FKs below.

### `lessons`

| Column | Type | Constraints |
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
| `notes` | text | null, ≤ 2000; private, students and parents do not see them |
| `meeting_url` | text | null (migration `0011`): overrides the student's link for this lesson |
| `cancelled_by` | uuid | null, FK → `users.id`: who set `cancelled` (the tutor or a parent) |
| `cancelled_at` | timestamptz | null |
| `created_at` | timestamptz | not null |

FK `(student_id, tutor_id)` → `students (id, tutor_id)`: a lesson physically cannot belong to another tutor's student. Indexes: `(tutor_id, starts_at)`, `(student_id)`. Changing the status from `cancelled` to anything else clears `cancelled_by` and `cancelled_at`.

### `payments`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id` | uuid | not null, FK → `tutors.id` |
| `student_id` | uuid | not null |
| `amount` | integer | not null, `> 0` |
| `paid_at` | timestamptz | not null |
| `method` | text | not null, `CHECK (method IN ('cash','card','transfer'))` |
| `comment` | text | null, ≤ 500 |
| `created_at` | timestamptz | not null |

FK `(student_id, tutor_id)` → `students (id, tutor_id)`. Indexes: `(tutor_id, paid_at)`, `(student_id)`.

### `student_links` — who besides the tutor sees a card

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `user_id` | uuid | not null, FK → `users.id` |
| `student_id` | uuid | not null, FK → `students.id` `ON DELETE CASCADE` |
| `relation` | text | `CHECK (relation IN ('student','parent'))` |
| `created_at` | timestamptz | not null |

`unique (user_id, student_id)`; the partial unique index `uq_student_links_one_student_account (student_id) WHERE relation = 'student'` — a card has at most one student account, while there can be several parents. One account can be linked to several cards, including cards of different tutors.

### `invites` — one-time codes

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id`, `student_id` | uuid | FK `(student_id, tutor_id)` → `students (id, tutor_id)` `ON DELETE CASCADE` |
| `relation` | text | `student` \| `parent` |
| `code_hash` | text | unique; SHA-256 of the normalized code (the code itself is not stored) |
| `expires_at` | timestamptz | creation + 7 days |
| `used_at`, `used_by` | timestamptz, uuid | null until used |
| `created_at` | timestamptz | not null |

The code is 8 characters from an alphabet without `0/O/1/I/L`, shown as `XXXX-XXXX`; case and dashes are ignored on input.

### `materials` and `material_shares` (migration `0007`)

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK; `unique (id, tutor_id)` — the target of composite FKs |
| `tutor_id` | uuid | FK → `users.id` |
| `title` | text | 1–200 |
| `description` | text | null, ≤ 2000 |
| `storage_key` | text | unique; `materials/<tutor_id>/<uuid>.<pdf\|jpg\|png\|txt\|md>` |
| `content_type` | text | `application/pdf`, `image/jpeg`, `image/png`, `text/plain`, `text/markdown` (derived from the key) |
| `size_bytes` | integer | `> 0`, up to 10 MB |
| `original_name` | text | the file name on the tutor's device |
| `created_at` | timestamptz | not null |

`material_shares`: `material_id`, `student_id`, `tutor_id`; composite FKs `(material_id, tutor_id)` → `materials` and `(student_id, tutor_id)` → `students`, both `ON DELETE CASCADE`; `unique (material_id, student_id)`. A material shared with a card is visible to its student and parents.

### `homework_assignments` and `homework_materials` (migration `0008`)

Standalone homework not tied to a lesson: `id`, `tutor_id`, `student_id` (composite FK to `students`), `title` (1–200), `description` (≤ 5000), `due_at` (null), `created_at`. `homework_materials`: `homework_id` (`ON DELETE CASCADE`), `material_id` + `tutor_id` (composite FK to `materials`, `ON DELETE CASCADE`), `unique (homework_id, material_id)`. An attached material is visible from the homework even if it was not shared separately.

### `homework_submissions` and `submission_photos`

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK |
| `tutor_id`, `student_id` | uuid | FK `(student_id, tutor_id)` → `students` |
| `lesson_id` | uuid | null; **unique** (one answer per lesson), FK → `lessons.id` `ON DELETE CASCADE` |
| `homework_id` | uuid | null; **unique** (one answer per homework), FK → `homework_assignments.id` `ON DELETE CASCADE` |

`CHECK (num_nonnulls(lesson_id, homework_id) = 1)`: an answer belongs either to a lesson or to standalone homework.

| Column | Type | Constraints |
| --- | --- | --- |
| `text` | text | null, ≤ 5000 |
| `status` | text | `submitted` \| `reviewed` |
| `feedback` | text | null, ≤ 2000 |
| `grade` | integer | null, `1..12` |
| `submitted_at` | timestamptz | not null |
| `reviewed_at` | timestamptz | null |

`submission_photos`: `id`, `submission_id` (FK `ON DELETE CASCADE`), `storage_key` (unique), `position`, `created_at`. Up to 5 photos per answer.

### Quizzes: `quizzes`, `quiz_questions`, `quiz_assignments`, `quiz_answers`

- `quizzes`: `id`, `tutor_id`, `title` (1–200), `description`, `status` (`draft` \| `ready`, default `ready`; migration `0009`), `source_material_id` (null, FK → `materials` `ON DELETE SET NULL`), `created_at`, `updated_at`. A draft cannot be assigned.
- `quiz_generations` (migration `0009`): the generation queue — `tutor_id`, `material_id` (`ON DELETE SET NULL`), `status` (`pending` \| `done` \| `failed`), `question_count` (`1..20`), `include_written`, `instructions`, `quiz_id` (the finished draft), `error`, `claimed_at` (the worker's lease), `finished_at`, `created_at`.
- `quiz_questions`: `quiz_id` (`ON DELETE CASCADE`), `position` (unique within the quiz), `kind` (`single` \| `multiple` \| `text`), `prompt`, `points` (`1..100`), `options` JSONB (`[{"id": "1", "text": "..."}]`, null for `text`), `correct_options` JSONB (`["1"]`), `reference_answer` (only for `text`).
- `quiz_assignments`: `tutor_id`, `quiz_id`, `student_id` (composite FK to `students`), `status` (`assigned` → `submitted` \| `needs_review` → `graded`), `due_at`, `score` (null until everything is graded), `max_score`, `submitted_at`, `graded_at`, `ai_claimed_at` (the grader's lease). Indexes: `(tutor_id, status)`, `(student_id)`, `(status, submitted_at)`.
- `quiz_answers`: `assignment_id` (`ON DELETE CASCADE`), `question_id`, `selected_options` JSONB, `text_answer`, `points` (null until graded; `>= 0`), `feedback`, `graded_by` (`auto` \| `ai` \| `tutor`), `graded_at`; `unique (assignment_id, question_id)`.

A quiz already assigned to someone cannot be changed or deleted (`409 quiz_in_use`): the answers reference its questions.

### `subscriptions` and `billing_events` (migration `0010`)

- `subscriptions`: one LiqPay subscription (`order_id` unique, `tc-<hex>`): `tutor_id`, `period` (`month` \| `year`), `amount` (kopecks per period), `status` (`pending` — the form was issued; `active` — LiqPay charges; `cancelled` — no longer charges), `paid_until` (paid up to), `cancel_requested_at`, `cancel_claimed_at`, `cancel_attempts` (cancellation through the worker, up to 10 attempts), `created_at`.
- `billing_events`: every verified LiqPay callback as is (`order_id`, `payment_id`, `action`, `status`, `payload` JSONB). The partial unique index `(payment_id, status) WHERE payment_id IS NOT NULL` prevents a repeat from being applied twice.

Pro = there is a subscription with `paid_until + 3 days > now` (3 days because LiqPay retries a failed charge for 72 hours). Each payment (`success` or `subscribed` with a new `payment_id`) extends `paid_until` by a calendar month or year from `max(now, paid_until)`. Migration `0012` adds promo codes that grant Pro for a number of days.

### `reminders_sent` (migration `0011`)

One row per Telegram reminder already sent: `user_id` (`ON DELETE CASCADE`), `kind` (`lesson` \| `homework` \| `quiz`), `object_id`, `sent_at`; `unique (user_id, kind, object_id)`, so a scheduler run that is late or repeated never sends the same reminder twice.

### Balance

```
balance(student) = Σ payments.amount  −  Σ lessons.price where lessons.status = 'done'
```

- Always computed over all time, on the fly, in `services/balances.py` with one SQL query. There is no separate balance column.
- `balance < 0` — the student owes `−balance` kopecks; `balance > 0` — prepayment; `0` — settled.
- `planned`, `cancelled`, `missed` do not affect the balance. If you want to charge for a missed lesson, set it to `done`.
- A lesson's `price` is copied from the student's `default_price` at creation time; changing `default_price` later does not change lessons that already exist.
- Archiving does not reset the balance: an archived student's debt is still a debt.

## Backend API

General rules for all endpoints:

- Everything is under `/api`, bodies and responses are JSON (`Content-Type: application/json`).
- Date-times are ISO 8601 **with an offset**. A time without an offset in a request → `422`. Responses return time in `Europe/Kyiv`, for example `"2026-11-13T16:00:00+02:00"`.
- Money is an `integer` in kopecks.
- Unknown fields in a request body → `422` (`extra="forbid"`).
- There is no pagination: one tutor's volumes are small. Lists are returned in full.
- All endpoints except `GET /api/health`, `/api/internal/*` (the grader's token), `/api/telegram/webhook` (Telegram's secret) and `/api/files/*` (signature in the URL, local only) require a valid token (otherwise `401`). Tutor endpoints work only with the tutor's own data, `/api/portal/*` only with linked cards.

### Error format

| Code | When | Body |
| --- | --- | --- |
| `401` | No token or an invalid one | `{"detail": "invalid or missing token"}` |
| `402` | The plan does not allow the action | `{"detail": "plan_read_only" \| "plan_limit" \| "pro_required"}` |
| `403` | The role has no access to the endpoint or action | `{"detail": "forbidden"}` |
| `404` | No record with that `id` **or it belongs to someone else / is not linked** (same response) | `{"detail": "not found"}`; for codes — `{"detail": "invite_not_found"}` |
| `409` | A business rule is violated | `{"detail": "<code>"}`, codes below |
| `422` | Invalid body, query or path (including a non-UUID in `{id}`); a reference to a non-existent / foreign student in the body; domain checks | The standard FastAPI format: `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}`; domain ones — `{"detail": "<code>"}`: `student_not_found`, `material_not_found`, `bad_material_key`, `unknown_question`, `wrong_answer_shape`, `points_above_maximum`, `points_out_of_range`, `invalid_quiz` |

`409` codes:

| Code | When |
| --- | --- |
| `student_archived` | a lesson or a quiz for an archived student |
| `role_already_set` | `POST /api/me/role` for an account that is already a student or a parent |
| `tutor_only_setting` | `cancel_notice_hours` in `PATCH /api/me` from someone who is not a tutor |
| `role_conflict`, `already_linked`, `student_already_linked` | the invite code does not fit this account or card |
| `lesson_not_planned`, `cancel_too_late` | cancellation by a parent |
| `no_homework`, `already_reviewed`, `bad_photo_key` | handing in homework |
| `quiz_in_use`, `not_submitted`, `already_submitted`, `quiz_is_draft` | quizzes |
| `too_many_generations` | quiz generation: 3 unfinished already |
| `already_subscribed`, `billing_disabled`, `no_active_subscription` | plan and payment |
| `telegram_disabled` | connecting Telegram while no bot is configured |

### Data isolation

- Every DB query is filtered by the current tutor's `tutor_id` — in `services/`, not in the routers.
- Someone else's record by `{id}` → `404`, the same as a non-existent one.
- The `student_id` in the body of `POST /api/lessons` and `POST /api/payments` must belong to the current tutor; otherwise `422 {"detail": "student_not_found"}`. Composite FKs in the DB are an extra safeguard.
- `tutor_id` is never accepted from the client and never returned.
- Students and parents see only the cards in `student_links`; someone else's card, lesson, homework or quiz → `404`. A link removed by the tutor revokes access immediately.
- Hidden in the portal: `lessons.notes` (always), prices, payments and the balance (from the student), the payment comment (from everyone), the correct quiz options (until handed in), reference answers (always).

---

### `GET /api/health`

No authentication. **Does not touch the DB** (so that a health check does not wake Aurora up).

- Response `200`: `{"status": "ok"}`

### Profile: `/api/me`

**`User`**: `id` uuid, `role` `"tutor"` \| `"student"` \| `"parent"` \| null, `email` string \| null (from the claim, if present), `name` string \| null, `cancel_notice_hours` integer, `telegram_connected` boolean, `telegram_available` boolean, `created_at` datetime.

| Method and path | Request | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/me` | — | `200` `User`; created without a role on the first call | `401` |
| `PATCH /api/me` | `name` string 1–200, `cancel_notice_hours` integer `0..168` (tutor only) | `200` `User` | `401`, `409 tutor_only_setting`, `422` |
| `POST /api/me/role` | `{"role": "tutor"}` — there are no other values (`422`) | `200` `User`; a repeated call by a tutor is also `200` | `401`, `409 role_already_set` |
| `POST /api/me/telegram` | — | `200` `{url}` — a `t.me` link that opens the bot with a one-time code | `401`, `409 telegram_disabled` |
| `DELETE /api/me/telegram` | — | `204`; Telegram reminders stop | `401` |

### Invites and access

Tutor (everything within their own card; someone else's → `404`):

| Method and path | Request | Response |
| --- | --- | --- |
| `POST /api/students/{id}/invites` | `{"relation": "student" \| "parent"}` | `201` `{id, relation, expires_at, created_at, code}` — `code` is returned only here; `409 student_already_linked` if the card already has a student account |
| `GET /api/students/{id}/invites` | — | `200` active (unused, unexpired) codes without the code itself |
| `DELETE /api/students/{id}/invites/{invite_id}` | — | `204` |
| `GET /api/students/{id}/links` | — | `200` `[{id, relation, user_name, user_email, created_at}]` |
| `DELETE /api/students/{id}/links/{link_id}` | — | `204`; the account loses access to the card, the role stays |

Any account except a tutor: `POST /api/invites/redeem` `{"code": "K7PM-4XQR"}` → `200` `{student_id, student_full_name, relation}`. The first code sets the role. Errors: `404 invite_not_found` (missing, used, expired, revoked), `409 role_conflict | already_linked | student_already_linked`.

### Student and parent portal: `/api/portal`

Role `student` or `parent`, otherwise `403`.

| Method and path | Who | Response |
| --- | --- | --- |
| `GET /api/portal/students` | both | `[{id, full_name, subject, tutor_name, relation, archived, balance}]`; `balance` — parents only, `null` for the student |
| `GET /api/portal/lessons` | both | query `from`, `to`, `student_id`; `PortalLesson[]` by `starts_at` |
| `GET /api/portal/lessons/{id}` | both | `PortalLesson` |
| `POST /api/portal/lessons/{id}/cancel` | parent (student → `403`) | `PortalLesson` with status `cancelled`; `409 lesson_not_planned`, `409 cancel_too_late` |
| `GET /api/portal/payments` | parent (student → `403`) | query `student_id`, `from`, `to`; `[{id, student_id, student_full_name, amount, paid_at, method}]` |

**`PortalLesson`**: `id`, `student_id`, `student_full_name`, `tutor_name`, `starts_at`, `duration_minutes`, `status`, `topic`, `homework`, `price` (parents only), `join_url` (the meeting link, if the tutor gave one), `cancelled_at`, `cancelled_by_role`, `can_cancel` (for the current user), `cancel_deadline`. There is no `notes` field.

**Cancellation rule:** only `planned`, only parents, and no later than `starts_at − cancel_notice_hours` of the tutor (24 h by default). After that only the tutor can cancel, via `PATCH /api/lessons/{id}/status`. A cancelled lesson does not affect the balance. In `Lesson` the tutor sees the fields `cancelled_at` and `cancelled_by_role` (`tutor` \| `parent`).

### Homework

Student (parents writing → `403`; a lesson without `homework` → `409 no_homework`; after review → `409 already_reviewed`):

| Method and path | Request | Response |
| --- | --- | --- |
| `POST /api/portal/lessons/{id}/homework/uploads` | `{content_type: "image/jpeg" \| "image/png" \| "image/heic", size_bytes: 1..10485760}` | `{url, fields, key, expires_at}` — the browser sends the file as `multipart/form-data` to `url`: all `fields`, then `file`. The link is valid for 15 minutes. |
| `PUT /api/portal/lessons/{id}/homework` | `{text?: string ≤ 5000, photo_keys?: string[] ≤ 5}` (at least one) | `200` `Homework`; replaces the previous answer until the tutor has reviewed it; someone else's key → `409 bad_photo_key` |
| `GET /api/portal/lessons/{id}/homework` | student and parent | `200` `Homework` or `404` if not handed in yet |

Tutor: `GET /api/homework?status=submitted&student_id=` (the queue of both kinds of homework, oldest first), `GET /api/homework/{id}`, `PATCH /api/homework/{id}/review` `{feedback?: string ≤ 2000, grade?: 1..12}` (at least one) → status `reviewed`.

**`Homework`** (an answer): `id`, `lesson_id` and `lesson_starts_at` (for homework from a lesson) or `homework_id`, `title`, `due_at` (for standalone homework), `task` (the assignment text), `student_id`, `student_full_name`, `text`, `photos: [{key, url}]` (`url` is temporary, 15 minutes), `status`, `feedback`, `grade`, `submitted_at`, `reviewed_at`.

**Standalone homework.** Tutor: `POST /api/homework-assignments` `{student_id, title, description?, due_at?, material_ids: [] ≤ 20}` → `201` (`422 student_not_found`, `422 material_not_found`, `409 student_archived`), `GET /api/homework-assignments?student_id=`, `GET`/`PATCH`/`DELETE /api/homework-assignments/{id}` (deleting also removes the answer). Student and parent: `GET /api/portal/homework-assignments`, `GET /api/portal/homework-assignments/{id}` (with links to the attached materials and the answer); the student hands it in the same way as homework from a lesson: `POST .../{id}/uploads`, `PUT .../{id}/submission`. **`HomeworkAssignment`**: `id`, `student_id`, `student_full_name`, `title`, `description`, `due_at`, `materials: [{id, title, content_type, original_name, download_url}]`, `submission_status` (null — not handed in), `grade`, `created_at`; the details also include `submission`.

### Materials

Tutor: `POST /api/materials/uploads` `{content_type: PDF | JPEG | PNG | TXT | MD, size_bytes ≤ 10 MB}` → a signed target (as for homework photos); after the upload `POST /api/materials` `{key, title, description?, original_name, size_bytes}` → `201` (a key not issued to this tutor → `422 bad_material_key`); `GET /api/materials`, `GET`/`PATCH`/`DELETE /api/materials/{id}`; `PUT /api/materials/{id}/shares` `{student_ids}` — replaces the list of cards the material is shared with (`422 student_not_found`). **`Material`**: `id`, `title`, `description`, `content_type`, `size_bytes`, `original_name`, `download_url` (15 minutes), `shared_with: [{student_id, full_name}]`, `created_at`.

Student and parent: `GET /api/portal/materials?student_id=` — materials shared with their cards, with `download_url` and `student_ids` (for which of their children); the list of other students is not visible.

Locally (only with `STORAGE_BACKEND=local`) uploads and downloads go through `POST /api/files/upload` and `GET /api/files/{key}?expires=&signature=` — an HMAC signature instead of a token, as with presigned S3. In the cloud these endpoints do not exist (`404`), the browser talks to S3 directly.

### Quizzes

Tutor:

| Method and path | What it does |
| --- | --- |
| `GET /api/quizzes`, `POST /api/quizzes` | list (`question_count`, `max_score`, `assignment_count`) and create |
| `GET`, `PUT`, `DELETE /api/quizzes/{id}` | read (with the correct answers and references), replace, delete; changing and deleting is allowed only until assigned (`409 quiz_in_use`) |
| `POST /api/quizzes/{id}/publish` | Turn a draft (`draft`) into a finished quiz (`ready`) |
| `POST /api/quizzes/{id}/assignments` | `{student_id, due_at?}` → `201` `Assignment`; someone else's student → `422 student_not_found`, an archived one → `409 student_archived`, a draft → `409 quiz_is_draft` |
| `POST /api/materials/{id}/generate-quiz` | `{question_count: 1..20 (8), include_written: bool (true), instructions?: ≤ 1000}` → `202` `Generation` with status `pending`; at most 3 unfinished generations per tutor (`409 too_many_generations`) |
| `GET /api/quiz-generations`, `GET /api/quiz-generations/{id}` | The last 50 generations: `{id, material_id, material_title, status, question_count, include_written, instructions, quiz_id, error, created_at, finished_at}` |
| `GET /api/quiz-assignments?student_id=&status=` | `?status=needs_review` — the tutor's queue of written answers |
| `GET`, `DELETE /api/quiz-assignments/{id}` | details with answers and points; deleting an assignment |
| `PATCH /api/quiz-assignments/{id}/answers/{question_id}` | `{points: 0..max, feedback?}` — set or change the points of any answer; `409 not_submitted`, `422 points_above_maximum` |

**`QuizIn`**: `title` 1–200, `description?` ≤ 2000, `questions` 1–50. A question: `kind`, `prompt` 1–2000, `points` 1–100 (default 1); for `single`/`multiple` — `options: [{text, correct}]` (2–10; `single` — exactly one correct, `multiple` — at least one); for `text` — `reference_answer` 1–2000 and no `options`. Option ids are `"1"`, `"2"`, … in the order given.

Student and parent: `GET /api/portal/quiz-assignments?student_id=`, `GET /api/portal/quiz-assignments/{id}`. Only the student hands it in: `POST /api/portal/quiz-assignments/{id}/submit` `{answers: [{question_id, selected_options?, text_answer? ≤ 2000}]}` — once (`409 already_submitted`), parent → `403`.

**Grading on hand-in:**
- `single` / `multiple` — full points only for the exactly correct set, otherwise 0 (`graded_by = auto`);
- an empty written answer — 0 at once;
- a non-empty written answer — status `submitted`, waiting for the AI grader; with `AI_GRADER=off` — `needs_review`, waiting for the tutor;
- once every answer has points — `graded`, `score` = the sum.

Students and parents see the correct options only after handing in, and never see the reference answers.

### AI grader: `/api/internal/grading`

Only for the grader Lambda; the `X-Grader-Token` header (constant-time comparison). Without a configured `GRADER_TOKEN` — `404`, with a wrong one — `401`.

| Method and path | What it does |
| --- | --- |
| `POST /api/internal/grading/claim?limit=1..20` | Leases for 5 minutes the oldest `submitted` quizzes nobody holds and returns their ungraded written answers: `[{assignment_id, quiz_title, questions: [{question_id, prompt, reference_answer, max_points, answer}]}]`. Two simultaneous runs never get the same quiz — we never pay twice. |
| `POST /api/internal/grading/{id}/result` | `{model, results: [{question_id, points, feedback?}]}`; points `0..max` (`422 points_out_of_range`). Answers without points go to the tutor (`needs_review`). A quiz no longer waiting for the grader → `404 not_waiting_for_grader`. |
| `POST /api/internal/grading/{id}/failed` | A model refusal or an error → `needs_review`. |

The grader does not retry failed attempts: any error hands the quiz to the tutor, so a broken model or prompt cannot spend money in a loop.

### Quiz generation: `/api/internal/generation`

The same worker and the same token. After grading, it picks up the next generation request:

| Method and path | What it does |
| --- | --- |
| `POST /api/internal/generation/claim?limit=1..5` | Leases for 5 minutes the oldest `pending` requests: `[{job_id, material_title, content_type, download_url, question_count, include_written, instructions}]`. `download_url` is a signed link to the file (S3 or the local `/api/files`). A request whose material was deleted becomes `failed` at once. |
| `POST /api/internal/generation/{id}/result` | `{model, quiz}` — the body as in `POST /api/quizzes`. The API validates it with the same rules; invalid → `422 invalid_quiz` and the request becomes `failed`. A valid one is saved as a **draft** (`status = draft`, `source_material_id`). |
| `POST /api/internal/generation/{id}/failed` | `{reason}` → the request becomes `failed`. |

The worker passes the material to Claude Haiku 5.5 as is: a PDF as a `document` block, a photo as an `image` block, text as escaped text. The system prompt declares the material and the tutor's wishes to be data only. The response comes through structured output; questions that break the rules (wrong number of correct options, a written question without a reference, an unknown type) are dropped, points are clipped to `1..10`. There are no retries, as with the grader.

### Plan and payment: `/api/billing`

Tutor (`403` for other roles):

| Method and path | What it does |
| --- | --- |
| `GET /api/billing` | `{plan: "free" \| "pro", pro_until, period, subscription_status, cancel_pending, active_students, free_student_limit: 3, read_only, prices: {month: 19900, year: 199000}, billing_mode: "liqpay" \| "demo" \| "disabled"}` |
| `POST /api/billing/checkout` | `{period: "month" \| "year"}` → `{mode, url, data, signature, order_id}`. The API creates a `subscriptions` row with status `pending` and **signs the LiqPay form locally** (without calling LiqPay): `action = "subscribe"`, `amount` in hryvnias, `currency = "UAH"`, `subscribe_periodicity`, `subscribe_date_start` (now or the end of paid Pro), `server_url = {PUBLIC_API_URL}/api/billing/liqpay/callback`, `result_url = {SITE_URL}/billing?checkout=done`, `sandbox = "1"` with `LIQPAY_SANDBOX=1`. The browser POSTs `data` and `signature` as a form to `url` (`https://www.liqpay.ua/api/3/checkout`). `409 already_subscribed`, `409 billing_disabled`. |
| `POST /api/billing/cancel` | Stop automatic renewal; the paid time remains. `409 no_active_subscription`. |
| `POST /api/billing/demo/pay` | Demo mode only (locally without keys): `{order_id}` → signs a callback with a demo key and runs the same handler. In other modes `404`. |
| `POST /api/billing/liqpay/callback` | LiqPay's `server_url`: form fields `data`, `signature`, no token — the signature proves authenticity (`400` if it does not match). A payment (`success`/`subscribed`, and in sandbox also `sandbox`) extends Pro; `unsubscribed` → `cancelled`; anything else is only recorded. Always `200` for a valid signature, so that LiqPay does not retry. |
| `POST /api/billing/promo` | Redeem a promo code from `PROMO_CODES` → Pro for the code's number of days. |

**The signature** — as in the official LiqPay SDKs (API version 3): `data = base64(JSON)`, `signature = base64(SHA-1(private_key + data + private_key))`. The text of the current documentation for version 7 mentions SHA3-256, while its own examples use SHA-1, so the callback is accepted with either of the two (both require the private key). Check on sandbox what LiqPay actually sends.

**Plan limits** (all through `services/billing.py`):
- `POST /api/students` and un-archiving beyond 3 active students without Pro → `402 plan_limit`;
- quiz generation without Pro → `402 pro_required`; without Pro, written answers do not go to the AI but straight to the tutor (`needs_review`);
- a read-only cabinet (`read_only`) → any tutor `POST/PUT/PATCH/DELETE` on the tutor's routers → `402 plan_read_only`; allowed: `DELETE /api/students/{id}` (archiving), `/api/billing/*`, `/api/me`. The student and parent portal is not restricted.

**Cancelling in LiqPay** requires a server-to-server request (`action = "unsubscribe"` to `https://www.liqpay.ua/api/request`), while the API Lambda has no internet. So the API signs the request, and the AI worker outside the VPC only forwards it (`/api/internal/billing/claim` → LiqPay → `/api/internal/billing/{id}/result`); the worker does not have the private key. Failed attempts are retried on the next run (up to 10). The worker does this even with `GRADER=off`. In demo mode cancellation is immediate.

### Telegram: `/api/telegram/webhook` and `/api/internal/reminders/run`

- `POST /api/telegram/webhook` — Telegram delivers the bot's messages here; checked by the secret Telegram echoes in `X-Telegram-Bot-Api-Secret-Token`. `/start <token>` links the chat to the account that requested the link, `/stop` unlinks it.
- `POST /api/internal/reminders/run` — called by the scheduler (cron-job.org or GitHub Actions) with `X-Cron-Token`; sends the reminders that are due: a lesson in the next ~75 minutes (to the tutor, the student and the parents), a homework or quiz deadline within 24 hours that is not handed in (to the student and the parents). Each reminder is sent once (`reminders_sent`).
- `POST /api/internal/telegram/webhook` — with `X-Cron-Token`, points the bot at this server; run once after deployment.

Without `CRON_TOKEN` the internal endpoints answer `404`.

### Students

**`Student`** (response):

| Field | Type |
| --- | --- |
| `id` | string (uuid) |
| `full_name` | string |
| `phone` | string \| null |
| `telegram` | string \| null |
| `parent_name` | string \| null |
| `parent_phone` | string \| null |
| `subject` | string \| null |
| `default_price` | integer (kopecks) |
| `notes` | string \| null |
| `meeting_url` | string \| null |
| `archived` | boolean |
| `created_at` | string (datetime) |
| `balance` | integer (kopecks; negative = debt) |

**`StudentCreate`** (POST body): `full_name` string 1–200 **required**; `default_price` integer `0..100000000` **required**; `phone`, `telegram`, `parent_name`, `parent_phone`, `subject`, `notes` — string \| null, optional, with the length limits from the `students` table; `meeting_url` — an `http(s)://` link ≤ 500 or null. Strings are trimmed; an empty string is stored as `null`.

**`StudentUpdate`** (PATCH body): the same fields plus `archived` boolean, all optional. Only the fields sent are updated. `full_name`, `default_price`, `archived` cannot be `null` → `422`.

| Method and path | Request | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/students` | query `archived`: boolean, default `false` | `200` `Student[]`, sorted by `full_name` | `401`, `422` |
| `POST /api/students` | `StudentCreate` | `201` `Student` (`balance` = 0) | `401`, `422` |
| `GET /api/students/{id}` | — | `200` `Student` (archived ones are returned too) | `401`, `404`, `422` |
| `PATCH /api/students/{id}` | `StudentUpdate` | `200` `Student` | `401`, `404`, `422` |
| `DELETE /api/students/{id}` | — | `204` with no body. This is **archiving** (`archived = true`), not deletion; a repeated call is also `204`. To un-archive — `PATCH {"archived": false}`. | `401`, `404`, `422` |

### Lessons

**`Lesson`** (response):

| Field | Type |
| --- | --- |
| `id` | string (uuid) |
| `student_id` | string (uuid) |
| `student_full_name` | string |
| `starts_at` | string (datetime) |
| `duration_minutes` | integer |
| `price` | integer (kopecks) |
| `status` | `"planned"` \| `"done"` \| `"cancelled"` \| `"missed"` |
| `topic` | string \| null |
| `homework` | string \| null |
| `notes` | string \| null |
| `meeting_url` | string \| null — this lesson's own link |
| `join_url` | string \| null — where to join: this lesson's link or the student's |
| `created_at` | string (datetime) |

**`LessonCreate`**: `student_id` uuid **required**; `starts_at` datetime with offset **required**; `duration_minutes` integer `1..720`, default `60`; `price` integer `0..100000000`, default — the student's `default_price`; `status`, default `planned` (allows entering a lesson already held after the fact); `topic`, `homework`, `notes`, `meeting_url` — string \| null.

**`LessonUpdate`**: `starts_at`, `duration_minutes`, `price`, `topic`, `homework`, `notes`, `meeting_url` — all optional. `student_id` and `status` are **not accepted** here (`422`): a lesson's student is not changed, and the status is changed with a separate endpoint.

**`LessonStatusUpdate`**: `{"status": "planned" | "done" | "cancelled" | "missed"}`. Any status may follow any other (including fixing a mistaken `done`); the balance is recalculated automatically because it is not stored.

| Method and path | Request | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/lessons` | query, all optional: `from` datetime (inclusive), `to` datetime (exclusive) — filter by `starts_at`; `student_id` uuid; `status` one of the status values | `200` `Lesson[]`, sorted by `starts_at` ascending | `401`, `422` (including `from >= to`, a time without an offset) |
| `POST /api/lessons` | `LessonCreate` | `201` `Lesson` | `401`, `409 student_archived`, `422` (including `student_not_found`) |
| `GET /api/lessons/{id}` | — | `200` `Lesson` | `401`, `404`, `422` |
| `PATCH /api/lessons/{id}` | `LessonUpdate` | `200` `Lesson` | `401`, `404`, `422` |
| `PATCH /api/lessons/{id}/status` | `LessonStatusUpdate` | `200` `Lesson` | `401`, `404`, `422` |
| `DELETE /api/lessons/{id}` | — | `204` with no body; the record is deleted | `401`, `404`, `422` |

`GET /api/lessons` with the `student_id` of someone else's or a non-existent student returns `200 []`.

### Payments

**`Payment`** (response):

| Field | Type |
| --- | --- |
| `id` | string (uuid) |
| `student_id` | string (uuid) |
| `student_full_name` | string |
| `amount` | integer (kopecks, > 0) |
| `paid_at` | string (datetime) |
| `method` | `"cash"` \| `"card"` \| `"transfer"` |
| `comment` | string \| null |
| `created_at` | string (datetime) |

**`PaymentCreate`**: `student_id` uuid **required**; `amount` integer `1..100000000` **required**; `method` **required**; `paid_at` datetime with offset, default — now; `comment` string ≤ 500 \| null. A payment for an archived student **is** accepted (closing a debt).

**`PaymentUpdate`**: `amount`, `paid_at`, `method`, `comment` — optional. `student_id` is not accepted (`422`).

| Method and path | Request | Response | Errors |
| --- | --- | --- | --- |
| `GET /api/payments` | query, all optional: `student_id` uuid; `from` datetime (inclusive), `to` datetime (exclusive) — filter by `paid_at` | `200` `Payment[]`, sorted by `paid_at` descending | `401`, `422` |
| `POST /api/payments` | `PaymentCreate` | `201` `Payment` | `401`, `422` (including `student_not_found`) |
| `GET /api/payments/{id}` | — | `200` `Payment` | `401`, `404`, `422` |
| `PATCH /api/payments/{id}` | `PaymentUpdate` | `200` `Payment` | `401`, `404`, `422` |
| `DELETE /api/payments/{id}` | — | `204` with no body; the record is deleted | `401`, `404`, `422` |

### `GET /api/dashboard`

All period boundaries are in `Europe/Kyiv` at the time of the request.

- Response `200` — `Dashboard`:

| Field | Type | Contents |
| --- | --- | --- |
| `date` | string (`YYYY-MM-DD`) | Today's date in Kyiv |
| `today` | `Lesson[]` | Lessons with `starts_at` in `[today 00:00, tomorrow 00:00)`, **all statuses**, by time |
| `upcoming` | `Lesson[]` | Lessons with status `planned` in `[tomorrow 00:00, today + 8 days 00:00)` — the next 7 days, by time |
| `income_month` | integer (kopecks) | The sum of `payments.amount` with `paid_at` in the current calendar month (cash basis: what was actually received) |
| `debt_total` | integer (kopecks, ≥ 0) | The sum of `−balance` over all students with `balance < 0`, including archived ones |
| `debtors` | `Debtor[]` | Students with `balance < 0`, largest debt first |
| `homework_to_review` | integer | Homework with status `submitted` |
| `quizzes_to_review` | integer | Quizzes with status `needs_review` |

`Debtor`: `student_id` string (uuid), `full_name` string, `balance` integer (negative), `archived` boolean.

- Errors: `401`, `403`.

## `frontend/`

Purpose: a single-page cabinet in Ukrainian for three roles.

- **Sign-in.** The sign-in page offers Google and email (Cognito managed login); `/privacy` (the privacy policy) is public. After sign-in, `App.tsx` loads `GET /api/me`; if the account has no name yet, `NamePage` asks for it; then it picks the cabinet by role. If `role` = `null`, `RoleChoicePage` is shown: "I'm a tutor" or an invite code.
- **Tutor.** A menu of five sections: "Today", "Schedule", "Students", "Payments", "Learning". On a laptop it is in the sidebar, on a phone — a bottom bar. "Plan", "Reminders" and "Sign out" are in the profile: at the bottom of the sidebar or behind the avatar in the top bar on a phone. Pages:
  - `/` "Today" — quick actions (new lesson, payment, homework, student), today's lessons with a "Done" button, "Needs attention" (unmarked past lessons, homework and quizzes to review, debtors), money for the month;
  - `/lessons` "Schedule" — a weekly calendar by default (clicking a free hour creates a lesson, clicking a lesson opens `LessonDialog` with "Lesson held", "Student did not come", "Cancel" and the join link) and a "List" toggle (upcoming / unmarked / past, filters by student and status); the chosen view is remembered in `localStorage`;
  - `/students` — the list of students, `/students/<id>` — the student's card with the tabs "Lessons", "Homework", "Quizzes", "Materials", "Access" (`StudentAccessPanel`) and one balance block linking to "Payments";
  - `/payments` — the balances of all students (debtors first) and income for a period ("This month", "Last month", "All"); `/payments/students/<id>` — one student's money: balance, paid, charged and a timeline of payments and lessons held with the balance after each. A payment is edited and deleted in its dialog;
  - "Learning" — three tab pages with a shared header (`LearningHeader`): `/homework` (to review, reviewed, assigned), `/quizzes` (to grade, assigned, my quizzes), `/materials` (the library; upload and "Generate a quiz" — in dialogs); `/quizzes/<id>/edit` (editing and publishing a draft) and `/quiz-assignments/<id>` (answers; the points form is open only for ungraded questions);
  - `/billing` (plans, payment via LiqPay, promo codes, cancellation; `/billing/demo-checkout` — a demo payment page). The "read-only" banner is shown above all pages when `read_only`.
  - Shared elements: `PageHeader`, `SegmentedTabs`, `EmptyState` (`src/components/common/`); money everywhere in the `formatMoney` format ("1 000,00 грн"); plurals via `lib/plural.ts`.
- **Student and parent** (`src/pages/portal/`): home (a to-do list of homework and quizzes, upcoming lessons with a "Join" button, quiz results), `/schedule` (list or weekly calendar; cancellation for parents), `/homework` (tabs "To hand in", "Handed in", "Reviewed"), `/homework/<id>` and `/lessons/<id>/homework` (hand-in with photos — student only; `HomeworkAnswer`), `/quizzes` (tabs "To take", "Results") and `/quizzes/<id>` (taking a quiz — student only), `/materials` (cards with preview), `/payments` (parents only: balance breakdown and history).
- **Where the token comes from** is known only to `src/auth/session.ts` (`useSession()`): real Cognito via `react-oidc-context` or the demo sign-in. `VITE_DEV_LOGIN=true` (only in `frontend/.env.development`, i.e. only in `npm run dev`) shows three sign-in buttons for the seed accounts; the backend accepts `Bearer dev:<sub>` only with `DEV_AUTH=on`.

Not there yet: profile settings beyond the name (`cancel_notice_hours`) and editing standalone homework after creation (deletion only).

### Versions

Node 20.15.1. React 18.3.1, react-dom 18.3.1, Vite 5.4.0, @vitejs/plugin-react 4.3.1, TypeScript 5.5.4, Tailwind CSS 3.4.7, postcss 8.4.40, autoprefixer 10.4.19, react-oidc-context 3.3.1, oidc-client-ts 3.5.0. shadcn/ui — local component files in `src/components/ui/` plus class-variance-authority 0.7.0, clsx 2.1.1, tailwind-merge 2.4.0, lucide-react 0.424.0; the Radix packages a particular component pulls in are pinned to an exact version when added. Lint: ESLint 9.10.0 (+ typescript-eslint 8.6.0, eslint-plugin-react-hooks 5.1.0), Prettier 3.3.3. All versions in `package.json` are exact, without `^`; `package-lock.json` is committed.

### Structure

| Path | Purpose |
| --- | --- |
| `package.json` | Dependencies and scripts: `dev`, `build`, `lint` (`eslint .`), `format:check` (`prettier --check .`). |
| `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `prettier.config.js`, `components.json` | Tool configuration. |
| `index.html` | The mount point, `lang="uk"`. |
| `src/main.tsx` | The root: `AuthProvider` from `react-oidc-context`. |
| `src/App.tsx` | Picks the page by path: `/` "Today", `/lessons` "Schedule", `/students`, `/payments`, `/homework`, `/quizzes`, `/materials` and the others above. Unauthenticated users get the sign-in page; `/privacy` is public. |
| `src/auth/oidc.ts` | The OIDC config: authority, client_id, `redirect_uri = location.origin + "/"`, scopes, logout via the Cognito domain. |
| `src/api/client.ts` | The single `fetch` wrapper: base `VITE_API_URL`, `Authorization: Bearer`, error parsing. On `401` — sign in again. |
| `src/api/{me,students,lessons,payments,dashboard}.ts` | Typed endpoint clients; the TS types mirror the schemas from the "Backend API" section. |
| `src/pages/` | Pages: dashboard, student list, student card (lessons, payments, balance), schedule, payments; `portal/` — the student and parent pages. |
| `src/components/` | Page forms and lists; `ui/` — shadcn/ui. |
| `src/lib/money.ts` | Kopecks ↔ the string `1 234,50 ₴` (`Intl.NumberFormat("uk-UA", { currency: "UAH" })`). Hryvnia input → kopecks without float errors. |
| `src/lib/datetime.ts` | Displaying and entering time in `Europe/Kyiv`; the backend receives ISO 8601 with an offset. |

### Build variables

| Variable | Source |
| --- | --- |
| `VITE_API_URL` | Locally `http://localhost:8000`; on Render `https://mindleaf-api.onrender.com`; in the target AWS setup — the Lambda function URL (output `api_url`) |
| `VITE_COGNITO_AUTHORITY` | output `cognito_authority` (on Render — set by hand, see `infra/README.md`) |
| `VITE_COGNITO_CLIENT_ID` | output `cognito_client_id` |
| `VITE_COGNITO_DOMAIN` | output `cognito_domain` (for logout) |
| `VITE_GOOGLE_LOGIN` | `true` shows the "Sign in with Google" button |

The frontend calls the API directly (cross-origin), so the backend opens CORS only for the site's domain. Locally the frontend runs with `npm run dev` on port 5173 outside compose.

## `docker-compose.yml`

Purpose: the full local runtime. `docker compose up` from the root is the only command to start; nothing but Docker is needed.

`name: tutor-cabinet`. Two services, named volumes `pgdata` (the database) and `uploads` (homework photos, mounted into the backend as `/data/uploads`).

| Service | Image / build | Port | Depends on | Readiness (healthcheck) |
| --- | --- | --- | --- | --- |
| `postgres` | `postgres:16`; `POSTGRES_USER=tutor`, `POSTGRES_PASSWORD=tutor`, `POSTGRES_DB=tutor_cabinet`; volume `pgdata:/var/lib/postgresql/data` | `5432` only inside the compose network (not published to the host) | — | `pg_isready -U tutor -d tutor_cabinet`; `interval: 5s`, `timeout: 3s`, `retries: 12` |
| `backend` | `build: ./backend` (`Dockerfile`, `python:3.12-slim`); variables from the "Backend environment variables" table; `COGNITO_AUTHORITY`/`COGNITO_CLIENT_ID` come from the shell environment or `.env`, with placeholders until a pool exists (then all protected endpoints answer `401`) | `8000:8000` | `postgres` with `condition: service_healthy` | `python -c` with `urllib.request.urlopen("http://127.0.0.1:8000/api/health")`; `interval: 5s`, `timeout: 3s`, `retries: 12`, `start_period: 10s`. Becomes healthy only after `alembic upgrade head` and Uvicorn's start. |

The backend connects to the database at the host `postgres`. The test database `tutor_cabinet_test` lives in the same container; `tests/conftest.py` creates it. Locally the grader is not a service but a one-off `make grade` (a container from the backend image calling `http://backend:8000`).

## `infra/`

> **Current state.** The prototype is deployed on Render: `infra/` contains [`render.yaml`](infra/render.yaml) (database, API and site as one Blueprint) and a [step-by-step guide](infra/README.md) for Cognito, Google, Telegram and LiqPay. Everything below in this section is the **target production setup for AWS with Terraform; it is not implemented yet**: there are no `*.tf` files in the repository.

Purpose: all cloud infrastructure as code. Terraform, **one root module**, no submodules. State and runs live in an HCP Terraform workspace in **remote execution** mode; variables and AWS access are set in the workspace. `terraform apply` runs only in HCP Terraform after a merge; it is not in the Makefile. For now, only the file descriptions exist.

| File | What it describes |
| --- | --- |
| `versions.tf` | `required_version >= 1.10`; a `cloud` block (the team's organization, workspace `tutor-cabinet`); provider `hashicorp/aws ~> 6.0`, region `var.region`; `default_tags { PROJECT_NAME = var.project_name, ManagedBy = "terraform" }` — a tag on every resource. |
| `variables.tf` | `liqpay_public_key`, `liqpay_private_key` (sensitive), `liqpay_sandbox`; `region` (default `us-east-1`), `project_name` (default `tutor-cabinet`), `domain_prefix` (Cognito), `google_client_id`, `google_client_secret` (sensitive), `db_password` (sensitive), `github_repository` (`owner/name`), `backend_image_tag` (the tag of the first image; after that the deployment updates the image). There are no values in the repository; they are workspace variables. |
| `network.tf` | Its own VPC; two private subnets in two AZs (required by the DB subnet group); no Internet Gateway, no NAT, no VPC endpoints — the API Lambda does not call AWS APIs (presigned S3 URLs are signed locally, and Bedrock is called by another Lambda outside the VPC). Security groups: `lambda` (egress only 5432 to `db`), `db` (ingress 5432 only from `lambda`). |
| `database.tf` | A DB subnet group; an Aurora PostgreSQL 16 cluster, Serverless v2 `min_capacity = 0`, `max_capacity = 1`, auto-pause; one `db.serverless` instance; storage encryption; 7-day backups; a final snapshot on deletion; the master password from `var.db_password`. |
| `api.tf` | The backend ECR repository (`IMMUTABLE` tags, because tag = commit SHA); the Lambda IAM role with `AWSLambdaVPCAccessExecutionRole`; a CloudWatch log group (14 days); Lambda `package_type = "Image"`, `linux/amd64` (x86_64), 512 MB, timeout 30 s, `vpc_config` with the subnets and the `lambda` SG; env `DATABASE_URL`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `CORS_ORIGINS`, `COGNITO_JWKS` (initially `{"keys":[]}`), `STORAGE_BACKEND=s3`, `UPLOADS_BUCKET`, `GRADER_TOKEN`, `AI_GRADER`, `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`, `LIQPAY_SANDBOX`, `SITE_URL`, `PUBLIC_API_URL` (the function URL — LiqPay's `server_url` is built from it); the role has `s3:PutObject`/`s3:GetObject` on the bucket's `homework/*` and `materials/*` (without it presigned URLs are signed, but S3 rejects them); `lifecycle.ignore_changes` on `image_uri` and `COGNITO_JWKS`, because the deployment updates them; a function URL with `authorization_type = "NONE"` (the application does authentication) and **without** a `cors` block (FastAPI does CORS — one mechanism locally and in the cloud). |
| `uploads.tf` | A private S3 bucket for homework photos and materials (`homework/*`, `materials/*`): block public access, SSE-S3 encryption, CORS only for the site's domain (`POST` for upload, `GET` for viewing), no versioning. The type and size limits are set by the presigned POST (`Content-Type`, `content-length-range` up to 10 MB). |
| `grader.tf` | The grader Lambda from the same ECR image (`image_config.command = ["app.grader.lambda_handler.handler"]`), **without `vpc_config`** (it has internet without NAT), 256 MB, timeout 120 s, no reserved concurrency (on new accounts the overall limit can be 10 and a reservation would not apply; the lease protects against double grading); env `API_URL` (the API function URL), `GRADER_TOKEN`, `GRADER=bedrock`, `GRADER_MODEL=anthropic.claude-haiku-5-5`. Role: logs + `bedrock-mantle:CreateInference` only on this model; no S3 access is needed — the worker downloads materials via a signed link from the API. The same worker also generates quizzes from materials. EventBridge Scheduler once a minute (within the free tier). An `aws_budgets_budget` of $1 for Bedrock and AWS Marketplace with an e-mail alert — the first two budgets are free. `GRADER_TOKEN` is a `random_password` in the HCP state. |
| `site.tf` | A private S3 bucket (block public access, no website hosting); a CloudFront distribution with Origin Access Control; the bucket policy allows `s3:GetObject` only for this distribution; `default_root_object = "index.html"`; 403/404 → `/index.html` with code 200 for SPA routes; `PriceClass_100`; the default CloudFront certificate. |
| `auth.tf` | A Cognito user pool (email as username, email auto-verification, self sign-up); a Google identity provider; a public web client (code flow, PKCE, no secret, scopes `openid email profile`, callback/logout — the CloudFront domain and `http://localhost:5173/`); a managed login version 2 domain and branding. |
| `ci.tf` | A GitHub OIDC provider (`token.actions.githubusercontent.com`); a deploy IAM role trusted only for `repo:${var.github_repository}:ref:refs/heads/main`. Permissions: push to the backend ECR repository; `lambda:GetFunctionConfiguration`, `UpdateFunctionConfiguration`, `UpdateFunctionCode`, `InvokeFunction` on the backend function; `s3:ListBucket`/`PutObject`/`DeleteObject` on the site bucket; `cloudfront:CreateInvalidation` on the distribution. No long-lived keys. |
| `outputs.tf` | `site_url`, `api_url`, `cognito_authority`, `cognito_client_id`, `cognito_domain`, `ecr_repository_url`, `lambda_function_name`, `grader_function_name`, `uploads_bucket`, `frontend_bucket`, `cloudfront_distribution_id`, `deploy_role_arn`. The names match the Makefile variables. The deployment updates the code of both Lambdas with the same image. |

### Target architecture in AWS (us-east-1)

```text
browser ──HTTPS──▶ CloudFront (OAC) ──▶ S3 (private): static frontend
   │
   ├──OIDC code+PKCE──▶ Cognito managed login (email+password, Google)
   │
   ├──HTTPS + Bearer──▶ Lambda function URL ──▶ API Lambda (FastAPI + Mangum, image from ECR)
   │                          ▲                     │  in the VPC, private subnets, no NAT
   │                          │                     └──5432──▶ Aurora Serverless v2 PostgreSQL (0–1 ACU)
   │                          │ X-Grader-Token
   │                          │
   │             Grader Lambda (same image, outside the VPC) ◀── EventBridge Scheduler, once a minute
   │                          └──HTTPS──▶ Amazon Bedrock: Claude Haiku 5.5
   │
   └──presigned POST / GET──▶ S3 (private): homework photos
```

Why the grader is outside the VPC: the API Lambda without NAT or VPC endpoints cannot reach Bedrock, and NAT (~$33/month) or an interface endpoint (~$7/month per AZ) are billed hourly. A Lambda outside the VPC has internet for free; it cannot see the database and works only through `/api/internal/grading` (ADR 0008).

A consequence of `min_capacity = 0`: after idle time the first request waits for Aurora to wake up (around 15 seconds). The frontend shows a loading state and does not treat it as an error; the Lambda timeout is 30 s.

## Makefile

Purpose: the single recipe for deployment and local checks. There is no `terraform apply` here.

**Implemented now** are only the local targets; all of them run in the backend image (`docker compose run --rm --build backend ...`), so locally only Docker is needed:

| Target | What it does |
| --- | --- |
| `lint` | `lint-frontend`, then `ruff check .` and `ruff format --check .` |
| `test` | `pytest` (compose starts `postgres` and waits for it) |
| `seed` | `python -m app.seed --tutor-sub "$(TUTOR_SUB)"`, `TUTOR_SUB` default `local-dev` |
| `migrate-local` | `alembic upgrade head` on the local database (the backend migrates on start anyway; this target is for a new revision while it is running) |
| `grade` | One pass of the AI worker against a running `docker compose up`: grading, then quiz generation. The container runs in the backend container's network (`--network container:...`), so material links `http://localhost:8000/api/files/...` work. `GRADER=fake` (default, free) or `GRADER=bedrock` (Claude Haiku 5.5 with local AWS credentials: mounts `~/.aws`, passes `AWS_PROFILE`; fractions of a cent per quiz or generation). |
| `lint-frontend` | `npm ci`, `npm run lint`, `npm run format:check` in `frontend/`; `lint` depends on it. |

The deployment targets below will appear together with the Terraform part of `infra/`; CI will then call the same targets and will not duplicate their commands.

Deployment variables are read by default from `terraform -chdir=infra output -raw <name>` (locally, after `terraform login`); in CI they are set explicitly from GitHub repository variables. AWS access comes from the caller (a local profile or the OIDC role in CI) — the Makefile has no keys.

| Target | Required variables | What it does |
| --- | --- | --- |
| `deploy-backend` | `ECR_REPOSITORY_URL`, `LAMBDA_FUNCTION_NAME`, `GRADER_FUNCTION_NAME`, `COGNITO_AUTHORITY`; `IMAGE_TAG` (default — the full `git rev-parse HEAD`), `AWS_REGION` (default `us-east-1`) | Refuses with a dirty working tree. Logs in to ECR. If there is no image tagged `IMAGE_TAG` yet — `docker buildx build -f backend/Dockerfile.lambda --platform linux/amd64 --provenance=false` and push. Downloads `${COGNITO_AUTHORITY}/.well-known/jwks.json` and writes it into `COGNITO_JWKS`, keeping the function's other variables; waits for `function-updated`. Updates the code of both functions (API and grader) to `<repo>:<IMAGE_TAG>`; waits for `function-updated`. |
| `migrate` | `LAMBDA_FUNCTION_NAME`, `AWS_REGION` | `aws lambda invoke` with the payload `{"action": "migrate"}`; fails if the response has `FunctionError` or lacks `"migrated": true`. |
| `deploy-frontend` | `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `API_URL`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN` | `npm ci` and `npm run build` with `VITE_*`; `aws s3 sync frontend/dist/` with `--delete` (hashed assets — `max-age=31536000, immutable`, `index.html` — `no-cache`); CloudFront invalidation `/*`. |
| `infra-plan` | `terraform login` to HCP | `terraform -chdir=infra fmt -check`, `init`, `validate`, `plan` (the plan runs remotely in HCP Terraform). |

Deployment order: `deploy-backend` → `migrate` → `deploy-frontend`. The migration is run by the new image, because the Alembic revisions are inside it. So every migration must be compatible with the previous version of the code (add first, remove in the next release).

## CI and deployment (`.github/workflows/`)

**What exists now:** `backend.yml`: on every `push` to any branch — `actions/setup-python@v5` (3.12), `pip install ".[dev]"`, `ruff check .`, `ruff format --check .`, `pytest` in `backend/` with a `postgres:16` service container and `TEST_DATABASE_URL`. It has no AWS access. `reminders.yml` is a backup scheduler for Telegram reminders (calls `/api/internal/reminders/run` with `CRON_TOKEN`). `ai-worker.yml` is the AI worker for the Render deployment: every 5 minutes it runs `python -m app.grader.run --grader bedrock` against the API (`GRADER_TOKEN`, AWS keys of an IAM user limited to Bedrock), standing in for the grader Lambda and its EventBridge schedule. Deployment to Render happens automatically on push to `main` (Render's own auto-deploy).

Target state for AWS (`backend.yml` is then absorbed by `ci.yml`):

| File | Triggers | What it does |
| --- | --- | --- |
| `ci.yml` | `pull_request`; `push` to any branch except `main`; `workflow_call` | Job `backend`: `actions/setup-python@v5` (3.12), `pip install "./backend[dev]"`, `ruff check backend`, `ruff format --check backend`, `pytest` in `backend/` with a `postgres:16` service container and `TEST_DATABASE_URL`. Job `frontend`: `actions/setup-node@v4` (20.15.1), `npm ci`, `npm run lint`, `npm run format:check` in `frontend/`. No AWS access. |
| `deploy.yml` | `push` to `main` | First calls `ci.yml` (`uses: ./.github/workflows/ci.yml`). Then the `deploy` job (`needs` on CI, `concurrency: deploy` without cancellation): `permissions: id-token: write, contents: read`; `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}` and `us-east-1`; `docker/setup-buildx-action@v3`; `make deploy-backend IMAGE_TAG=${{ github.sha }}`, `make migrate`, `make deploy-frontend`. |

GitHub repository variables (not secrets — they contain no secrets): `AWS_DEPLOY_ROLE_ARN`, `ECR_REPOSITORY_URL`, `LAMBDA_FUNCTION_NAME`, `API_URL`, `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `COGNITO_AUTHORITY`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`. The values are copied from `terraform output` once after the first apply.

## `docs/adr/`

Purpose: architecture decisions with context and rejected alternatives, so that half a year later it is clear *why* things are the way they are. Format: status, context, decision, consequences. A new ADR is written whenever any contract in this document changes.

| ADR | Decision |
| --- | --- |
| `0001-monorepo-layout.md` | One repository with `backend/`, `frontend/`, `infra/`; backend layers; the Makefile as the single deployment recipe. |
| `0002-backend-on-lambda-function-url.md` | A Lambda container image + function URL instead of ECS/Fargate or ALB: we pay per request, one image for the API and migrations. |
| `0003-aurora-serverless-v2-scale-to-zero.md` | Aurora Serverless v2 0–1 ACU: idle cost versus cold start; the password in an environment variable instead of Secrets Manager, because without NAT it needs a paid interface endpoint. |
| `0004-cognito-jwks-in-env.md` | A VPC without NAT → JWKS in `COGNITO_JWKS` at deployment; what to do when keys rotate. |
| `0005-money-in-kopecks-computed-balance.md` | Money is whole kopecks; the balance is computed, not stored. |
| `0006-time-zone-europe-kyiv.md` | `timestamptz` in the database, `Europe/Kyiv` for "today"/"month" and for API responses. |
| `0007-roles-and-invite-codes.md` | Three roles, one per account; students and parents get their role and access through a one-time code, not by email (the Cognito access token has no email). |
| `0008-ai-grading-outside-the-vpc.md` | The grader is a separate Lambda outside the VPC with Claude Haiku 5.5 on Bedrock; no NAT or endpoints; job leases and "no retries" as cost protection. |
| `0009-homework-photos-presigned.md` | Homework photos go straight to S3 via locally signed presigned URLs; locally — a volume and HMAC links instead of MinIO. |
| `0010-quiz-generation-from-materials.md` | Quizzes are generated from materials by the same worker outside the VPC; the result is only a draft the tutor checks; a limit of 3 unfinished generations. |
| `0011-tariffs-and-liqpay.md` | Free and Pro; LiqPay, because the form can be signed without network access; read-only above the limit; cancellation through the worker. |

Files `0001`–`0006` are not written yet; `0007`–`0011` exist (in Ukrainian).

## README.md

Purpose: the first page for a newcomer (in English). Sections: what it is and who it is for (with the live demo link and screenshots from `docs/screenshots/`), features, how to try it (online and locally with demo buttons), repository structure, how to deploy (short, linking to `infra/README.md`), developer commands, prototype limitations. Technical details live here, in `PROJECT.md`.

## Open questions

- **User email.** The Cognito access token does not contain `email`, and an API Lambda without internet cannot call `/oauth2/userInfo`, so `users.email` is empty in practice. The name is now set via `PATCH /api/me`. If the tutor needs the email (for example, in the list of linked accounts) — a pre-token-generation trigger in Cognito, as a separate ADR.
- **Whether AWS credits cover Claude on Bedrock.** Anthropic models on Bedrock are sold through AWS Marketplace, and promotional credits officially do not apply to Marketplace; user reports are contradictory. Hence: a $1 budget with an alert, a Cost Explorer check after the first real grading, and the `AI_GRADER=off` / `GRADER=off` switch. Access to `anthropic.claude-haiku-5-5` may need to be enabled in the Bedrock console (Model access).
- **Unfinished uploads and deleted materials.** A photo that was uploaded but not handed in, and the file of a deleted material, stay in S3. The volume is small (up to 10 MB per file); if it becomes noticeable — a daily cleanup of keys without a row in `submission_photos` / `materials`.
- **Generation quality on Haiku 5.5.** For short notes it is most likely enough, but for long PDFs or complex topics it is worth comparing with Claude Sonnet 5.5 or Opus 5.5 (`GRADER_MODEL`); that is more expensive, so the decision is the project owner's. The draft goes through the tutor anyway.
- **Demo sign-in** (`DEV_AUTH`, `VITE_DEV_LOGIN`) is only for local viewing. Both switches are off by default; in AWS the backend refuses to start with `DEV_AUTH=on`.
