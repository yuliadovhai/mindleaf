SHELL := /bin/sh

# Every target runs inside the backend image (python:3.12-slim), so the only
# local requirement is Docker. `--build` keeps the image in step with the code.
COMPOSE     = docker compose
BACKEND_RUN = $(COMPOSE) run --rm --build backend

# Seed owner. "local-dev" by default; pass your real Cognito sub to see the demo
# data after signing in: make seed TUTOR_SUB=<sub>
TUTOR_SUB ?= local-dev

.PHONY: lint lint-frontend test seed migrate-local grade

lint: lint-frontend
	$(COMPOSE) run --rm --build --no-deps backend sh -c "ruff check . && ruff format --check ."

lint-frontend:
	cd frontend && npm ci && npm run lint && npm run format:check

test:
	$(BACKEND_RUN) pytest

# Migrates first, so it also works on a fresh database before `docker compose up`.
seed:
	$(BACKEND_RUN) sh -c 'alembic upgrade head && python -m app.seed --tutor-sub "$(TUTOR_SUB)"'

# The backend already migrates on start; this is for a new revision while it runs.
migrate-local:
	$(BACKEND_RUN) alembic upgrade head

# One pass of the AI worker against the running backend (docker compose up):
# grades written quiz answers, then turns queued materials into draft quizzes.
# It shares the backend container's network, so material links
# (http://localhost:8000/api/files/...) work as they do for the browser.
# GRADER=fake (default, free) or GRADER=bedrock (Claude Haiku 5.5 with your
# local AWS credentials; a fraction of a cent per quiz).
GRADER ?= fake
GRADER_TOKEN ?= local-dev-grader-token
AWS_DIR ?= $(HOME)/.aws
grade:
	@test -n "$$($(COMPOSE) ps -q backend)" || (echo "start the backend first: docker compose up -d"; exit 1)
	docker run --rm --network container:$$($(COMPOSE) ps -q backend) \
	  -e GRADER_TOKEN=$(GRADER_TOKEN) \
	  $(if $(filter bedrock,$(GRADER)),-v "$(AWS_DIR):/root/.aws:ro" -e AWS_PROFILE -e AWS_REGION=us-east-1) \
	  tutor-cabinet-backend python -m app.grader.run --api http://localhost:8000 --grader $(GRADER)
