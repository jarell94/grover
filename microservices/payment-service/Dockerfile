FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY microservices/shared /app/microservices/shared

# Copy backend code (needed for paypal services)
COPY backend /app/backend

# Copy service code
COPY microservices/payment-service /app/microservices/payment-service

WORKDIR /app/microservices/payment-service

# Set Python path to include backend
ENV PYTHONPATH=/app/backend:/app

EXPOSE 8004

CMD ["python", "main.py"]
