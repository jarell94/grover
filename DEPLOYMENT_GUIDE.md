# Grover Backend Deployment Guide

## 🚀 Quick Deployment Checklist

Before deploying the Grover backend to production, ensure you complete these critical steps:

### ✅ Prerequisites

- [ ] Python 3.9+ installed
- [ ] MongoDB 4.4+ running and accessible
- [ ] Redis server running (recommended for caching)
- [ ] Cloudinary account set up (required for media uploads)
- [ ] Domain/server with HTTPS/SSL configured
- [ ] Environment variables configured

---

## 📋 Step-by-Step Deployment

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and set **all required variables**:

#### Required Variables:
```bash
# Database (REQUIRED)
MONGO_URL=mongodb://username:password@your-mongo-host:27017
DB_NAME=grover_production

# Media Storage (REQUIRED)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### Recommended Variables:
```bash
# Environment
ENVIRONMENT=production
APP_VERSION=1.0.0

# CORS (CRITICAL for production)
ALLOWED_ORIGINS=https://grover.com,https://www.grover.com,https://app.grover.com

# Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Caching (Recommended)
REDIS_URL=redis://your-redis-host:6379
```

#### Optional Services:
```bash
# PayPal (if using monetization)
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_MODE=live

# Agora (if using live streaming)
AGORA_APP_ID=your_app_id
AGORA_APP_CERTIFICATE=your_certificate
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Or using a virtual environment (recommended):

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Database Setup

Ensure MongoDB is running and accessible:

```bash
# Test MongoDB connection
mongosh "mongodb://your-connection-string"
```

The application will automatically create indexes on startup.

### 4. Security Hardening

#### MongoDB Security:
- ✅ Enable authentication
- ✅ Use strong passwords
- ✅ Restrict network access (firewall rules)
- ✅ Enable SSL/TLS for connections
- ✅ Regular backups

#### Application Security:
- ✅ Set specific ALLOWED_ORIGINS (no wildcards in production)
- ✅ Use HTTPS/TLS for all connections
- ✅ Rotate API keys regularly
- ✅ Enable rate limiting (consider using nginx or API gateway)
- ✅ Monitor error logs via Sentry

#### Environment Variables:
- ✅ Never commit `.env` file to version control
- ✅ Use secrets management (AWS Secrets Manager, HashiCorp Vault, etc.)
- ✅ Restrict file permissions: `chmod 600 .env`

### 5. Run the Application

#### Option A: Direct Run (Development/Testing)
```bash
cd backend
python server.py
```

#### Option B: Production Server (Recommended)
```bash
# Using uvicorn directly
uvicorn server:app_with_socketio --host 0.0.0.0 --port 8001 --workers 4

# Or with Gunicorn + Uvicorn workers
gunicorn server:app_with_socketio -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8001 \
  --workers 4 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
```

#### Option C: Docker (Recommended for Production)
```bash
# Build image
docker build -t grover-backend .

# Run container
docker run -d \
  --name grover-backend \
  -p 8001:8001 \
  --env-file .env \
  --restart unless-stopped \
  grover-backend
```

### 6. Verify Deployment

Check that all services are running:

```bash
# Health check
curl http://localhost:8001/api/health

# Expected response:
# {
#   "status": "healthy",
#   "services": {
#     "mongodb": {"status": "connected"},
#     "cloudinary": {"status": "configured"},
#     "redis": {"status": "connected"}
#   }
# }

# Readiness check
curl http://localhost:8001/api/ready

# Metrics endpoint
curl http://localhost:8001/api/metrics
```

---

## 🔍 Monitoring & Observability

### Health Checks

The application provides multiple health endpoints:

- **`/api/health`** - Detailed health check with all services
- **`/api/ready`** - Kubernetes-style readiness probe
- **`/api/metrics`** - Prometheus metrics

### Logging

Logs are written to stdout/stderr with different levels based on environment:
- Development: DEBUG level
- Production: INFO level

Configure log aggregation (ELK stack, CloudWatch, etc.) to collect logs.

### Error Tracking

If Sentry is configured, all errors are automatically tracked with:
- Stack traces
- User context (no PII)
- Environment information
- Performance metrics

### Metrics

Prometheus metrics available at `/api/metrics`:
- HTTP request metrics
- Database query metrics
- Custom business metrics (posts created, auth attempts, etc.)

---

## 🐳 Docker Deployment (Recommended)

### Create Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ .

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8001/api/health || exit 1

# Run application
CMD ["uvicorn", "server:app_with_socketio", "--host", "0.0.0.0", "--port", "8001"]
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: .
    ports:
      - "8001:8001"
    environment:
      MONGO_URL: mongodb://admin:password@mongodb:27017
      DB_NAME: grover
      REDIS_URL: redis://redis:6379
      ENVIRONMENT: development
    depends_on:
      - mongodb
      - redis

volumes:
  mongo_data:
```

---

## ☁️ Cloud Deployment Options

### AWS Deployment

1. **ECS/Fargate**: Run Docker container
2. **Elastic Beanstalk**: Python application platform
3. **EC2**: Manual server setup
4. **Lambda + API Gateway**: Serverless (requires adaptation)

**Services needed:**
- DocumentDB or MongoDB Atlas
- ElastiCache (Redis)
- S3 (if not using Cloudinary)
- CloudWatch (monitoring)
- Application Load Balancer

### Google Cloud Deployment

1. **Cloud Run**: Containerized application
2. **Compute Engine**: VM instances
3. **Kubernetes Engine**: Scalable orchestration

**Services needed:**
- Cloud Firestore or MongoDB Atlas
- Cloud Memorystore (Redis)
- Cloud Storage
- Cloud Monitoring

### Azure Deployment

1. **App Service**: Platform service
2. **Container Instances**: Docker containers
3. **Kubernetes Service**: Orchestration

**Services needed:**
- Cosmos DB or MongoDB Atlas
- Azure Cache for Redis
- Blob Storage
- Application Insights

### Heroku Deployment (Quick Start)

```bash
# Install Heroku CLI
heroku create grover-backend

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Add Redis addon
heroku addons:create heroku-redis:hobby-dev

# Set environment variables
heroku config:set ENVIRONMENT=production
heroku config:set CLOUDINARY_CLOUD_NAME=your_name
# ... set all other variables

# Deploy
git push heroku main
```

---

## 📊 Performance Optimization

### Recommended Settings

**Uvicorn Workers:**
- Development: 1-2 workers
- Production: Number of CPU cores × 2

**MongoDB:**
- Connection pool: 10-100 connections
- Enable indexes (automatic on startup)
- Use replica sets for high availability

**Redis:**
- Maxmemory policy: `allkeys-lru`
- Persistence: RDB snapshots
- Memory: 512MB-2GB

### Caching Strategy

The application uses Redis for:
- User profile caching
- Post enrichment caching
- Comment caching
- Session management

TTL (Time To Live):
- User profiles: 1 hour
- Posts: 5 minutes
- Comments: 5 minutes

### Database Optimization

Indexes are automatically created on startup for:
- User lookups (user_id, username, email)
- Post queries (user_id, created_at, post_type)
- Comments (post_id)
- Reactions (post_id, user_id)
- Messages (conversation_id)
- Notifications (user_id, read status)

---

## 🔧 Troubleshooting

### Common Issues

**1. "MONGO_URL environment variable is required"**
- Solution: Set MONGO_URL in .env file

**2. "Failed to connect to MongoDB"**
- Check MongoDB is running: `mongosh`
- Verify connection string
- Check network/firewall rules

**3. "Redis cache not available"**
- Non-critical, app runs without Redis
- To fix: Install Redis or set REDIS_URL

**4. "Cloudinary not configured"**
- Media uploads will fail
- Solution: Set Cloudinary credentials

**5. CORS errors in browser**
- Set ALLOWED_ORIGINS to your frontend domain
- Ensure HTTPS is used

**6. High memory usage**
- Reduce worker count
- Enable Redis caching
- Optimize MongoDB queries

### Debug Mode

Enable debug logging:
```bash
export ENVIRONMENT=development
```

Check logs:
```bash
# Docker
docker logs grover-backend

# Systemd
journalctl -u grover-backend -f

# Direct
python server.py 2>&1 | tee app.log
```

---

## 🔄 Updates & Maintenance

### Update Process

1. **Backup database**
   ```bash
   mongodump --uri="mongodb://your-connection" --out=backup/
   ```

2. **Update code**
   ```bash
   git pull origin main
   ```

3. **Update dependencies**
   ```bash
   pip install -r requirements.txt --upgrade
   ```

4. **Restart application**
   ```bash
   # Systemd
   sudo systemctl restart grover-backend
   
   # Docker
   docker-compose down && docker-compose up -d
   ```

5. **Verify health**
   ```bash
   curl http://localhost:8001/api/health
   ```

### Database Migrations

Currently, schema changes are applied automatically via:
- Index creation on startup
- Backward-compatible field additions

For breaking changes:
1. Deploy migration script
2. Run migration
3. Deploy new code
4. Verify data integrity

---

## 🛡️ Security Best Practices

### Application Level
- ✅ Input validation on all endpoints
- ✅ SQL/NoSQL injection prevention
- ✅ XSS protection (input sanitization)
- ✅ CSRF protection (token-based)
- ✅ Rate limiting (per endpoint)
- ✅ File upload validation
- ✅ Authentication required for sensitive endpoints

### Infrastructure Level
- ✅ Use HTTPS/TLS everywhere
- ✅ Firewall rules (restrict database access)
- ✅ Regular security updates
- ✅ Secrets management
- ✅ Network segmentation
- ✅ DDoS protection (CloudFlare, AWS Shield)
- ✅ Regular backups

### Monitoring
- ✅ Error tracking (Sentry)
- ✅ Performance monitoring (Prometheus + Grafana)
- ✅ Security scanning (Dependabot, Snyk)
- ✅ Log analysis
- ✅ Anomaly detection

---

## 📞 Support

For deployment issues:
1. Check logs first
2. Verify environment variables
3. Test database connectivity
4. Review this guide
5. Check GitHub issues

---

## 📝 Changelog

### Version 1.0.0 (Current)
- ✅ Production-ready backend
- ✅ Comprehensive error handling
- ✅ Environment-based configuration
- ✅ Health checks and monitoring
- ✅ Consolidated startup handlers
- ✅ Improved logging

---

**Last Updated:** 2024-02-05
**Maintained by:** Grover Development Team
