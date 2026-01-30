# Microservices Migration Guide

## Overview

This guide explains how to migrate from the modular monolith to the microservices architecture incrementally, minimizing disruption and risk.

## Migration Strategy: Strangler Fig Pattern

The Strangler Fig pattern allows you to gradually replace the monolith with microservices:

1. **New features** go directly into microservices
2. **Existing features** migrate incrementally
3. **Both systems** run in parallel during transition
4. **Gateway routes** traffic to appropriate service

```
┌────────────────────────────────────────────────┐
│                  Clients                        │
└──────────────────┬─────────────────────────────┘
                   │
                   ↓
        ┌──────────────────────┐
        │    API Gateway       │
        │   (Smart Router)     │
        └──────┬────────┬──────┘
               │        │
      New ←────┘        └────→ Old
      Routes                Routes
         │                    │
         ↓                    ↓
  ┌─────────────┐     ┌─────────────┐
  │Microservices│     │  Monolith   │
  │             │     │ (server.py) │
  └─────────────┘     └─────────────┘
```

## Phase 1: Foundation (✅ Complete)

### What Was Done

1. **Created Directory Structure**
   ```
   microservices/
   ├── gateway/          # API Gateway
   ├── user-service/     # User management
   ├── post-service/     # Post management
   └── shared/           # Common utilities
   ```

2. **Implemented API Gateway**
   - Request routing
   - Service discovery
   - Health checks
   - Logging and tracing

3. **Extracted User Service**
   - Authentication
   - User profiles
   - Follow system
   - Database: `grover_users`

4. **Extracted Post Service**
   - Post CRUD
   - Feed generation
   - Likes and reactions
   - Database: `grover_posts`

5. **Created Docker Support**
   - `docker-compose.yml`
   - Dockerfiles for each service
   - Network configuration

### Testing Phase 1

```bash
# Start services
docker-compose up -d

# Check health
curl http://localhost:8000/health/services

# Test user endpoints via gateway
curl http://localhost:8000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test post endpoints via gateway
curl http://localhost:8000/api/posts/feed/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Phase 2: Extract Supporting Services (Next)

### Media Service Migration

**Current State**: `backend/media_service.py` (standalone module)

**Migration Steps**:

1. **Create Service Structure**
   ```bash
   mkdir -p microservices/media-service
   ```

2. **Create Service** (`microservices/media-service/main.py`)
   ```python
   from fastapi import FastAPI, UploadFile, File
   # Reuse existing media_service.py functionality
   from media_service import upload_media, delete_media
   
   app = FastAPI(title="Media Service")
   
   @app.post("/api/media/upload")
   async def upload(file: UploadFile = File(...)):
       result = await upload_media(file)
       return result
   ```

3. **Update Gateway Routing**
   ```python
   @app.api_route("/api/media/{path:path}")
   async def route_media(request, path):
       return await proxy_request(request, "media", f"/api/media/{path}")
   ```

4. **Add to Docker Compose**
   ```yaml
   media-service:
     build: microservices/media-service
     ports:
       - "8003:8003"
     environment:
       - CLOUDINARY_*
   ```

5. **Test Migration**
   ```bash
   # Upload via gateway
   curl -X POST http://localhost:8000/api/media/upload \
     -F "file=@image.jpg" \
     -H "Authorization: Bearer TOKEN"
   ```

### Payment Service Migration

**Current State**: `backend/paypal_service.py`, `backend/paypal_payout_service.py`

**Migration Steps**:

1. **Create Service**
   ```bash
   mkdir -p microservices/payment-service
   ```

2. **Consolidate PayPal Code**
   ```python
   # microservices/payment-service/main.py
   from paypal_service import create_payment, execute_payment
   from paypal_payout_service import send_payout
   
   app = FastAPI(title="Payment Service")
   
   @app.post("/api/payments/create")
   async def create_payment_endpoint(...):
       # Payment logic
   ```

3. **Add Database for Orders**
   ```python
   # Store orders in payment service DB
   db = motor_client['grover_payments']
   ```

4. **Update Gateway**

5. **Test PayPal Integration**

## Phase 3: Extract Notification Service

### Current State
- Notifications scattered in monolith
- Push notification logic mixed with business logic

### Migration Steps

1. **Create Notification Service**
   ```bash
   mkdir -p microservices/notification-service
   ```

2. **Centralize Notification Logic**
   ```python
   # microservices/notification-service/main.py
   app = FastAPI(title="Notification Service")
   
   @app.post("/api/notifications/send")
   async def send_notification(
       user_id: str,
       type: str,
       content: str
   ):
       # Store notification
       # Send push notification
       # Send email (optional)
   ```

3. **Event-Driven Notifications** (Optional)
   ```python
   # Services publish events
   await publish_event("user.followed", {
       "follower_id": follower_id,
       "following_id": following_id
   })
   
   # Notification service consumes events
   @consumer("user.followed")
   async def on_user_followed(event):
       await send_notification(...)
   ```

## Phase 4: Add Event-Driven Architecture (Advanced)

### Why Event-Driven?

- Decouple services further
- Async communication
- Better scalability
- Event sourcing for audit

### Setup Message Broker

**Option 1: RabbitMQ**
```yaml
# docker-compose.yml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"    # AMQP
    - "15672:15672"  # Management UI
```

**Option 2: Redis Pub/Sub**
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

### Publish Events

```python
# In User Service
async def follow_user(follower_id, following_id):
    # Business logic
    await user_repo.follow_user(follower_id, following_id)
    
    # Publish event
    await event_bus.publish("user.followed", {
        "follower_id": follower_id,
        "following_id": following_id,
        "timestamp": datetime.now()
    })
```

### Consume Events

```python
# In Notification Service
@event_bus.subscribe("user.followed")
async def on_user_followed(event):
    await create_notification(
        user_id=event["following_id"],
        type="new_follower",
        content=f"User {event['follower_id']} followed you"
    )
```

## Phase 5: Advanced Patterns

### Service Mesh (Istio)

**Benefits**:
- Service-to-service encryption (mTLS)
- Traffic management
- Circuit breaking
- Observability

**Setup**:
```bash
# Install Istio
istioctl install --set profile=demo

# Enable sidecar injection
kubectl label namespace default istio-injection=enabled
```

### API Versioning

**Add version to routes**:
```python
# Gateway routing
@app.api_route("/api/v1/users/{path:path}")
async def route_users_v1(...)

@app.api_route("/api/v2/users/{path:path}")
async def route_users_v2(...)
```

**Service versioning**:
```yaml
# Run multiple versions
user-service-v1:
  image: grover/user-service:v1
  
user-service-v2:
  image: grover/user-service:v2
```

### CQRS Pattern

**Separate read and write models**:
```python
# Write Service (Commands)
@app.post("/api/posts/")
async def create_post(...):
    # Write to database
    # Publish event
    
# Read Service (Queries)
@app.get("/api/posts/feed")
async def get_feed(...):
    # Read from optimized read model
    # Could use different database (Elasticsearch)
```

## Migration Checklist

### Pre-Migration
- [ ] Review service boundaries
- [ ] Identify shared data
- [ ] Plan data migration strategy
- [ ] Set up monitoring
- [ ] Create rollback plan

### During Migration
- [ ] Extract service code
- [ ] Create database for service
- [ ] Migrate data
- [ ] Update gateway routing
- [ ] Deploy service
- [ ] Test thoroughly

### Post-Migration
- [ ] Monitor service health
- [ ] Check logs for errors
- [ ] Verify data consistency
- [ ] Performance testing
- [ ] Update documentation

## Data Migration Strategies

### Strategy 1: Dual Write

1. Write to both old and new databases
2. Verify data consistency
3. Switch reads to new database
4. Stop writing to old database

```python
# During migration
async def create_post(...):
    # Write to monolith DB
    await old_db.posts.insert_one(post_data)
    
    # Write to post service DB
    await new_db.posts.insert_one(post_data)
```

### Strategy 2: Batch Migration

1. Copy historical data in batches
2. Continue writing to old database
3. Run sync job to catch up
4. Switch to new database

```python
# Migration script
async def migrate_posts():
    batch_size = 1000
    skip = 0
    
    while True:
        posts = await old_db.posts.find().skip(skip).limit(batch_size)
        if not posts:
            break
            
        await new_db.posts.insert_many(posts)
        skip += batch_size
```

### Strategy 3: Event Sourcing

1. Capture all changes as events
2. Replay events to build new database
3. Keep event log for audit

## Testing Strategies

### Unit Tests
```python
# Test service in isolation
async def test_create_post(post_service, mock_user_service):
    post = await post_service.create_post(user_id, post_data)
    assert post.post_id is not None
```

### Integration Tests
```python
# Test service communication
async def test_post_service_validates_auth():
    response = await post_service.create_post(
        invalid_token,
        post_data
    )
    assert response.status_code == 401
```

### End-to-End Tests
```bash
# Test via gateway
curl http://localhost:8000/api/posts/ \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content": "Test post"}'
```

### Load Tests
```python
# Using locust
from locust import HttpUser, task

class GatewayUser(HttpUser):
    @task
    def get_feed(self):
        self.client.get(
            "/api/posts/feed/me",
            headers={"Authorization": f"Bearer {token}"}
        )
```

## Monitoring and Observability

### Health Checks
```bash
# Gateway aggregated health
curl http://localhost:8000/health/services

# Individual service health
curl http://localhost:8001/health
curl http://localhost:8001/health/db
```

### Logs
```bash
# Centralized logging with ELK stack
docker-compose logs -f gateway
docker-compose logs -f user-service
```

### Metrics (Future)
```python
# Add Prometheus metrics
from prometheus_client import Counter, Histogram

request_count = Counter('requests_total', 'Total requests')
request_duration = Histogram('request_duration_seconds', 'Request duration')
```

### Tracing (Future)
```python
# Add Jaeger tracing
from opentracing import tracer

with tracer.start_span('create_post') as span:
    # Business logic
    span.set_tag('user_id', user_id)
```

## Common Pitfalls

### 1. Data Consistency Issues
**Problem**: Services have stale data
**Solution**: 
- Use eventual consistency
- Implement compensation transactions
- Consider distributed transactions (Saga pattern)

### 2. Service Dependencies
**Problem**: Service A depends on Service B
**Solution**:
- Minimize synchronous calls
- Use async messaging
- Cache frequently accessed data

### 3. Deployment Complexity
**Problem**: Many services to manage
**Solution**:
- Use container orchestration (Kubernetes)
- Implement CI/CD pipelines
- Automate deployment

### 4. Debugging Distributed Systems
**Problem**: Hard to trace requests across services
**Solution**:
- Add request IDs
- Implement distributed tracing
- Centralized logging

## Rollback Strategy

### If Migration Fails

1. **Gateway Routing**: Switch routes back to monolith
   ```python
   # In gateway
   USE_MONOLITH = True  # Emergency switch
   
   if USE_MONOLITH:
       return await proxy_to_monolith(request)
   ```

2. **Database Rollback**: Keep old database intact
   - Don't delete old data immediately
   - Keep dual write during transition

3. **Gradual Rollout**: Use feature flags
   ```python
   if feature_flag.is_enabled('use_post_microservice', user_id):
       return await proxy_to_microservice(request)
   else:
       return await proxy_to_monolith(request)
   ```

## Success Metrics

Track these metrics to measure migration success:

- **Service Availability**: > 99.9%
- **Response Time**: < 200ms p95
- **Error Rate**: < 0.1%
- **Deployment Frequency**: Daily
- **Time to Recovery**: < 15 minutes

## Next Steps

1. **Complete Phase 1**: Test current services thoroughly
2. **Plan Phase 2**: Prioritize next services to extract
3. **Set Up Monitoring**: Before extracting more services
4. **Document APIs**: Keep OpenAPI specs updated
5. **Train Team**: On microservices patterns

## Resources

- [Microservices.io Patterns](https://microservices.io/patterns/)
- [Martin Fowler: Microservices](https://martinfowler.com/articles/microservices.html)
- [Strangler Fig Pattern](https://martinfowler.com/bliki/StranglerFigApplication.html)
- [Sam Newman: Building Microservices](https://samnewman.io/books/building_microservices/)
