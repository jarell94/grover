# Grover Backend - Modular Architecture

## Overview

The Grover backend has been refactored from a monolithic FastAPI application into a modular, layered architecture. This refactoring improves code maintainability, testability, and scalability.

## Architecture

### Layered Architecture Pattern

```
┌─────────────────────────────────────┐
│         Routers (API Layer)         │  - Route handlers
│         - auth.py                   │  - Request/response validation
│         - users.py                  │  - API documentation
│         - posts.py                  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│       Services (Business Logic)     │  - Business rules
│       - auth_service.py             │  - Orchestration
│       - user_service.py             │  - Cross-cutting concerns
│       - post_service.py             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│    Repositories (Data Access)       │  - Database queries
│    - user_repository.py             │  - Data persistence
│    - post_repository.py             │  - Data retrieval
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Database (MongoDB)          │
└─────────────────────────────────────┘
```

### Directory Structure

```
backend/
├── core/                     # Core infrastructure
│   ├── __init__.py
│   ├── config.py            # Application configuration
│   ├── database.py          # Database connection & initialization
│   └── security.py          # Security utilities & validation
│
├── schemas/                  # Pydantic models
│   ├── __init__.py
│   ├── user.py              # User schemas
│   ├── post.py              # Post schemas
│   ├── comment.py           # Comment schemas
│   └── product.py           # Product schemas
│
├── repositories/             # Data access layer
│   ├── __init__.py
│   ├── user_repository.py   # User database operations
│   └── post_repository.py   # Post database operations
│
├── services/                 # Business logic layer
│   ├── __init__.py
│   ├── auth_service.py      # Authentication logic
│   ├── user_service.py      # User business logic
│   └── post_service.py      # Post business logic
│
├── routers/                  # API route handlers
│   ├── __init__.py
│   ├── auth.py              # Auth endpoints
│   ├── users.py             # User endpoints
│   └── posts.py             # Post endpoints
│
├── media_service.py          # Cloudinary integration (existing)
├── paypal_service.py         # PayPal integration (existing)
├── paypal_payout_service.py  # PayPal payouts (existing)
├── server_new.py             # New modular server
├── server_old.py             # Original monolithic server (backup)
└── requirements.txt
```

## Key Components

### 1. Core (`backend/core/`)

**config.py**
- Centralized configuration using Pydantic Settings
- Environment variable management
- Application settings

**database.py**
- MongoDB connection management
- Database initialization
- Index creation
- Database dependency injection

**security.py**
- Input validation helpers
- File upload validation
- Sanitization utilities
- Security constants

### 2. Schemas (`backend/schemas/`)

Pydantic models for data validation and serialization:
- `User`, `UserCreate`, `UserUpdate`, `UserPublic`
- `Post`, `PostCreate`, `PostUpdate`
- `Comment`, `CommentCreate`
- `Product`, `ProductCreate`, `Order`

### 3. Repositories (`backend/repositories/`)

Data access layer that abstracts database operations:
- CRUD operations
- Query methods
- Database-specific logic
- No business logic

### 4. Services (`backend/services/`)

Business logic layer:
- Domain logic implementation
- Orchestration between repositories
- Business rules enforcement
- No direct database access

### 5. Routers (`backend/routers/`)

API route handlers:
- Request validation
- Response formatting
- HTTP status codes
- API documentation
- Minimal logic (delegates to services)

## Testing

### Test Structure

```
tests/
├── conftest.py              # Pytest fixtures
├── test_user_service.py     # User service unit tests
└── test_post_service.py     # Post service unit tests
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=backend --cov-report=html

# Run specific test file
pytest tests/test_user_service.py

# Run specific test class
pytest tests/test_user_service.py::TestUserService

# Run tests by marker
pytest -m unit
pytest -m service
```

### Test Categories

- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.service` - Service layer tests
- `@pytest.mark.repository` - Repository layer tests
- `@pytest.mark.router` - Router/API tests

## Development Guide

### Adding a New Feature

Follow this pattern when adding new features:

#### 1. Define Schema (`schemas/`)

```python
# schemas/new_feature.py
from pydantic import BaseModel
from datetime import datetime

class NewFeature(BaseModel):
    id: str
    name: str
    created_at: datetime
    
class NewFeatureCreate(BaseModel):
    name: str
```

#### 2. Create Repository (`repositories/`)

```python
# repositories/new_feature_repository.py
from motor.motor_asyncio import AsyncIOMotorDatabase

class NewFeatureRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.new_features
    
    async def create(self, data: dict):
        await self.collection.insert_one(data)
    
    async def get_by_id(self, id: str):
        return await self.collection.find_one({"id": id})
```

#### 3. Implement Service (`services/`)

```python
# services/new_feature_service.py
from repositories.new_feature_repository import NewFeatureRepository
from schemas.new_feature import NewFeature, NewFeatureCreate

class NewFeatureService:
    def __init__(self, repo: NewFeatureRepository):
        self.repo = repo
    
    async def create_feature(self, data: NewFeatureCreate):
        # Business logic here
        return await self.repo.create(data.model_dump())
```

#### 4. Create Router (`routers/`)

```python
# routers/new_feature.py
from fastapi import APIRouter, Depends
from services.new_feature_service import NewFeatureService

router = APIRouter(prefix="/features", tags=["Features"])

@router.post("/")
async def create_feature(data: NewFeatureCreate):
    # Route handler
    pass
```

#### 5. Register Router (`server_new.py`)

```python
from routers import new_feature

api_router.include_router(new_feature.router)
```

#### 6. Write Tests (`tests/`)

```python
# tests/test_new_feature_service.py
import pytest

@pytest.mark.unit
@pytest.mark.service
class TestNewFeatureService:
    async def test_create_feature(self):
        # Test implementation
        pass
```

## Migration Status

### ✅ Completed

- Core infrastructure (config, database, security)
- User domain (schemas, repository, service, router)
- Post domain (schemas, repository, service, router)
- Authentication (OAuth session, token validation)
- Test infrastructure (pytest, fixtures, unit tests)

### 🚧 In Progress / TODO

The following domains from the original monolithic server need to be migrated:

1. **Comments** - CRUD, likes, threaded replies
2. **Messages** - DMs, groups, rich messages (voice, video, GIF)
3. **Products & Orders** - CRUD, discounts, PayPal integration
4. **Notifications** - In-app, push notifications
5. **Stories** - CRUD, highlights, views, reactions
6. **Live Streaming** - Agora integration, super chat, gifts
7. **Collections** - Bookmarks, saved posts
8. **Analytics** - Earnings, engagement metrics
9. **Search** - Users, posts, hashtags
10. **Social Features** - Reposts, polls, mentions
11. **Communities** - CRUD, posts, membership
12. **Voice/Video Calls** - Agora integration
13. **Premium Features** - Subscriptions, tiers, paid content
14. **Tips/Donations** - Revenue sharing

## Configuration

### Environment Variables

```bash
# Application
APP_VERSION=1.0.0
ENVIRONMENT=development  # development, staging, production
DEBUG=False

# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=grover_db

# CORS
ALLOWED_ORIGINS=*  # Comma-separated list

# Sentry (optional)
SENTRY_DSN=https://...

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox  # sandbox or live

# Agora (optional)
AGORA_APP_ID=
AGORA_APP_CERTIFICATE=
```

## Running the Application

### Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run with hot reload
uvicorn server_new:socket_app --reload --port 8000

# Or using the old monolithic server (for comparison)
uvicorn server_old:socket_app --reload --port 8001
```

### Production

```bash
# Run with multiple workers
uvicorn server_new:socket_app --host 0.0.0.0 --port 8000 --workers 4
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## Benefits of This Architecture

### 1. Separation of Concerns
- Each layer has a single, well-defined responsibility
- Changes in one layer have minimal impact on others

### 2. Testability
- Unit tests for services (business logic)
- Integration tests for routers (API endpoints)
- Repository tests can use test doubles

### 3. Maintainability
- Smaller, focused files (vs. 5,900-line monolith)
- Clear dependencies between components
- Easier to navigate and understand

### 4. Scalability
- Easier to add new features
- Team members can work on different domains independently
- Clear patterns to follow

### 5. Dependency Injection
- FastAPI's `Depends` used throughout
- Easy to mock dependencies for testing
- Flexible configuration

## Best Practices

1. **Keep routers thin** - Delegate to services
2. **Services contain business logic** - Not routers or repositories
3. **Repositories handle data access** - No business logic
4. **Use dependency injection** - FastAPI's `Depends`
5. **Write tests first** - For new features
6. **Follow existing patterns** - Consistency matters
7. **Document your code** - Docstrings for public methods
8. **Handle errors properly** - Use HTTPException in routers

## Contributing

When contributing to this refactored codebase:

1. Follow the established layered architecture
2. Add tests for new features
3. Update this README if adding new domains
4. Use type hints throughout
5. Follow PEP 8 style guidelines
6. Add docstrings to public methods
7. Run tests before committing

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [Motor (MongoDB) Documentation](https://motor.readthedocs.io/)
- [Pytest Documentation](https://docs.pytest.org/)
