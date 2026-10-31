# ==============================================================================
# PolicySetu AI - Production Dockerfile
# Python 3.11 with system ffmpeg for WhatsApp native OGG Opus audio encoding
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies including ffmpeg for WhatsApp audio encoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Ensure data directories exist
RUN mkdir -p /app/data/storage /app/data/audio /app/data/documents /app/data/qdrant_db

# Expose ports:
# 8000: FastAPI Live WhatsApp Backend
# 8501: Streamlit Live Judge Transparency Monitor
EXPOSE 8000 8501

# Default command: launch FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
