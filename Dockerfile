FROM python:3.11-slim

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
RUN poetry install --no-interaction --no-ansi --no-root

# Copy Python source
COPY src ./src

# Copy and build frontend
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Back to app root
WORKDIR /app

EXPOSE 3000

# Start the Next.js frontend (which spawns Python agent)
CMD ["npm", "start", "--prefix", "frontend"]


