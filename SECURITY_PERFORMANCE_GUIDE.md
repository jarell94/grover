# Security & Performance Best Practices - Grover App

**Last Updated:** January 31, 2026  
**Audience:** Development Team, DevOps, Security Reviewers

---

## Security Hardening Checklist

### 1. Authentication & Authorization

#### ✅ Currently Implemented
- Session-based authentication with TTL (7 days)
- Bearer token in Authorization header
- User ownership checks on delete operations

#### ⚠️ Needs Improvement

**1.1 Add Rate Limiting**

**Priority:** HIGH  
**Estimated Effort:** 2-3 hours

```python
# Add to backend/requirements.txt
slowapi==0.1.9

# backend/server.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply to sensitive endpoints
@app.post("/api/auth/login")
@limiter.limit("5/minute")  # 5 attempts per minute per IP
async def login(request: Request, ...):
    pass

@app.post("/api/posts")
@limiter.limit("30/minute")  # 30 posts per minute
async def create_post(request: Request, ...):
    pass

@app.post("/api/messages/send")
@limiter.limit("60/minute")  # 60 messages per minute
async def send_message(request: Request, ...):
    pass
```

**1.2 Implement Session Refresh**

Currently sessions expire after 7 days with no refresh mechanism.

```python
@app.post("/api/auth/refresh-session")
async def refresh_session(current_user = Depends(get_current_user)):
    """Refresh user session (extend expiry)"""
    new_expiry = datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)
    
    await db.user_sessions.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"expires_at": new_expiry}}
    )
    
    return {"expires_at": new_expiry.isoformat()}
```

**1.3 Add Multi-Factor Authentication (MFA)**

For production, consider adding MFA for sensitive operations:

```python
# Add to requirements.txt
pyotp==2.9.0

# backend/mfa_service.py
import pyotp
import qrcode
from io import BytesIO

def generate_mfa_secret(user_id: str) -> str:
    """Generate MFA secret for user"""
    return pyotp.random_base32()

def get_mfa_uri(user_email: str, secret: str) -> str:
    """Get OTP URI for QR code"""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=user_email,
        issuer_name="Grover"
    )

def verify_mfa_code(secret: str, code: str) -> bool:
    """Verify MFA code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
```

---

### 2. Input Validation & Sanitization

#### ✅ Currently Implemented
- `validate_id()` function for ObjectId validation
- `sanitize_string()` for text input
- `validate_file_upload()` for file security
- File size limits (10MB)

#### ⚠️ Needs Improvement

**2.1 Add Request Size Limits**

```python
# backend/server.py
from fastapi.middleware.trustedhost import TrustedHostMiddleware

# Limit request body size
app.add_middleware(
    RequestSizeLimitMiddleware,
    max_request_size=10_000_000  # 10MB
)

# Custom middleware
@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method in ["POST", "PUT", "PATCH"]:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 10_000_000:
            return JSONResponse(
                status_code=413,
                content={"error": "Request too large"}
            )
    
    return await call_next(request)
```

**2.2 Add CSRF Protection**

For web clients, add CSRF token validation:

```python
# backend/security.py
import secrets
from datetime import datetime, timedelta

def generate_csrf_token() -> str:
    """Generate CSRF token"""
    return secrets.token_urlsafe(32)

async def verify_csrf_token(token: str, user_id: str, db) -> bool:
    """Verify CSRF token"""
    stored_token = await db.csrf_tokens.find_one({
        "user_id": user_id,
        "token": token,
        "expires_at": {"$gt": datetime.utcnow()}
    })
    
    return stored_token is not None

# Usage in endpoint
@app.post("/api/posts")
async def create_post(
    request: Request,
    csrf_token: str = Header(..., alias="X-CSRF-Token"),
    current_user = Depends(get_current_user)
):
    if not await verify_csrf_token(csrf_token, current_user.user_id, db):
        raise HTTPException(403, "Invalid CSRF token")
    
    # ... rest of endpoint
```

---

### 3. Security Headers

**Priority:** HIGH  
**Estimated Effort:** 1 hour

```python
# backend/server.py
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    
    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Enforce HTTPS in production
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' https://res.cloudinary.com; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline';"
    )
    
    # Permissions Policy (formerly Feature-Policy)
    response.headers["Permissions-Policy"] = (
        "geolocation=(), "
        "microphone=(), "
        "camera=()"
    )
    
    return response
```

---

### 4. Secrets Management

**Current Issue:** Secrets in environment variables (acceptable for development)

**Production Recommendation:** Use a secrets manager

```python
# Option 1: AWS Secrets Manager
import boto3
from botocore.exceptions import ClientError

def get_secret(secret_name: str) -> dict:
    """Retrieve secret from AWS Secrets Manager"""
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name='us-east-1'
    )
    
    try:
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        raise Exception(f"Failed to retrieve secret: {e}")

# Usage
secrets = get_secret("grover/production/api-keys")
PAYPAL_CLIENT_ID = secrets["paypal_client_id"]
PAYPAL_SECRET = secrets["paypal_secret"]
```

```python
# Option 2: HashiCorp Vault
import hvac

client = hvac.Client(url='http://vault:8200', token=os.getenv('VAULT_TOKEN'))

secrets = client.secrets.kv.v2.read_secret_version(
    path='grover/production/api-keys'
)

PAYPAL_CLIENT_ID = secrets['data']['data']['paypal_client_id']
```

---

### 5. Database Security

#### ✅ Currently Implemented
- NoSQL injection prevention with `validate_id()`
- Input sanitization

#### ⚠️ Add Connection Encryption

```python
# backend/server.py
from motor.motor_asyncio import AsyncIOMotorClient

# Configure with TLS/SSL for production
client = AsyncIOMotorClient(
    mongo_url,
    tls=True,
    tlsCertificateKeyFile='/path/to/client-cert.pem',
    tlsCAFile='/path/to/ca-cert.pem',
    # Connection pool settings
    maxPoolSize=50,
    minPoolSize=10,
    maxIdleTimeMS=45000,
    serverSelectionTimeoutMS=5000
)
```

#### Add MongoDB User with Restricted Permissions

```javascript
// MongoDB admin shell
db.createUser({
  user: "grover_api",
  pwd: "strong_password_here",
  roles: [
    { role: "readWrite", db: "grover_prod" }
  ]
})

// Don't use admin or root user in application
```

---

### 6. API Security Monitoring

**Add Logging for Security Events**

```python
# backend/security_logger.py
import logging
from datetime import datetime

security_logger = logging.getLogger('security')
security_logger.setLevel(logging.INFO)

handler = logging.FileHandler('security.log')
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))
security_logger.addHandler(handler)

def log_auth_attempt(user_email: str, success: bool, ip: str):
    """Log authentication attempts"""
    security_logger.info(
        f"Auth attempt: email={user_email}, success={success}, ip={ip}"
    )

def log_suspicious_activity(user_id: str, activity: str, ip: str):
    """Log suspicious activity"""
    security_logger.warning(
        f"Suspicious: user={user_id}, activity={activity}, ip={ip}"
    )

# Usage
@app.post("/api/auth/login")
async def login(request: Request, email: str, password: str):
    ip = request.client.host
    
    # ... authentication logic
    
    if success:
        log_auth_attempt(email, True, ip)
    else:
        log_auth_attempt(email, False, ip)
        
        # Track failed attempts
        failed_count = await get_failed_attempts(email, ip)
        if failed_count > 5:
            log_suspicious_activity(email, "Multiple failed logins", ip)
```

---

## Performance Optimization

### 1. Database Query Optimization

#### ✅ Currently Implemented
- 21 indexes across collections
- TTL indexes for auto-cleanup
- Compound indexes for common queries

#### ⚠️ Add Query Result Caching

**Install Redis:**

```bash
# Add to requirements.txt
redis==5.0.0
hiredis==2.3.0  # C parser for better performance
```

**Implement Caching Layer:**

```python
# backend/cache.py
from redis.asyncio import Redis
import json
from typing import Optional, Any
from functools import wraps

redis_client: Optional[Redis] = None

async def get_redis() -> Redis:
    """Get Redis client"""
    global redis_client
    if redis_client is None:
        redis_client = Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            db=0,
            decode_responses=True
        )
    return redis_client

async def cache_get(key: str) -> Optional[Any]:
    """Get from cache"""
    redis = await get_redis()
    value = await redis.get(key)
    return json.loads(value) if value else None

async def cache_set(key: str, value: Any, ttl: int = 300):
    """Set in cache with TTL (default 5 minutes)"""
    redis = await get_redis()
    await redis.setex(key, ttl, json.dumps(value))

async def cache_delete(key: str):
    """Delete from cache"""
    redis = await get_redis()
    await redis.delete(key)

# Decorator for caching
def cached(ttl: int = 300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and args
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            
            # Try cache first
            cached_value = await cache_get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Cache result
            await cache_set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator
```

**Use Caching in Endpoints:**

```python
# backend/server.py
from backend.cache import cached, cache_delete

@app.get("/api/users/{user_id}")
@cached(ttl=600)  # Cache for 10 minutes
async def get_user(user_id: str):
    """Get user profile (cached)"""
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    return user

@app.put("/api/users/profile")
async def update_profile(
    updates: dict,
    current_user = Depends(get_current_user)
):
    """Update user profile and invalidate cache"""
    await db.users.update_one(
        {"_id": current_user.user_id},
        {"$set": updates}
    )
    
    # Invalidate cache
    await cache_delete(f"get_user:({current_user.user_id},):{{}")
    
    return {"success": True}
```

---

### 2. Fix N+1 Query Problems

**Current Issue:** Reactions endpoint fetches users individually

```python
# ❌ Current (N+1 queries)
reactions = await db.reactions.find({"post_id": post_id}).to_list(1000)
for reaction in reactions:
    user = await db.users.find_one({"_id": reaction["user_id"]})  # N queries!
    reaction["user"] = user
```

**Optimized with Aggregation:**

```python
# ✅ Optimized (1 query with $lookup)
@app.get("/posts/{post_id}/reactions")
async def get_reactions(post_id: str, limit: int = 100):
    """Get reactions with user data (optimized)"""
    reactions = await db.reactions.aggregate([
        {"$match": {"post_id": post_id}},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user"
            }
        },
        {"$unwind": "$user"},
        {
            "$project": {
                "_id": 1,
                "type": 1,
                "created_at": 1,
                "user": {
                    "_id": 1,
                    "name": 1,
                    "profile_picture": 1
                }
            }
        }
    ]).to_list(limit)
    
    return reactions
```

---

### 3. Implement Cursor-Based Pagination

**Current:** Offset-based pagination (`skip` parameter)  
**Problem:** Slow for large offsets, data inconsistency

```python
# ❌ Current (slow for large skip values)
posts = await db.posts.find({}).skip(skip).limit(limit).to_list(limit)
```

**Optimized with Cursor:**

```python
# ✅ Cursor-based pagination
@app.get("/api/posts/feed")
async def get_feed(
    limit: int = 20,
    cursor: Optional[str] = None
):
    """Get feed with cursor-based pagination"""
    query = {}
    
    # If cursor provided, get posts after that cursor
    if cursor:
        query["_id"] = {"$lt": ObjectId(cursor)}
    
    posts = await db.posts.find(query) \
        .sort("_id", -1) \
        .limit(limit) \
        .to_list(limit)
    
    # Next cursor is the last post's ID
    next_cursor = str(posts[-1]["_id"]) if posts else None
    has_more = len(posts) == limit
    
    return {
        "posts": posts,
        "next_cursor": next_cursor,
        "has_more": has_more
    }
```

---

### 4. Add Response Compression

```python
# backend/server.py
from fastapi.middleware.gzip import GZipMiddleware

# Add compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)  # Compress responses > 1KB
```

---

### 5. Optimize Media Delivery

**Use Cloudinary Transformations:**

```python
# backend/media_service.py
def get_optimized_image_url(
    public_id: str,
    width: int = 800,
    quality: str = "auto"
) -> str:
    """Get optimized image URL from Cloudinary"""
    return cloudinary.utils.cloudinary_url(
        public_id,
        width=width,
        height=width,
        crop="fill",
        quality=quality,
        fetch_format="auto",  # Auto WebP/AVIF
        secure=True
    )[0]

# Return optimized URLs in API responses
post["image_url"] = get_optimized_image_url(post["image_public_id"])
post["thumbnail_url"] = get_optimized_image_url(post["image_public_id"], width=200)
```

---

### 6. Frontend Performance

**Implement Code Splitting:**

```typescript
// frontend/app/(tabs)/index.tsx
import React, { lazy, Suspense } from 'react';

// Lazy load heavy components
const FeedVideoPlayer = lazy(() => import('@/components/FeedVideoPlayer'));
const MediaViewer = lazy(() => import('@/components/MediaViewer'));

function HomeScreen() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FeedVideoPlayer uri={videoUri} />
    </Suspense>
  );
}
```

**Optimize FlatList:**

```typescript
// frontend/components/Feed.tsx
<FlatList
  data={posts}
  renderItem={renderPost}
  keyExtractor={(item) => item._id}
  
  // Performance optimizations
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={21}
  removeClippedSubviews={true}
  updateCellsBatchingPeriod={50}
  
  // Memoize item layout if fixed size
  getItemLayout={(data, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

---

## Security Audit Checklist

**Before Production Deployment:**

- [ ] Rate limiting on all public endpoints
- [ ] HTTPS enforced (no HTTP)
- [ ] Security headers configured
- [ ] CORS restricted to specific domains
- [ ] Secrets in secrets manager (not env vars)
- [ ] Database encryption at rest
- [ ] Database connection over TLS
- [ ] File upload validation working
- [ ] Input sanitization on all user inputs
- [ ] Session expiry working correctly
- [ ] Password hashing (if storing passwords)
- [ ] MFA enabled for admin accounts
- [ ] Security logging configured
- [ ] Sentry error tracking active
- [ ] Dependency vulnerability scan passed
- [ ] API documentation restricted
- [ ] Debug mode disabled
- [ ] Verbose errors disabled

---

## Performance Metrics Goals

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| API Response Time (p95) | < 200ms | ~300ms | ⚠️ |
| Database Query Time (p95) | < 50ms | ~100ms | ⚠️ |
| Page Load Time | < 3s | ~4s | ⚠️ |
| Time to Interactive | < 5s | ~6s | ⚠️ |
| Lighthouse Score | > 90 | TBD | ⚠️ |

---

## Monitoring Setup

**Add Application Monitoring:**

```python
# backend/monitoring.py
from prometheus_client import Counter, Histogram, generate_latest
import time

# Metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration')

@app.middleware("http")
async def monitor_requests(request: Request, call_next):
    start_time = time.time()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    
    # Record metrics
    request_count.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    request_duration.observe(duration)
    
    return response

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type="text/plain")
```

---

**Document maintained by:** Security & DevOps Team  
**Next security audit:** Quarterly  
**Last penetration test:** Pending
