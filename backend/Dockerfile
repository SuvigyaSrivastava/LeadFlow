FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN useradd --create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

# Apply migrations, then serve. Migrations are idempotent, so restarts are safe.
# Set SEED_DEMO_DATA=true on a fresh hosted database to load demo leads (only runs when empty).
CMD ["sh", "-c", "alembic upgrade head && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then python -m scripts.seed --if-empty; fi && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
