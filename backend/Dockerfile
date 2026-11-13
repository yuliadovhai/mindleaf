FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
# app/ is not copied yet, so this installs only the dependencies (layer cache).
RUN pip install --no-cache-dir ".[dev]"

COPY . ./

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
