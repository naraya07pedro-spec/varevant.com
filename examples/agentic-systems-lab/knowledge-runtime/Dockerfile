FROM ghcr.io/astral-sh/uv:0.12.19 AS uv
FROM python:3.12-slim-bookworm
COPY --from=uv /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY knowledge_runtime ./knowledge_runtime
COPY migrations ./migrations
COPY evals ./evals
RUN uv sync --locked --no-dev && useradd --uid 10001 --create-home knowledge
ENV PATH="/app/.venv/bin:$PATH"
USER 10001
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "knowledge_runtime.api:factory", "--factory", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
