# Code Quality Improvements Guide

This document outlines specific code quality improvements to enhance the Grover application.

## Frontend Improvements

### 1. Enable Stricter TypeScript Configuration

**Current State:**
- TypeScript strict mode is enabled
- But `@typescript-eslint/no-explicit-any` is turned off

**Recommended Changes:**

Update `eslint.config.js`:
```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'warn', // Change from 'off' to 'warn'
  '@typescript-eslint/explicit-function-return-type': 'warn',
  '@typescript-eslint/no-unused-vars': ['error', { 
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_'
  }],
}
```

### 2. Add Frontend Testing Infrastructure

**Install dependencies:**
```bash
cd frontend
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native
```

**Create `jest.config.js`:**
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/.expo/**',
  ],
};
```

**Add test script to `package.json`:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 3. Add Error Boundaries

**Create `components/ErrorBoundary.tsx`:**
```typescript
import React from 'react';
import { View, Text, Button } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
    // Log to Sentry or other error tracking service
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Something went wrong
          </Text>
          <Text style={{ marginBottom: 20, textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <Button title="Try Again" onPress={this.handleReset} />
        </View>
      );
    }

    return this.props.children;
  }
}
```

### 4. Extract Large Components

Screens with 1000+ lines should be broken into smaller, focused components.

**Example refactoring pattern:**
```typescript
// Before: HomeScreen.tsx (1500 lines)

// After:
// HomeScreen.tsx (main coordinator - 200 lines)
// components/HomeHeader.tsx (100 lines)
// components/HomeFeed.tsx (300 lines)
// components/HomePostCard.tsx (200 lines)
// hooks/useHomeFeed.ts (150 lines)
```

## Backend Improvements

### 1. Split Monolithic server.py

**Create modular router structure:**

```
backend/
├── server.py              # Main app initialization
├── routers/
│   ├── __init__.py
│   ├── auth.py           # Authentication endpoints
│   ├── posts.py          # Post CRUD operations
│   ├── comments.py       # Comment operations
│   ├── messages.py       # Messaging endpoints
│   ├── live_streams.py   # Live streaming endpoints
│   ├── marketplace.py    # Marketplace endpoints
│   ├── users.py          # User profile endpoints
│   └── social.py         # Follow/unfollow endpoints
├── models/
│   ├── __init__.py
│   ├── user.py           # User Pydantic models
│   ├── post.py           # Post Pydantic models
│   └── message.py        # Message Pydantic models
├── services/
│   ├── __init__.py
│   ├── auth_service.py   # Authentication logic
│   ├── post_service.py   # Post business logic
│   └── notification_service.py
└── middleware/
    ├── __init__.py
    ├── auth.py           # Auth middleware
    └── rate_limit.py     # Rate limiting
```

**Example router (`routers/posts.py`):**
```python
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from models.post import PostCreate, PostResponse
from services.post_service import PostService
from middleware.auth import get_current_user

router = APIRouter(prefix="/posts", tags=["posts"])

@router.get("/", response_model=List[PostResponse])
async def get_posts(
    skip: int = 0,
    limit: int = 20,
    user=Depends(get_current_user)
):
    """Get user feed posts"""
    service = PostService()
    return await service.get_feed(user['_id'], skip, limit)

@router.post("/", response_model=PostResponse)
async def create_post(
    post: PostCreate,
    user=Depends(get_current_user)
):
    """Create a new post"""
    service = PostService()
    return await service.create_post(post, user['_id'])
```

### 2. Add Pre-commit Hooks

**Install pre-commit:**
```bash
pip install pre-commit
```

**Create `.pre-commit-config.yaml`:**
```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 25.12.0
    hooks:
      - id: black
        language_version: python3.12

  - repo: https://github.com/PyCQA/flake8
    rev: 7.3.0
    hooks:
      - id: flake8
        args: ['--max-line-length=120', '--extend-ignore=E203,W503']

  - repo: https://github.com/PyCQA/isort
    rev: 7.0.0
    hooks:
      - id: isort

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.19.0
    hooks:
      - id: mypy
        additional_dependencies: [types-all]
        args: ['--ignore-missing-imports']

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v5.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
```

**Install hooks:**
```bash
pre-commit install
```

### 3. Optimize Database Queries

**Current Issue:** N+1 queries when fetching posts with user data.

**Solution:** Use aggregation pipeline:

```python
# Before (N+1 query)
posts = await db.posts.find().to_list(100)
for post in posts:
    user = await db.users.find_one({'_id': post['user_id']})
    post['user'] = user

# After (single aggregation query)
posts = await db.posts.aggregate([
    {'$match': {'user_id': {'$in': following_ids}}},
    {'$sort': {'created_at': -1}},
    {'$limit': limit},
    {'$lookup': {
        'from': 'users',
        'localField': 'user_id',
        'foreignField': '_id',
        'as': 'user'
    }},
    {'$unwind': '$user'},
    {'$project': {
        'user.password_hash': 0,
        'user.email': 0
    }}
]).to_list(None)
```

### 4. Add Request/Response Logging Middleware

```python
import time
import logging
from fastapi import Request
from logging_config import get_logger

logger = get_logger(__name__)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing"""
    start_time = time.time()
    
    # Log request
    logger.info(
        "Request started",
        extra={
            'method': request.method,
            'endpoint': request.url.path,
            'client': request.client.host if request.client else 'unknown',
        }
    )
    
    response = await call_next(request)
    
    # Calculate duration
    duration_ms = (time.time() - start_time) * 1000
    
    # Log response
    logger.info(
        "Request completed",
        extra={
            'method': request.method,
            'endpoint': request.url.path,
            'status_code': response.status_code,
            'duration_ms': round(duration_ms, 2),
        }
    )
    
    # Add duration header
    response.headers['X-Process-Time'] = str(duration_ms)
    
    return response
```

### 5. Add Database Migration System

**Install Alembic-like tool for MongoDB:**
```bash
pip install mongodb-migrations
```

**Create migrations directory:**
```
backend/
└── migrations/
    ├── 001_initial_indexes.py
    ├── 002_add_user_fields.py
    └── 003_optimize_posts.py
```

## Performance Optimization Checklist

### Frontend
- [ ] Implement React.memo for expensive components
- [ ] Use FlashList for all large lists
- [ ] Add pagination to all infinite scrolls
- [ ] Optimize image loading with proper sizes
- [ ] Implement proper cache invalidation
- [ ] Add debouncing to search inputs
- [ ] Use Suspense for code splitting
- [ ] Profile with React DevTools

### Backend
- [ ] Add database query caching with Redis
- [ ] Implement response caching for read-heavy endpoints
- [ ] Optimize MongoDB indexes (already done)
- [ ] Use connection pooling (already done with Motor)
- [ ] Add request/response compression (GZip already enabled)
- [ ] Implement batch operations for bulk updates
- [ ] Add database query timeout limits
- [ ] Profile slow queries with query analyzer

## Security Hardening Checklist

- [ ] Enable HTTPS only in production
- [ ] Implement CSRF protection for state-changing operations
- [ ] Add request signature verification
- [ ] Implement API key rotation
- [ ] Add IP whitelisting for admin endpoints
- [ ] Enable security headers (X-Frame-Options, CSP, etc.)
- [ ] Implement account lockout after failed login attempts
- [ ] Add 2FA support
- [ ] Encrypt sensitive data at rest
- [ ] Implement audit logging for sensitive operations

## Monitoring & Observability

### Metrics to Track
1. **Application Metrics**
   - Request rate (req/sec)
   - Error rate (errors/sec)
   - Response time (p50, p95, p99)
   - Active users

2. **Database Metrics**
   - Query execution time
   - Connection pool usage
   - Index hit rate
   - Slow query log

3. **Business Metrics**
   - New user signups
   - Posts created
   - Active streams
   - Payment success rate

### Alerting Rules
- Error rate > 5% for 5 minutes
- Response time p95 > 2 seconds for 10 minutes
- Database connections > 80% pool size
- Disk usage > 85%
- Memory usage > 90%

## Documentation Improvements

### Required Documentation
- [x] README with setup instructions
- [x] Architecture guide
- [x] API documentation (FastAPI auto-docs)
- [ ] Component documentation (Storybook)
- [ ] Deployment guide
- [ ] Troubleshooting guide
- [ ] Contributing guidelines
- [ ] Changelog

### Code Documentation Standards
- All public functions must have docstrings
- Complex algorithms need inline comments
- Type hints required for all function signatures
- Include examples in docstrings for complex functions

## Conclusion

These improvements will significantly enhance:
- **Code Quality**: Better type safety, testing, and structure
- **Maintainability**: Modular architecture, clear separation of concerns
- **Performance**: Optimized queries, caching, and efficient rendering
- **Security**: Hardened endpoints, better input validation
- **Observability**: Comprehensive logging and monitoring

Implement these changes incrementally, starting with high-priority items.
