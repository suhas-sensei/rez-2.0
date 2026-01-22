FROM python:3.12-slim

# Install system deps + Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl ca-certificates git && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Poetry
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1
RUN pip install --no-cache-dir poetry

# Copy and install Python deps
COPY pyproject.toml poetry.lock ./
RUN poetry lock --no-update && poetry install --no-interaction --no-ansi --no-root

# Copy Python source
COPY src ./src

# Copy and build frontend
COPY frontend ./frontend

# Set backend URL for frontend (internal communication)
ENV BACKEND_URL=http://localhost:8000

WORKDIR /app/frontend
RUN npm install && npm run build

# Back to app root
WORKDIR /app

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

# Expose both ports
EXPOSE 3000 8000

# Start both services
CMD ["./start.sh"]
