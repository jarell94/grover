# Grover Microservices Architecture

## Overview

This document describes the microservices architecture implementation for the Grover social media platform. The architecture transforms the modular monolith into independently deployable microservices with an API Gateway pattern.

## Architecture Diagram

```
                                    ┌─────────────────┐
                                    │   Clients       │
                                    │  (Web/Mobile)   │
                                    └────────┬────────┘
                                             │
                                             ↓
                           ┌──────────────────────────────────┐
                           │       API Gateway (Port 8000)     │
                           │  - Request Routing                │
                           │  - Authentication                 │
                           │  - Rate Limiting                  │
                           │  - Circuit Breaking               │
                           └──────────────┬───────────────────┘
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 │                        │                        │
                 ↓                        ↓                        ↓
       ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
       │  User Service   │    │  Post Service    │    │  Media Service   │
       │   (Port 8001)   │    │   (Port 8002)    │    │   (Port 8003)    │
       │                 │    │                  │    │                  │
       │ - Auth          │    │ - Posts CRUD     │    │ - File Upload    │
       │ - Profiles      │    │ - Feed           │    │ - Cloudinary     │
       │ - Follow System │    │ - Likes          │    │ - Media Process  │
       └────────┬────────┘    └────────┬─────────┘    └──────────────────┘
                │                      │
                ↓                      ↓
       ┌─────────────────┐    ┌──────────────────┐
       │  MongoDB (Users)│    │ MongoDB (Posts)  │
       │   Port 27017    │    │   Port 27017     │
       └─────────────────┘    └──────────────────┘
```

## Service Boundaries

### 1. API Gateway (Port 8000)
**Responsibility**: Single entry point for all client requests

**Features**:
- Request routing to appropriate microservices
- Authentication and authorization
- Rate limiting and throttling
- Circuit breaker pattern
- Request/response transformation
- Centralized logging
- Health checks aggregation

**Technology**: FastAPI, httpx

### 2. User Service (Port 8001)
**Responsibility**: User management and authentication

**Features**:
- User authentication (OAuth)
- User profiles (CRUD)
- Follow/unfollow system
- User search
- User statistics
- Notification preferences

**Database**: MongoDB (`grover_users`)

**Endpoints**:
- `POST /api/auth/session` - Create session
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/users/{user_id}` - Get user profile
- `PUT /api/users/profile` - Update profile
- `POST /api/users/{user_id}/follow` - Follow user
- `GET /api/users/{user_id}/followers` - Get followers
- `GET /api/users/search/{query}` - Search users

### 3. Post Service (Port 8002)
**Responsibility**: Post management and social interactions

**Features**:
- Post CRUD operations
- Feed generation
- Like/unlike posts
- Reactions system
- Save/bookmark posts
- Post search
- Share functionality

**Database**: MongoDB (`grover_posts`)

**Dependencies**: User Service (for authentication)

**Endpoints**:
- `POST /api/posts/` - Create post
- `GET /api/posts/{post_id}` - Get post
- `PUT /api/posts/{post_id}` - Update post
- `DELETE /api/posts/{post_id}` - Delete post
- `GET /api/posts/feed/me` - Get personalized feed
- `GET /api/posts/explore/all` - Get explore posts
- `POST /api/posts/{post_id}/like` - Like post
- `POST /api/posts/{post_id}/react` - Add reaction
- `POST /api/posts/{post_id}/save` - Save post

### 4. Media Service (Port 8003) - Future
**Responsibility**: Media upload and processing

**Features**:
- File upload handling
- Image/video processing
- Cloudinary integration
- Media optimization
- CDN management

### 5. Payment Service (Port 8004) - Future
**Responsibility**: Payment processing

**Features**:
- PayPal integration
- Order management
- Transaction processing
- Payout handling

## Service Communication

### Synchronous Communication (REST)
- Services communicate via HTTP/REST APIs
- API Gateway routes requests to services
- Services can call each other directly when needed

**Example**: Post Service calls User Service to validate authentication tokens

```python
# In Post Service
response = await make_service_request(
    user_service_url,
    "/api/auth/me",
    headers={"Authorization": auth_token}
)
```

### Asynchronous Communication (Future)
- Message broker (RabbitMQ/Redis) for event-driven architecture
- Pub/Sub pattern for notifications
- Event sourcing for audit logs

## Data Management

### Database per Service Pattern
Each microservice has its own database:
- **User Service**: `grover_users` database
- **Post Service**: `grover_posts` database
- **Payment Service**: `grover_payments` database (future)

### Data Consistency
- **Eventual Consistency**: Services may have slightly stale data
- **Saga Pattern**: For distributed transactions (future)
- **API Composition**: Gateway aggregates data from multiple services

### Shared Data
- User IDs are used as foreign keys across services
- Services fetch current user data when needed
- Cached data for performance (future)

## Deployment

### Local Development

1. **Using Docker Compose** (Recommended):
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

2. **Running Services Individually**:
```bash
# Terminal 1: Start User Service
cd microservices/user-service
PORT=8001 MONGO_URL=mongodb://localhost:27017 DB_NAME=grover_users python main.py

# Terminal 2: Start Post Service
cd microservices/post-service
PORT=8002 MONGO_URL=mongodb://localhost:27017 DB_NAME=grover_posts python main.py

# Terminal 3: Start API Gateway
cd microservices/gateway
PORT=8000 USER_SERVICE_URL=http://localhost:8001 POST_SERVICE_URL=http://localhost:8002 python main.py
```

### Production Deployment

**Container Orchestration** (Kubernetes):
```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: grover/user-service:latest
        ports:
        - containerPort: 8001
        env:
        - name: MONGO_URL
          valueFrom:
            secretKeyRef:
              name: mongo-secret
              key: url
```

## Service Discovery

### Static Configuration (Current)
- Services configured via environment variables
- Service URLs hardcoded in configuration

### Dynamic Service Discovery (Future)
- Consul/Eureka for service registry
- Services register on startup
- Gateway discovers services dynamically

## Health Checks

Each service provides health check endpoints:

```bash
# Gateway health
curl http://localhost:8000/health

# Service health aggregation
curl http://localhost:8000/health/services

# Individual service health
curl http://localhost:8001/health  # User Service
curl http://localhost:8002/health  # Post Service
```

## API Documentation

- **Gateway**: http://localhost:8000/docs
- **User Service**: http://localhost:8001/docs
- **Post Service**: http://localhost:8002/docs

## Monitoring and Observability

### Logging
- Structured logging with request IDs
- Centralized log aggregation (ELK stack - future)
- Service-specific log formats

### Metrics (Future)
- Prometheus for metrics collection
- Grafana for visualization
- Custom business metrics

### Tracing (Future)
- Distributed tracing with Jaeger/Zipkin
- Request correlation across services
- Performance bottleneck identification

## Security

### Authentication
- OAuth tokens validated at gateway
- Tokens forwarded to services in Authorization header
- Services validate tokens with User Service

### Authorization
- Role-based access control (RBAC)
- Service-level authorization checks
- Resource ownership verification

### Network Security
- Services communicate over private network
- TLS encryption for external communication
- API Gateway as security perimeter

## Scaling Strategy

### Horizontal Scaling
- Independent scaling per service
- Load balancing with nginx/HAProxy
- Auto-scaling based on metrics

### Vertical Scaling
- Increase resources per instance
- Database read replicas
- Caching layers (Redis)

## Migration Strategy

### Phase 1: Extract Core Services ✅
- User Service (authentication, profiles)
- Post Service (posts, feed)
- API Gateway (routing)

### Phase 2: Extract Supporting Services
- Media Service (file uploads)
- Payment Service (transactions)
- Notification Service (push notifications)

### Phase 3: Add Event-Driven Features
- Message broker integration
- Event sourcing
- Async communication

### Phase 4: Advanced Features
- Service mesh (Istio)
- Advanced monitoring
- Chaos engineering

## Best Practices

1. **Service Independence**: Each service can be deployed independently
2. **Database per Service**: No shared databases
3. **API Versioning**: Version APIs for backward compatibility
4. **Graceful Degradation**: Services continue working if dependencies fail
5. **Circuit Breakers**: Prevent cascading failures
6. **Idempotency**: Safe to retry requests
7. **Documentation**: Keep API docs updated

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Check database connection
docker-compose exec service-name curl http://localhost:PORT/health/db
```

### Service Communication Issues
```bash
# Check service health
curl http://localhost:8000/health/services

# Test direct service access
curl http://localhost:8001/health
```

### Database Issues
```bash
# Connect to MongoDB
docker-compose exec mongodb mongosh

# Check databases
show dbs
use grover_users
db.users.find().limit(1)
```

## Performance Considerations

- **Caching**: Add Redis for frequently accessed data
- **Database Optimization**: Proper indexing, query optimization
- **Connection Pooling**: Reuse database connections
- **Async Operations**: Non-blocking I/O for all services
- **CDN**: Static assets served from CDN

## Future Enhancements

1. **API Gateway Enhancements**:
   - Rate limiting per user
   - Request caching
   - Response compression
   - GraphQL support

2. **Service Mesh**:
   - Istio for traffic management
   - Service-to-service encryption
   - Advanced routing rules

3. **Event-Driven Architecture**:
   - Kafka/RabbitMQ integration
   - Event sourcing
   - CQRS pattern

4. **Observability**:
   - Distributed tracing
   - Real-time dashboards
   - Alerting system

## References

- [Microservices Patterns](https://microservices.io/patterns/)
- [12-Factor App](https://12factor.net/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Docker Documentation](https://docs.docker.com/)
