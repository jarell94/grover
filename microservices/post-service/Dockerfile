FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY microservices/shared /app/microservices/shared

# Copy backend code (needed for repositories, services, schemas, routers)
COPY backend /app/backend

# Copy service code
COPY microservices/post-service /app/microservices/post-service

WORKDIR /app/microservices/post-service

# Set Python path to include backend
ENV PYTHONPATH=/app/backend:/app

EXPOSE 8002

CMD ["python", "main.py"]
