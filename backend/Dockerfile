FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required by some Python packages (e.g. Pillow, cryptography)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

EXPOSE 8001

# Use uvicorn to serve the Socket.IO-wrapped ASGI app.
# WEB_CONCURRENCY defaults to 1; set higher on multi-core hosts for more throughput.
CMD ["sh", "-c", "uvicorn server:app_with_socketio --host 0.0.0.0 --port 8001 --workers ${WEB_CONCURRENCY:-1}"]
