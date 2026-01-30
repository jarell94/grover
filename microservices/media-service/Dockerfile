FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY microservices/shared /app/microservices/shared

# Copy backend code (needed for media_service.py)
COPY backend /app/backend

# Copy service code
COPY microservices/media-service /app/microservices/media-service

WORKDIR /app/microservices/media-service

# Set Python path to include backend
ENV PYTHONPATH=/app/backend:/app

EXPOSE 8003

CMD ["python", "main.py"]
