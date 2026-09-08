# --- builder stage: install deps and generate the geodata file ---
FROM python:3.12-slim AS builder

WORKDIR /app

RUN pip install --no-cache-dir poetry==2.4.1 \
    && poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock ./
RUN poetry install --no-root --without dev --no-interaction

COPY . .
RUN python scripts/fetch_geodata.py

# --- runtime stage: slim image with only what's needed to run ---
FROM python:3.12-slim

WORKDIR /app

# Copy installed site-packages and console scripts (uvicorn) from the builder venv-less install
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# App code + the geodata file generated in the builder stage
COPY --from=builder /app /app

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# Render/Heroku-style platforms inject $PORT; default to 8000 for local `docker run`
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
