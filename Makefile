SHELL := /bin/sh

# Every target runs inside the backend image (python:3.12-slim), so the only
# local requirement is Docker. `--build` keeps the image in step with the code.
COMPOSE     = docker compose
BACKEND_RUN = $(COMPOSE) run --rm --build backend

# Seed owner. "local-dev" by default; pass your real Cognito sub to see the demo
# data after signing in: make seed TUTOR_SUB=<sub>
TUTOR_SUB ?= local-dev

.PHONY: lint test seed migrate-local

lint:
	$(COMPOSE) run --rm --build --no-deps backend sh -c "ruff check . && ruff format --check ."

test:
	$(BACKEND_RUN) pytest

# Migrates first, so it also works on a fresh database before `docker compose up`.
seed:
	$(BACKEND_RUN) sh -c 'alembic upgrade head && python -m app.seed --tutor-sub "$(TUTOR_SUB)"'

# The backend already migrates on start; this is for a new revision while it runs.
migrate-local:
	$(BACKEND_RUN) alembic upgrade head
