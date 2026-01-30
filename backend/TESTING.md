# Testing Guide

## Running Tests

### Prerequisites

Tests require a MongoDB instance to be running. You can use:

1. **Local MongoDB**:
   ```bash
   # Start MongoDB locally
   mongod --dbpath /path/to/data
   ```

2. **Docker MongoDB**:
   ```bash
   # Run MongoDB in Docker
   docker run -d -p 27017:27017 --name test-mongo mongo:latest
   ```

3. **MongoDB Memory Server** (recommended for CI/CD):
   ```bash
   pip install mongomock-motor
   ```

### Running Tests

```bash
# Run all tests
pytest

# Run unit tests only (service layer)
pytest tests/unit/

# Run integration tests only (routers)
pytest tests/integration/

# Run specific test file
pytest tests/unit/test_user_service.py

# Run specific test
pytest tests/unit/test_user_service.py::test_get_user

# Run with verbose output
pytest -v

# Run with coverage report
pytest --cov=. --cov-report=html
pytest --cov=. --cov-report=term-missing
```

### Test Environment Configuration

Set these environment variables for testing:

```bash
# Test database (separate from development/production)
export TEST_MONGO_URL="mongodb://localhost:27017"
export TEST_DB_NAME="test_grover_db"

# Or use .env.test file
TEST_MONGO_URL=mongodb://localhost:27017
TEST_DB_NAME=test_grover_db
```

## Test Structure

### Unit Tests (`tests/unit/`)

Tests the business logic in the service layer without external dependencies.

**Example: Testing User Service**
```python
@pytest.mark.asyncio
async def test_create_user(test_db):
    """Test creating a new user"""
    user_repo = UserRepository(test_db.users)
    user_service = UserService(user_repo)
    
    user_data = {
        "user_id": "new_user_123",
        "email": "newuser@example.com",
        "name": "New User"
    }
    
    user = await user_service.create_user(user_data)
    
    assert user is not None
    assert user.user_id == user_data["user_id"]
```

**What Unit Tests Cover:**
- Service layer business logic
- Data validation
- Error handling
- Edge cases
- Repository interactions (with real test DB)

### Integration Tests (`tests/integration/`)

Tests the complete request/response cycle through routers with authentication.

**Example: Testing User Router**
```python
@pytest.mark.asyncio
async def test_get_user_endpoint(test_app, test_db, test_user, test_session):
    """Test GET /users/{user_id} endpoint"""
    headers = {"Authorization": f"Bearer {test_session['session_token']}"}
    
    async with AsyncClient(transport=ASGITransport(app=test_app)) as client:
        response = await client.get(f"/users/{test_user['user_id']}", headers=headers)
    
    assert response.status_code == 200
    assert response.json()["user_id"] == test_user["user_id"]
```

**What Integration Tests Cover:**
- HTTP endpoint behavior
- Request/response format
- Authentication/authorization
- Error responses (4xx, 5xx)
- Database state changes

## Test Fixtures

Defined in `tests/conftest.py`:

### `test_db`
- Provides a clean test database for each test
- Automatically cleans up after test completion
- Isolated from development/production data

### `test_user`
- Creates a test user in the database
- Returns user data dictionary
- Available for all tests

### `test_post`
- Creates a test post associated with test_user
- Returns post data dictionary

### `test_session`
- Creates a valid authentication session
- Returns session data with token
- Used for authenticated endpoint tests

## Writing New Tests

### 1. Unit Test Template

```python
"""
Unit Tests for [Feature] Service
"""
import pytest
from services.[feature] import [Feature]Service
from repositories.[feature] import [Feature]Repository

@pytest.mark.asyncio
async def test_[action]_[expected_result](test_db):
    """Test [description]"""
    # Arrange
    repo = [Feature]Repository(test_db.[collection])
    service = [Feature]Service(repo)
    
    # Act
    result = await service.[method]([params])
    
    # Assert
    assert result is not None
    assert result.[field] == expected_value
```

### 2. Integration Test Template

```python
"""
Integration Tests for [Feature] Router
"""
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI
from routers.[feature] import router

@pytest.fixture
def test_app():
    app = FastAPI()
    app.include_router(router)
    return app

@pytest.mark.asyncio
async def test_[endpoint]_[scenario](test_app, test_db, test_session):
    """Test [endpoint] - [scenario]"""
    # Arrange
    from core import database
    database._db = test_db
    headers = {"Authorization": f"Bearer {test_session['session_token']}"}
    
    # Act
    async with AsyncClient(transport=ASGITransport(app=test_app)) as client:
        response = await client.[method]("[url]", headers=headers)
    
    # Assert
    assert response.status_code == [expected_code]
```

## Test Coverage

Aim for:
- **80%+ coverage** for service layer (business logic)
- **70%+ coverage** for router layer (endpoints)
- **100% coverage** for critical paths (auth, payments)

Check coverage:
```bash
pytest --cov=. --cov-report=term-missing
```

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          cd backend
          pytest --cov=. --cov-report=xml
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_database
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

## Troubleshooting

### MongoDB Connection Errors

**Problem**: `ServerSelectionTimeoutError: localhost:27017: [Errno 111] Connection refused`

**Solution**:
1. Ensure MongoDB is running: `mongod --version`
2. Check connection string in `TEST_MONGO_URL`
3. Verify firewall/network settings

### Import Errors

**Problem**: `ModuleNotFoundError: No module named 'core'`

**Solution**:
1. Run tests from the `backend/` directory
2. Ensure `PYTHONPATH` includes backend directory:
   ```bash
   export PYTHONPATH="${PYTHONPATH}:$(pwd)"
   ```

### Async Test Issues

**Problem**: Tests hanging or not running

**Solution**:
1. Ensure `pytest-asyncio` is installed
2. Use `@pytest.mark.asyncio` decorator
3. Check async fixture scopes in conftest.py

### Test Database Cleanup

**Problem**: Tests failing due to existing data

**Solution**:
1. Use unique test database name
2. Fixtures automatically clean up (see `test_db` fixture)
3. Manually drop test database: `mongo test_grover_db --eval "db.dropDatabase()"`

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Use fixtures to clean up after tests
3. **Naming**: Use descriptive test names (test_[action]_[expected_result])
4. **AAA Pattern**: Arrange, Act, Assert
5. **Mock External Services**: Don't test third-party APIs (Cloudinary, PayPal)
6. **Fast Tests**: Unit tests should run in milliseconds
7. **Real Database**: Use real test database, not mocks (for integration tests)

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [Motor Testing Guide](https://motor.readthedocs.io/en/stable/tutorial-asyncio.html)
