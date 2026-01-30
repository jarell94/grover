FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY microservices/shared /app/microservices/shared

# Copy gateway code
COPY microservices/gateway /app/microservices/gateway

WORKDIR /app/microservices/gateway

EXPOSE 8000

CMD ["python", "main.py"]
