FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/uv.lock .

RUN uv sync --frozen

COPY backend/ .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8765

CMD ["uv", "run", "python", "main.py"]
