# Grover Microservices - Quick Start Guide

## Overview

This directory contains the microservices implementation of the Grover social media platform, built using the API Gateway pattern.

## Architecture

```
API Gateway (8000) → User Service (8001)
                  → Post Service (8002)
                  → Media Service (8003)
                  → Payment Service (8004)
```

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ (for local development)
- MongoDB (or use Docker container)

## Quick Start with Docker

### 1. Start All Services

```bash
# From repository root
docker-compose up -d
```

This will start:
- MongoDB (port 27017)
- API Gateway (port 8000)
- User Service (port 8001)
- Post Service (port 8002)

### 2. Check Service Health

```bash
# Check gateway
curl http://localhost:8000/health

# Check all services
curl http://localhost:8000/health/services
```

### 3. Access API Documentation

- **Gateway**: http://localhost:8000/docs
- **User Service**: http://localhost:8001/docs
- **Post Service**: http://localhost:8002/docs

### 4. Test the API

```bash
# Via Gateway (recommended)
curl http://localhost:8000/api

# Direct service access (for testing)
curl http://localhost:8001/api/auth/me
```

### 5. Stop Services

```bash
docker-compose down
```

## Local Development (Without Docker)

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:6.0

# Or use local MongoDB installation
mongod --dbpath /path/to/data
```

### 3. Start Services

Open 3 terminals:

**Terminal 1 - User Service:**
```bash
cd microservices/user-service
export PORT=8001
export MONGO_URL=mongodb://localhost:27017
export DB_NAME=grover_users
python main.py
```

**Terminal 2 - Post Service:**
```bash
cd microservices/post-service
export PORT=8002
export MONGO_URL=mongodb://localhost:27017
export DB_NAME=grover_posts
export USER_SERVICE_URL=http://localhost:8001
python main.py
```

**Terminal 3 - API Gateway:**
```bash
cd microservices/gateway
export PORT=8000
export USER_SERVICE_URL=http://localhost:8001
export POST_SERVICE_URL=http://localhost:8002
python main.py
```

### 4. Test Services

```bash
# Check health
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
```

## Service URLs

### API Gateway (Port 8000)
- Health: http://localhost:8000/health
- Docs: http://localhost:8000/docs
- API: http://localhost:8000/api

### User Service (Port 8001)
- Health: http://localhost:8001/health
- Docs: http://localhost:8001/docs
- Auth: http://localhost:8001/api/auth
- Users: http://localhost:8001/api/users

### Post Service (Port 8002)
- Health: http://localhost:8002/health
- Docs: http://localhost:8002/docs
- Posts: http://localhost:8002/api/posts

## Environment Variables

### Gateway
- `PORT` - Gateway port (default: 8000)
- `USER_SERVICE_URL` - User service URL
- `POST_SERVICE_URL` - Post service URL
- `MEDIA_SERVICE_URL` - Media service URL
- `PAYMENT_SERVICE_URL` - Payment service URL

### User Service
- `PORT` - Service port (default: 8001)
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name (default: grover_users)
- `JWT_SECRET` - Secret for JWT tokens

### Post Service
- `PORT` - Service port (default: 8002)
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name (default: grover_posts)
- `USER_SERVICE_URL` - User service URL for auth validation

## API Examples

### Create Session (via Gateway)

```bash
curl -X GET "http://localhost:8000/api/auth/session?session_id=YOUR_SESSION_ID"
```

### Get Current User

```bash
curl -X GET "http://localhost:8000/api/auth/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Post

```bash
curl -X POST "http://localhost:8000/api/posts/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from microservices!",
    "media_url": null,
    "media_type": null,
    "tagged_users": [],
    "location": null
  }'
```

### Get Feed

```bash
curl -X GET "http://localhost:8000/api/posts/feed/me" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Services won't start

**Check Docker logs:**
```bash
docker-compose logs gateway
docker-compose logs user-service
docker-compose logs post-service
```

**Check if ports are available:**
```bash
lsof -i :8000  # Gateway
lsof -i :8001  # User Service
lsof -i :8002  # Post Service
lsof -i :27017 # MongoDB
```

### Database connection issues

**Test MongoDB connection:**
```bash
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

**Check database exists:**
```bash
docker-compose exec mongodb mongosh
> show dbs
> use grover_users
> show collections
```

### Service communication issues

**Test service-to-service communication:**
```bash
# From gateway container
docker-compose exec gateway curl http://user-service:8001/health
docker-compose exec gateway curl http://post-service:8002/health
```

## Development Workflow

### Adding a New Service

1. Create service directory: `microservices/new-service/`
2. Create `main.py` with FastAPI app
3. Create `Dockerfile`
4. Add service to `docker-compose.yml`
5. Update gateway routing in `gateway/main.py`
6. Update service registry

### Testing Changes

```bash
# Rebuild and restart specific service
docker-compose up -d --build user-service

# View logs
docker-compose logs -f user-service
```

### Debugging

```bash
# Access service shell
docker-compose exec user-service /bin/bash

# Check Python imports
docker-compose exec user-service python -c "import repositories.user_repository"
```

## Performance Tips

1. **Use Gateway for Production**: Route all client requests through the gateway
2. **Health Checks**: Monitor service health regularly
3. **Database Indexes**: Ensure proper indexes in MongoDB
4. **Connection Pooling**: Configure database connection pools
5. **Caching**: Add Redis for frequently accessed data (future)

## Security Considerations

1. **Authentication**: Always use gateway for client authentication
2. **Service-to-Service**: Consider service mesh for mTLS (future)
3. **Environment Variables**: Use secrets management in production
4. **Network Isolation**: Services communicate on private network
5. **Rate Limiting**: Implement at gateway level

## Monitoring

### Health Checks

```bash
# Check all services
curl http://localhost:8000/health/services | jq

# Individual services
curl http://localhost:8001/health/db  # User Service DB
curl http://localhost:8002/health/dependencies  # Post Service dependencies
```

### Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f gateway
docker-compose logs -f user-service --tail=100
```

## Migration from Monolith

The microservices architecture is built on top of the modular monolith in `backend/`. Services reuse:
- Repositories (data access layer)
- Services (business logic)
- Schemas (data models)
- Routers (API endpoints)

This allows for incremental migration and code reuse.

## Next Steps

1. **Extract More Services**: Media, Payment, Notification services
2. **Add Message Broker**: RabbitMQ/Kafka for async communication
3. **Implement Caching**: Redis for performance
4. **Service Mesh**: Istio for advanced traffic management
5. **Monitoring**: Prometheus + Grafana
6. **Distributed Tracing**: Jaeger for request tracing

## Documentation

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Gateway**: See [gateway/README.md](./gateway/README.md) (to be created)
- **Monolith Docs**: See [../backend/ARCHITECTURE.md](../backend/ARCHITECTURE.md)

## Support

For issues or questions:
1. Check service logs: `docker-compose logs`
2. Verify health checks: `curl http://localhost:8000/health/services`
3. Review documentation: `microservices/ARCHITECTURE.md`
