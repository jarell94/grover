# Refactored FastAPI Architecture

## Overview

This backend has been refactored from a monolithic structure into a modular, layered architecture following best practices for FastAPI applications.

## Architecture

### Layered Structure

```
backend/
├── core/              # System-wide infrastructure
│   ├── config.py      # Centralized configuration
│   ├── database.py    # Database client initialization
│   ├── sentry.py      # Error tracking integration
│   ├── security.py    # Validation and sanitization helpers
│   └── dependencies.py # FastAPI dependency injection
│
├── schemas/           # Pydantic models for data validation
│   ├── users.py
│   ├── posts.py
│   ├── products.py
│   ├── messages.py
│   └── notifications.py
│
├── repositories/      # Data access layer (MongoDB)
│   ├── base.py        # Common CRUD patterns
│   ├── users.py
│   ├── posts.py
│   ├── products.py
│   └── notifications.py
│
├── services/          # Business logic layer
│   ├── users.py
│   ├── posts.py
│   ├── notifications.py
│   ├── media.py       # Media upload service
│   └── payments.py    # Payment processing
│
├── routers/           # Route handlers (API endpoints)
│   ├── health.py
│   ├── auth.py
│   ├── users.py
│   ├── posts.py
│   └── notifications.py
│
├── tests/             # Test suite
│   ├── conftest.py    # Test fixtures and configuration
│   ├── unit/          # Service layer unit tests
│   │   ├── test_user_service.py
│   │   └── test_post_service.py
│   └── integration/   # Router integration tests
│       ├── test_health_router.py
│       └── test_users_router.py
│
├── server_refactored.py  # New modular entry point
└── server_old.py         # Legacy monolithic server (for reference)
```

## Layer Responsibilities

### 1. Core Layer (`core/`)
- **Configuration** (`config.py`): Environment variables, constants, settings
- **Database** (`database.py`): MongoDB client initialization and management
- **Sentry** (`sentry.py`): Error tracking and monitoring integration
- **Security** (`security.py`): Input validation, sanitization, file upload validation
- **Dependencies** (`dependencies.py`): FastAPI dependency injection (authentication, database access)

### 2. Schema Layer (`schemas/`)
- Pydantic models for data validation and serialization
- One module per domain (users, posts, products, etc.)
- Used for request/response validation

### 3. Repository Layer (`repositories/`)
- Data access layer - direct MongoDB interactions
- Encapsulates all database queries
- Provides clean API for CRUD operations
- Base repository with common patterns

### 4. Service Layer (`services/`)
- Business logic and domain rules
- Orchestrates repository calls
- Handles complex operations
- No direct database access (uses repositories)

### 5. Router Layer (`routers/`)
- HTTP endpoint definitions
- Request validation and parsing
- Response formatting
- Minimal logic - delegates to services
- One router module per domain

## Benefits

### Maintainability
- Clear separation of concerns
- Easy to locate and modify code
- Each module has a single responsibility

### Scalability
- New features can be added in isolated modules
- Easy to split into microservices if needed
- Independent scaling of components

### Testability
- Each layer can be tested independently
- Mock dependencies easily
- Unit tests for services
- Integration tests for routers

### Code Reusability
- Business logic in services can be reused
- Repository patterns eliminate duplicate database code
- Shared schemas ensure consistency

## Usage

### Running the Server

```bash
# Using the refactored server
cd backend
python -m uvicorn server_refactored:app --reload
```

### Running Tests

```bash
# Run all tests
pytest

# Run unit tests only
pytest tests/unit/

# Run integration tests only
pytest tests/integration/

# Run specific test file
pytest tests/unit/test_user_service.py

# Run with coverage
pytest --cov=. --cov-report=html
```

### Adding a New Feature

To add a new feature (e.g., "comments"):

1. **Schema** (`schemas/comments.py`):
   ```python
   class Comment(BaseModel):
       comment_id: str
       post_id: str
       user_id: str
       content: str
       created_at: datetime
   ```

2. **Repository** (`repositories/comments.py`):
   ```python
   class CommentRepository(BaseRepository):
       async def get_by_post_id(self, post_id: str):
           return await self.find_many({"post_id": post_id})
   ```

3. **Service** (`services/comments.py`):
   ```python
   class CommentService:
       def __init__(self, comment_repo: CommentRepository):
           self.comment_repo = comment_repo
       
       async def create_comment(self, data: Dict):
           # Business logic here
           return await self.comment_repo.insert_one(data)
   ```

4. **Router** (`routers/comments.py`):
   ```python
   router = APIRouter(prefix="/comments", tags=["comments"])
   
   @router.post("")
   async def create_comment(
       content: str,
       post_id: str,
       current_user: User = Depends(require_auth)
   ):
       # Delegate to service
       return await comment_service.create_comment({...})
   ```

5. **Register Router** (in `server_refactored.py`):
   ```python
   from routers import comments
   api_router.include_router(comments.router)
   ```

## Testing Strategy

### Unit Tests
- Test service layer business logic in isolation
- Mock repository layer
- Fast execution
- Located in `tests/unit/`

### Integration Tests
- Test routers with real database (test database)
- Verify endpoint behavior
- Test authentication and authorization
- Located in `tests/integration/`

### Test Fixtures
- Defined in `tests/conftest.py`
- Reusable test data (users, posts, sessions)
- Automatic database cleanup

## Migration Notes

- The original `server.py` has been preserved as `server_old.py`
- The refactored application is in `server_refactored.py`
- Both can coexist during gradual migration
- Legacy endpoints can be migrated incrementally

## Dependencies

Key dependencies for the refactored architecture:
- `fastapi` - Web framework
- `motor` - Async MongoDB driver
- `pydantic` - Data validation
- `pytest` - Testing framework
- `pytest-asyncio` - Async test support
- `httpx` - HTTP client for integration tests
- `sentry-sdk` - Error tracking

## Future Enhancements

Potential improvements to consider:
- [ ] Complete migration of all endpoints from legacy server
- [ ] Add more comprehensive test coverage
- [ ] Implement caching layer (Redis)
- [ ] Add API documentation with OpenAPI/Swagger
- [ ] Implement rate limiting middleware
- [ ] Add request/response logging middleware
- [ ] Create database migration system
- [ ] Implement background task queue (Celery)
