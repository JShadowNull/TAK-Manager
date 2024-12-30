# syntax=docker/dockerfile:1

FROM python:3.11-slim as base

WORKDIR /app
# Install build tools and dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    zip \
    unzip \
    docker.io \
    docker-compose \
    libxml2-utils \
    sed \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create required directories
RUN mkdir -p /app/logs && \
    chmod -R 755 /app/logs

# Copy application code
COPY . .

# Development stage
FROM base as development
ENV FLASK_ENV=development
ENV FLASK_DEBUG=1
ENV PYTHONUNBUFFERED=1
ENV WERKZEUG_DEBUG_PIN=off
ENV EVENTLET_DEBUG=true
EXPOSE 8989
CMD ["python", "app_dev.py"]

# Production stage
FROM base as production
ENV FLASK_ENV=production
ENV FLASK_DEBUG=0
ENV PYTHONUNBUFFERED=1
EXPOSE 8989
CMD ["python", "app.py"] 