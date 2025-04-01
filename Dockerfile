# syntax=docker/dockerfile:1

ARG ENV=prod

# Stage 1: Frontend builder for production
FROM node:22-slim AS frontend-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Stage 2: Base image with common dependencies
FROM python:3.13.2-slim AS base
WORKDIR /app

# Docker repository setup (needed for both dev and prod)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    chmod a+r /etc/apt/keyrings/docker.asc && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    docker-ce-cli \
    docker-compose-plugin \
    unzip \
    zip \
    libxml2-utils \
    sed && \
    rm -rf /var/lib/apt/lists/*

# Stage 3: Development environment
FROM base AS development
WORKDIR /app

# Node.js installation for development
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs=22.13.1-1nodesource1 && \
    rm -rf /var/lib/apt/lists/*

# Client dependencies setup with cache
WORKDIR /app/client
COPY client/package.json ./
COPY package-lock.json ./
RUN npm install --prefer-offline

# Python dependencies with Poetry - Install globally
WORKDIR /app/server
COPY server/pyproject.toml ./
COPY server/poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install

# Application setup
RUN mkdir -p /app/logs && chmod -R 755 /app/logs
COPY . .

# Dev command to start both frontend and backend
CMD ["/bin/sh", "-c", "cd /app/client && npm run start & cd /app/server && poetry run python app.py"]

# Stage 4: Production environment
FROM base AS production
WORKDIR /app

# Python dependencies with Poetry - Install globally
WORKDIR /app/server
COPY server/pyproject.toml ./
COPY server/poetry.lock ./
RUN pip install poetry && \
    poetry config virtualenvs.create false && \
    poetry install

# Copy built frontend and backend files
COPY --from=frontend-builder /app/client/build /app/client/build
COPY server/ /app/server/

# Create required directories
RUN mkdir -p /app/logs && \
    chmod -R 755 /app/logs

CMD ["poetry", "run", "python", "/app/server/app.py"]

# Final image based on ARG ENV
FROM ${ENV} AS final
