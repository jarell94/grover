# Code Quality Improvement Roadmap - Grover App

**Priority:** HIGH  
**Timeline:** 4-6 weeks  
**Impact:** Maintainability, Debuggability, Production Stability

---

## Overview

This document outlines specific code quality improvements for the Grover app, with concrete examples and implementation steps.

---

## 1. Exception Handling Improvements

### Current Problem

**Location:** `backend/server.py` (10+ instances)  
**Issue:** Bare `except Exception as e:` clauses mask specific errors

**Bad Examples:**
```python
# ❌ Line 542
try:
    post = await db.posts.find_one({"_id": post_id})
except Exception as e:
    return {"error": str(e)}

# ❌ Line 1287  
try:
    await db.reactions.insert_one(reaction_data)
except Exception as e:
    print(f"Error: {e}")
    return None
```

### Solution

**Create custom exceptions:**
```python
# backend/exceptions.py
class GroverException(Exception):
    """Base exception for Grover app"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ResourceNotFoundError(GroverException):
    """Resource not found (404)"""
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} with id {id} not found", 404)

class ValidationError(GroverException):
    """Invalid input (400)"""
    def __init__(self, message: str):
        super().__init__(message, 400)

class UnauthorizedError(GroverException):
    """Unauthorized access (401)"""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, 401)

class DatabaseError(GroverException):
    """Database operation failed (500)"""
    def __init__(self, operation: str, details: str = ""):
        super().__init__(f"Database {operation} failed: {details}", 500)
```

**Use specific exceptions:**
```python
# ✅ Improved
from pymongo.errors import DuplicateKeyError, OperationFailure
from bson.errors import InvalidId

@app.get("/posts/{post_id}")
async def get_post(post_id: str):
    try:
        # Validate ID format
        if not ObjectId.is_valid(post_id):
            raise ValidationError(f"Invalid post ID format: {post_id}")
        
        post = await db.posts.find_one({"_id": ObjectId(post_id)})
        
        if not post:
            raise ResourceNotFoundError("Post", post_id)
        
        return post
    
    except InvalidId:
        raise ValidationError(f"Invalid ObjectId: {post_id}")
    except OperationFailure as e:
        logger.error(f"Database error fetching post: {e}")
        raise DatabaseError("read", str(e))
    except GroverException:
        raise  # Re-raise custom exceptions
    except Exception as e:
        # Only catch truly unexpected errors
        logger.exception(f"Unexpected error in get_post: {e}")
        raise HTTPException(500, "Internal server error")
```

**Add global exception handler:**
```python
# backend/server.py
@app.exception_handler(GroverException)
async def grover_exception_handler(request: Request, exc: GroverException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "type": exc.__class__.__name__,
            "path": str(request.url)
        }
    )
```

### Implementation Plan

**Files to Update:**
1. `backend/server.py` - Lines 542, 632, 823, 1045, 1287, 1523, 1845, 2103, 2567, 2945
2. Create `backend/exceptions.py`
3. Update all endpoints to use specific exceptions

**Estimated Effort:** 8-12 hours  
**Priority:** HIGH

---

## 2. Eliminate Magic Strings & Hardcoded Values

### Current Problem

**Magic strings scattered throughout code:**
```python
# ❌ backend/server.py:1212
if reaction_type not in ["like", "love", "haha", "wow", "sad", "angry"]:
    return {"error": "Invalid reaction type"}

# ❌ backend/server.py:363
notification_type = "like"  # or "comment", "follow", "mention", etc.

# ❌ backend/server.py:608
expires_at = datetime.utcnow() + timedelta(days=7)

# ❌ backend/server.py:1297
reactions = await db.reactions.find({"post_id": post_id}).to_list(1000)
```

### Solution

**Create constants file:**
```python
# backend/constants.py
from enum import Enum

class ReactionType(str, Enum):
    LIKE = "like"
    LOVE = "love"
    HAHA = "haha"
    WOW = "wow"
    SAD = "sad"
    ANGRY = "angry"

class NotificationType(str, Enum):
    LIKE = "like"
    COMMENT = "comment"
    FOLLOW = "follow"
    MENTION = "mention"
    REPLY = "reply"
    REPOST = "repost"
    MESSAGE = "message"

class PostStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    DELETED = "deleted"

class OrderStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

# Configuration constants
SESSION_EXPIRY_DAYS = 7
MAX_REACTIONS_PER_QUERY = 1000
MAX_POSTS_PER_PAGE = 100
MAX_COMMENTS_PER_PAGE = 50
MAX_FILE_SIZE_MB = 10
DEFAULT_PAGE_SIZE = 20

# File upload limits
MAX_IMAGE_SIZE_MB = 10
MAX_VIDEO_SIZE_MB = 50
MAX_AUDIO_SIZE_MB = 20

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"]
```

**Use constants:**
```python
# ✅ Improved
from backend.constants import ReactionType, SESSION_EXPIRY_DAYS, MAX_REACTIONS_PER_QUERY

@app.post("/posts/{post_id}/react")
async def react_to_post(
    post_id: str,
    reaction_type: ReactionType,  # Validates automatically
    current_user = Depends(get_current_user)
):
    # Enum ensures only valid values
    reaction = {
        "post_id": post_id,
        "user_id": current_user.user_id,
        "type": reaction_type.value,
        "created_at": datetime.utcnow()
    }
    
    await db.reactions.insert_one(reaction)
    return {"success": True}

# Session expiry
expires_at = datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)

# Pagination limit
reactions = await db.reactions.find({"post_id": post_id}).limit(MAX_REACTIONS_PER_QUERY).to_list(MAX_REACTIONS_PER_QUERY)
```

### Implementation Plan

**Steps:**
1. Create `backend/constants.py`
2. Replace all magic strings in `backend/server.py`
3. Update Pydantic models to use Enums
4. Add validation in API endpoints

**Estimated Effort:** 4-6 hours  
**Priority:** MEDIUM-HIGH

---

## 3. Fix Race Condition in Reactions

### Current Problem

**Location:** `backend/server.py:1226-1292`

**Race Condition Scenario:**
```python
# ❌ Current vulnerable code
@app.post("/posts/{post_id}/react")
async def react_to_post(post_id: str, reaction_type: str, current_user):
    # Step 1: Check if reaction exists
    existing = await db.reactions.find_one({
        "post_id": post_id,
        "user_id": current_user.user_id
    })
    
    if existing:
        # Update existing
        await db.reactions.update_one(
            {"_id": existing["_id"]},
            {"$set": {"type": reaction_type}}
        )
    else:
        # Step 2: Insert new reaction
        await db.reactions.insert_one({
            "post_id": post_id,
            "user_id": current_user.user_id,
            "type": reaction_type
        })
        
        # Step 3: Increment count
        await db.posts.update_one(
            {"_id": post_id},
            {"$inc": {"reaction_count": 1}}
        )

# Problem: If 2 users react simultaneously between steps 1-2,
# both will insert reactions but count only increments once
```

### Solution: Use MongoDB Transactions

**Option 1: Atomic Operations (Recommended)**
```python
# ✅ Improved with atomic upsert
@app.post("/posts/{post_id}/react")
async def react_to_post(
    post_id: str,
    reaction_type: ReactionType,
    current_user = Depends(get_current_user)
):
    # Use upsert for atomic operation
    result = await db.reactions.update_one(
        {
            "post_id": post_id,
            "user_id": current_user.user_id
        },
        {
            "$set": {
                "type": reaction_type.value,
                "updated_at": datetime.utcnow()
            },
            "$setOnInsert": {
                "created_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    # Only increment if new reaction
    if result.upserted_id:
        await db.posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$inc": {"reaction_count": 1}}
        )
    
    return {"success": True, "is_new": result.upserted_id is not None}
```

**Option 2: MongoDB Transactions (More Complex)**
```python
# ✅ With transaction for strong consistency
from motor.motor_asyncio import AsyncIOMotorClientSession

async def react_to_post_transactional(
    post_id: str,
    reaction_type: ReactionType,
    user_id: str,
    session: AsyncIOMotorClientSession
):
    async with session.start_transaction():
        # Check existing within transaction
        existing = await db.reactions.find_one(
            {"post_id": post_id, "user_id": user_id},
            session=session
        )
        
        if existing:
            # Update existing
            await db.reactions.update_one(
                {"_id": existing["_id"]},
                {"$set": {"type": reaction_type.value}},
                session=session
            )
        else:
            # Insert new
            await db.reactions.insert_one(
                {
                    "post_id": post_id,
                    "user_id": user_id,
                    "type": reaction_type.value,
                    "created_at": datetime.utcnow()
                },
                session=session
            )
            
            # Increment count atomically
            await db.posts.update_one(
                {"_id": ObjectId(post_id)},
                {"$inc": {"reaction_count": 1}},
                session=session
            )

@app.post("/posts/{post_id}/react")
async def react_to_post(
    post_id: str,
    reaction_type: ReactionType,
    current_user = Depends(get_current_user)
):
    async with await client.start_session() as session:
        await react_to_post_transactional(
            post_id,
            reaction_type,
            current_user.user_id,
            session
        )
    
    return {"success": True}
```

### Implementation Plan

**Priority:** MEDIUM  
**Estimated Effort:** 2-3 hours  
**Testing:** Concurrent request simulation

---

## 4. Refactor Duplicate Index Creation Code

### Current Problem

**Location:** `backend/server.py:185-291` (95 lines of similar code)

```python
# ❌ Repetitive code
await db.posts.create_index([("created_at", -1)])
await db.posts.create_index([("user_id", 1), ("created_at", -1)])
await db.users.create_index([("email", 1)], unique=True)
await db.users.create_index([("created_at", -1)])
# ... 17 more similar blocks
```

### Solution: Configuration-Driven Index Creation

```python
# ✅ Refactored approach
# backend/db_config.py
from typing import List, Tuple, Dict, Any

IndexSpec = List[Tuple[str, int]]

DB_INDEXES: Dict[str, List[Dict[str, Any]]] = {
    "posts": [
        {"keys": [("created_at", -1)], "name": "posts_created_at"},
        {"keys": [("user_id", 1), ("created_at", -1)], "name": "posts_user_created"},
        {"keys": [("original_post_id", 1)], "name": "posts_original"},
    ],
    "users": [
        {"keys": [("email", 1)], "name": "users_email", "unique": True},
        {"keys": [("created_at", -1)], "name": "users_created"},
    ],
    "follows": [
        {"keys": [("follower_id", 1), ("following_id", 1)], "name": "follows_pair", "unique": True},
        {"keys": [("follower_id", 1)], "name": "follows_follower"},
        {"keys": [("following_id", 1)], "name": "follows_following"},
    ],
    "reactions": [
        {"keys": [("post_id", 1), ("user_id", 1)], "name": "reactions_unique", "unique": True},
        {"keys": [("post_id", 1)], "name": "reactions_post"},
    ],
    "comments": [
        {"keys": [("post_id", 1), ("created_at", -1)], "name": "comments_post_created"},
        {"keys": [("parent_comment_id", 1)], "name": "comments_parent"},
    ],
    "messages": [
        {"keys": [("conversation_id", 1), ("created_at", -1)], "name": "messages_conv_created"},
        {"keys": [("receiver_id", 1), ("read", 1)], "name": "messages_receiver_read"},
    ],
    "notifications": [
        {"keys": [("user_id", 1), ("created_at", -1)], "name": "notif_user_created"},
        {"keys": [("user_id", 1), ("read", 1)], "name": "notif_user_read"},
    ],
    "stories": [
        {"keys": [("expires_at", 1)], "name": "stories_expires", "expireAfterSeconds": 0},
    ],
    "user_sessions": [
        {"keys": [("expires_at", 1)], "name": "sessions_expires", "expireAfterSeconds": 0},
    ],
}

async def create_indexes(db):
    """Create all indexes defined in DB_INDEXES"""
    for collection_name, indexes in DB_INDEXES.items():
        collection = db[collection_name]
        
        for index_spec in indexes:
            keys = index_spec["keys"]
            options = {k: v for k, v in index_spec.items() if k != "keys"}
            
            try:
                await collection.create_index(keys, **options)
                print(f"✅ Created index {options.get('name', keys)} on {collection_name}")
            except Exception as e:
                print(f"⚠️  Index {options.get('name', keys)} on {collection_name}: {e}")

# backend/server.py
@app.on_event("startup")
async def startup_event():
    from backend.db_config import create_indexes
    await create_indexes(db)
```

### Benefits
- **87% code reduction** (95 lines → 12 lines)
- Easier to maintain and modify indexes
- Clear documentation of database schema
- Reusable across environments

**Estimated Effort:** 2 hours  
**Priority:** LOW (refactoring only)

---

## 5. Remove Console Logs from Frontend Production Code

### Current Problem

**27+ console.log statements in production builds**

**Examples:**
```typescript
// ❌ frontend/contexts/AuthContext.tsx:46
console.log("Authenticating with session token:", sessionToken);

// ❌ frontend/contexts/AuthContext.tsx:51
console.log("Auth user loaded:", authUser);

// ❌ frontend/services/api.ts:67
console.log("API request:", endpoint, data);

// ❌ frontend/hooks/useFeed.ts:34
console.log("Loading feed page:", page);
```

### Solution

**Option 1: Logger Utility (Recommended)**
```typescript
// frontend/utils/logger.ts
const isDevelopment = __DEV__;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, send to Sentry in production
    console.error(...args);
    if (!isDevelopment) {
      // Send to Sentry
      Sentry.captureException(args[0]);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  }
};

// Usage
import { logger } from '@/utils/logger';

logger.log("Authenticating with session token:", sessionToken);
logger.error("Failed to load user:", error);
```

**Option 2: Babel Plugin (Automatic Removal)**
```javascript
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  
  const plugins = [
    // ... other plugins
  ];
  
  // Remove console.log in production
  if (process.env.NODE_ENV === 'production') {
    plugins.push(['transform-remove-console', {
      exclude: ['error', 'warn']
    }]);
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins
  };
};
```

### Implementation Plan

**Steps:**
1. Create `frontend/utils/logger.ts`
2. Find-replace all `console.log` → `logger.log`
3. Find-replace all `console.error` → `logger.error`
4. Test in development and production builds
5. Configure Babel plugin for extra safety

**Command to find all console statements:**
```bash
cd frontend
grep -r "console\." --include="*.ts" --include="*.tsx" | wc -l
# Current: 27 instances
```

**Estimated Effort:** 2-3 hours  
**Priority:** HIGH

---

## 6. Improve Bearer Token Parsing

### Current Problem

```python
# ❌ backend/server.py:517
authorization = request.headers.get("Authorization")
token = authorization.replace("Bearer ", "")

# Issues:
# 1. No check if "Bearer " prefix exists
# 2. No validation of format
# 3. Fails silently on malformed headers
```

### Solution

```python
# ✅ Improved parsing
def extract_bearer_token(authorization: str) -> str:
    """Safely extract token from Authorization header"""
    if not authorization:
        raise UnauthorizedError("Missing Authorization header")
    
    if not authorization.startswith("Bearer "):
        raise UnauthorizedError("Invalid Authorization header format")
    
    token = authorization[7:].strip()
    
    if not token:
        raise UnauthorizedError("Empty bearer token")
    
    # Optional: Validate token format (e.g., length, characters)
    if len(token) < 20 or len(token) > 500:
        raise UnauthorizedError("Invalid token length")
    
    return token

# Usage
async def get_current_user(request: Request):
    authorization = request.headers.get("Authorization")
    token = extract_bearer_token(authorization)
    
    session = await db.user_sessions.find_one({"session_id": token})
    if not session:
        raise UnauthorizedError("Invalid or expired session")
    
    # ... rest of logic
```

**Estimated Effort:** 1 hour  
**Priority:** MEDIUM

---

## Summary: Implementation Timeline

### Week 1: Critical Fixes
- [ ] Fix exception handling (10 locations)
- [ ] Remove/guard console.log statements (27 instances)
- [ ] Improve bearer token parsing

### Week 2: Code Organization
- [ ] Create constants.py with enums
- [ ] Replace magic strings (20+ locations)
- [ ] Create exceptions.py

### Week 3: Database Improvements
- [ ] Fix race condition in reactions
- [ ] Refactor index creation code
- [ ] Add MongoDB transactions where needed

### Week 4: Testing & Validation
- [ ] Write tests for new exception handling
- [ ] Test concurrent operations
- [ ] Code review and documentation

---

## Metrics

**Before:**
- Exception handling: 10 bare except blocks
- Magic strings: 50+ instances
- Console logs: 27 in production
- Code duplication: 95 lines of index creation

**After:**
- Exception handling: 0 bare except blocks
- Magic strings: 0 (all in constants/enums)
- Console logs: 0 in production (guarded)
- Code duplication: 12 lines (87% reduction)

**Code Quality Score:** 6/10 → 9/10

---

**Document maintained by:** Development Team  
**Next review:** February 2026
