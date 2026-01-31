# Testing Strategy & Coverage Roadmap - Grover App

**Current Coverage:** Backend ~40%, Frontend 0%  
**Target Coverage:** Backend 80%, Frontend 70%  
**Timeline:** 6-8 weeks

---

## Executive Summary

The Grover app currently has **critical testing gaps**, especially in frontend code. This document provides a comprehensive plan to achieve production-grade test coverage across all application layers.

---

## 1. Current State Analysis

### Backend Testing

**Existing Tests:** 1,356 lines across 6 files
- `backend_test.py` (413 lines) - Products, discounts, marketplace
- `comprehensive_backend_test.py` (501 lines) - Comments, interactions, tags
- `simple_backend_test.py` (153 lines) - Auth, posts, comments
- `test_collections.py` (124 lines) - Collections API
- `test_reactions.py` (77 lines) - Reactions system
- `setup_test_data.py` (88 lines) - Test data seeding

**Issues:**
- ❌ Not using pytest framework properly (has dependency but uses manual HTTP)
- ❌ No fixtures or mocking
- ❌ Tests require running server + database (not isolated)
- ❌ No CI/CD automation

### Frontend Testing

**Status:** 🔴 **ZERO TESTS**
- No testing framework installed
- No test files
- 0% coverage

---

## 2. Testing Infrastructure Setup

### 2.1 Backend Setup

#### Install Dependencies

```bash
cd backend

# Add to requirements-test.txt
cat > requirements-test.txt << EOF
# Testing Framework
pytest==9.0.2
pytest-asyncio==0.23.0
pytest-cov==4.1.0
pytest-mock==3.12.0
pytest-timeout==2.2.0

# HTTP Testing
httpx==0.28.1
respx==0.21.0

# Database Mocking
mongomock-motor==0.0.29

# Faker for test data
faker==25.0.0
EOF

pip install -r requirements-test.txt
```

#### Configure pytest

```ini
# backend/pytest.ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
asyncio_mode = auto

# Coverage
addopts = 
    --verbose
    --cov=backend
    --cov-report=html
    --cov-report=term-missing
    --cov-fail-under=80
    --maxfail=5

# Markers
markers =
    unit: Unit tests
    integration: Integration tests
    slow: Slow tests
    auth: Authentication tests
    database: Database tests
```

#### Directory Structure

```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Shared fixtures
│   ├── unit/
│   │   ├── test_auth.py
│   │   ├── test_validators.py
│   │   └── test_helpers.py
│   ├── integration/
│   │   ├── test_posts_api.py
│   │   ├── test_comments_api.py
│   │   └── test_auth_flow.py
│   └── fixtures/
│       ├── test_data.py
│       └── mock_responses.py
├── server.py
└── pytest.ini
```

### 2.2 Frontend Setup

#### Install Dependencies

```bash
cd frontend

npm install --save-dev \
  @testing-library/react-native@^12.4.0 \
  @testing-library/jest-native@^5.4.3 \
  @testing-library/react-hooks@^8.0.1 \
  jest@^29.7.0 \
  jest-expo@^51.0.0 \
  @types/jest@^29.5.0 \
  react-test-renderer@19.0.0
```

#### Configure Jest

```json
// frontend/package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "jest --verbose --no-cache"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterEnv": [
      "@testing-library/jest-native/extend-expect",
      "<rootDir>/__tests__/setup.ts"
    ],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ],
    "collectCoverageFrom": [
      "**/*.{ts,tsx}",
      "!**/*.d.ts",
      "!**/node_modules/**",
      "!**/__tests__/**",
      "!**/coverage/**"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    }
  }
}
```

#### Test Setup File

```typescript
// frontend/__tests__/setup.ts
import '@testing-library/jest-native/extend-expect';

// Mock Expo modules
jest.mock('expo-font');
jest.mock('expo-asset');
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:8001'
    }
  }
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// Silence console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
```

#### Directory Structure

```
frontend/
├── __tests__/
│   ├── setup.ts
│   ├── components/
│   │   ├── FeedVideoPlayer.test.tsx
│   │   ├── MediaViewer.test.tsx
│   │   └── ErrorBoundary.test.tsx
│   ├── screens/
│   │   ├── Home.test.tsx
│   │   ├── Profile.test.tsx
│   │   └── Explore.test.tsx
│   ├── hooks/
│   │   ├── useFeed.test.ts
│   │   └── useAuth.test.ts
│   └── services/
│       ├── api.test.ts
│       └── socket.test.ts
├── app/
├── components/
└── package.json
```

---

## 3. Test Writing Guidelines

### 3.1 Backend Unit Tests

**Example: Authentication Tests**

```python
# backend/tests/unit/test_auth.py
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from backend.server import get_current_user, create_session
from backend.exceptions import UnauthorizedError

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_valid_session(mock_db):
    """Test successful user authentication with valid session"""
    # Arrange
    user_id = str(ObjectId())
    session_token = "valid_token_123"
    
    mock_db.user_sessions.find_one = AsyncMock(return_value={
        "user_id": user_id,
        "expires_at": datetime.utcnow() + timedelta(days=1)
    })
    
    mock_db.users.find_one = AsyncMock(return_value={
        "_id": user_id,
        "email": "test@example.com",
        "name": "Test User"
    })
    
    mock_request = MagicMock()
    mock_request.headers.get.return_value = f"Bearer {session_token}"
    
    # Act
    user = await get_current_user(mock_request, mock_db)
    
    # Assert
    assert user.user_id == user_id
    assert user.email == "test@example.com"
    mock_db.user_sessions.find_one.assert_called_once_with(
        {"session_id": session_token}
    )

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_expired_session(mock_db):
    """Test authentication fails with expired session"""
    # Arrange
    mock_db.user_sessions.find_one = AsyncMock(return_value={
        "user_id": "user123",
        "expires_at": datetime.utcnow() - timedelta(days=1)  # Expired
    })
    
    mock_request = MagicMock()
    mock_request.headers.get.return_value = "Bearer expired_token"
    
    # Act & Assert
    with pytest.raises(UnauthorizedError, match="Session expired"):
        await get_current_user(mock_request, mock_db)

@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_current_user_missing_header(mock_db):
    """Test authentication fails without Authorization header"""
    # Arrange
    mock_request = MagicMock()
    mock_request.headers.get.return_value = None
    
    # Act & Assert
    with pytest.raises(UnauthorizedError, match="Missing Authorization"):
        await get_current_user(mock_request, mock_db)
```

**Fixtures (conftest.py):**

```python
# backend/tests/conftest.py
import pytest
from unittest.mock import AsyncMock, MagicMock
from motor.motor_asyncio import AsyncIOMotorDatabase

@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock(spec=AsyncIOMotorDatabase)
    
    # Mock collections
    db.users = MagicMock()
    db.posts = MagicMock()
    db.comments = MagicMock()
    db.reactions = MagicMock()
    db.user_sessions = MagicMock()
    
    return db

@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return {
        "_id": "user123",
        "email": "test@example.com",
        "name": "Test User",
        "created_at": datetime.utcnow()
    }

@pytest.fixture
def mock_post():
    """Mock post object"""
    return {
        "_id": "post123",
        "user_id": "user123",
        "content": "Test post content",
        "created_at": datetime.utcnow(),
        "likes_count": 0,
        "comments_count": 0
    }

@pytest.fixture
async def test_client():
    """Test client for API integration tests"""
    from httpx import AsyncClient
    from backend.server import app
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
```

### 3.2 Backend Integration Tests

```python
# backend/tests/integration/test_posts_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_post_success(test_client: AsyncClient, auth_headers):
    """Test creating a post successfully"""
    # Arrange
    post_data = {
        "content": "This is a test post",
        "media_urls": ["https://example.com/image.jpg"]
    }
    
    # Act
    response = await test_client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == post_data["content"]
    assert "_id" in data
    assert "created_at" in data

@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_post_unauthorized(test_client: AsyncClient):
    """Test creating post fails without authentication"""
    # Arrange
    post_data = {"content": "Test"}
    
    # Act
    response = await test_client.post("/api/posts", json=post_data)
    
    # Assert
    assert response.status_code == 401
    assert "Unauthorized" in response.json()["error"]

@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_feed_pagination(test_client: AsyncClient, auth_headers):
    """Test feed pagination works correctly"""
    # Act
    response = await test_client.get(
        "/api/posts/feed?limit=10&skip=0",
        headers=auth_headers
    )
    
    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "posts" in data
    assert len(data["posts"]) <= 10
    assert "has_more" in data
```

### 3.3 Frontend Component Tests

```typescript
// frontend/__tests__/components/FeedVideoPlayer.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import FeedVideoPlayer from '@/components/FeedVideoPlayer';

describe('FeedVideoPlayer', () => {
  it('renders video player with uri', () => {
    const uri = 'https://example.com/video.mp4';
    const { getByTestId } = render(<FeedVideoPlayer uri={uri} />);
    
    expect(getByTestId('video-player')).toBeTruthy();
  });

  it('shows play button when paused', () => {
    const { getByTestId } = render(
      <FeedVideoPlayer uri="https://example.com/video.mp4" />
    );
    
    expect(getByTestId('play-button')).toBeTruthy();
  });

  it('toggles play/pause on button press', async () => {
    const { getByTestId } = render(
      <FeedVideoPlayer uri="https://example.com/video.mp4" />
    );
    
    const playButton = getByTestId('play-button');
    
    // Initially paused
    expect(playButton).toBeTruthy();
    
    // Press play
    fireEvent.press(playButton);
    
    await waitFor(() => {
      expect(getByTestId('pause-button')).toBeTruthy();
    });
  });

  it('handles video error gracefully', async () => {
    const onError = jest.fn();
    const { getByTestId } = render(
      <FeedVideoPlayer 
        uri="https://example.com/invalid.mp4" 
        onError={onError}
      />
    );
    
    // Simulate error
    const video = getByTestId('video-player');
    fireEvent(video, 'onError', { error: 'Network error' });
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});
```

### 3.4 Frontend Hook Tests

```typescript
// frontend/__tests__/hooks/useFeed.test.ts
import { renderHook, waitFor } from '@testing-library/react-native';
import { useFeed } from '@/hooks/useFeed';
import * as api from '@/services/api';

jest.mock('@/services/api');

describe('useFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads initial feed', async () => {
    const mockPosts = [
      { _id: '1', content: 'Post 1' },
      { _id: '2', content: 'Post 2' },
    ];

    (api.getFeed as jest.Mock).mockResolvedValue({
      posts: mockPosts,
      has_more: true
    });

    const { result } = renderHook(() => useFeed());

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.posts).toEqual([]);

    // Wait for data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toEqual(mockPosts);
    expect(result.current.hasMore).toBe(true);
  });

  it('loads more posts on loadMore', async () => {
    const initialPosts = [{ _id: '1', content: 'Post 1' }];
    const morePosts = [{ _id: '2', content: 'Post 2' }];

    (api.getFeed as jest.Mock)
      .mockResolvedValueOnce({ posts: initialPosts, has_more: true })
      .mockResolvedValueOnce({ posts: morePosts, has_more: false });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.posts).toEqual(initialPosts);
    });

    // Load more
    await result.current.loadMore();

    await waitFor(() => {
      expect(result.current.posts).toEqual([...initialPosts, ...morePosts]);
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Network error');
    (api.getFeed as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Network error');
    });
  });
});
```

---

## 4. Coverage Goals by Area

### Backend (Target: 80%)

| Module | Priority | Target Coverage | Current | Gap |
|--------|----------|----------------|---------|-----|
| Authentication | HIGH | 90% | 40% | 50% |
| Posts API | HIGH | 85% | 50% | 35% |
| Comments API | MEDIUM | 80% | 45% | 35% |
| Reactions | MEDIUM | 80% | 60% | 20% |
| Marketplace | HIGH | 85% | 35% | 50% |
| Messaging | MEDIUM | 75% | 0% | 75% |
| Notifications | LOW | 70% | 0% | 70% |
| File Upload | HIGH | 90% | 0% | 90% |
| PayPal Integration | HIGH | 85% | 0% | 85% |

### Frontend (Target: 70%)

| Module | Priority | Target Coverage | Current | Gap |
|--------|----------|----------------|---------|-----|
| Components | HIGH | 80% | 0% | 80% |
| Screens | HIGH | 75% | 0% | 75% |
| Hooks | HIGH | 85% | 0% | 85% |
| Services | HIGH | 80% | 0% | 80% |
| Utils | MEDIUM | 70% | 0% | 70% |
| Contexts | HIGH | 85% | 0% | 85% |

---

## 5. CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt -r requirements-test.txt
      
      - name: Run tests
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_grover
        run: |
          cd backend
          pytest tests/ --cov --cov-report=xml --cov-report=term
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml
          flags: backend

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run tests
        run: cd frontend && npm test -- --coverage --maxWorkers=2
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./frontend/coverage/coverage-final.json
          flags: frontend
```

---

## 6. Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- [ ] Set up backend testing infrastructure
- [ ] Set up frontend testing infrastructure
- [ ] Create shared fixtures and mocks
- [ ] Write 10 example tests (5 backend, 5 frontend)
- [ ] Configure CI/CD pipeline

### Phase 2: Critical Path (Week 3-4)
- [ ] Test authentication flows (backend + frontend)
- [ ] Test post creation and retrieval
- [ ] Test comment system
- [ ] Test file upload validation
- [ ] **Target:** 40% backend, 20% frontend coverage

### Phase 3: Core Features (Week 5-6)
- [ ] Test marketplace/products
- [ ] Test payment integration
- [ ] Test messaging system
- [ ] Test notifications
- [ ] **Target:** 60% backend, 40% frontend coverage

### Phase 4: Edge Cases & Polish (Week 7-8)
- [ ] Test error handling
- [ ] Test edge cases
- [ ] Test concurrent operations
- [ ] Performance tests
- [ ] **Target:** 80% backend, 70% frontend coverage

---

## 7. Best Practices

### General Guidelines

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Avoid testing private methods directly

2. **Follow AAA Pattern**
   - Arrange: Set up test data
   - Act: Execute the code
   - Assert: Verify results

3. **Keep Tests Independent**
   - Each test should run in isolation
   - Don't rely on test execution order

4. **Use Descriptive Names**
   ```python
   # ✅ Good
   def test_get_user_returns_404_when_user_not_found():
       pass
   
   # ❌ Bad
   def test_user():
       pass
   ```

5. **One Assertion Per Test (When Possible)**
   - Makes failures easier to diagnose

### Backend-Specific

1. **Mock External Dependencies**
   - Database calls
   - Third-party APIs (PayPal, Cloudinary, Agora)
   - File system operations

2. **Use Fixtures for Common Setup**
   - Authenticated users
   - Test posts/comments
   - Mock database connections

3. **Test Edge Cases**
   - Invalid input
   - Missing required fields
   - Database errors
   - Network failures

### Frontend-Specific

1. **Test User Interactions**
   ```typescript
   fireEvent.press(button);
   fireEvent.changeText(input, 'new value');
   ```

2. **Use waitFor for Async Operations**
   ```typescript
   await waitFor(() => {
     expect(screen.getByText('Success')).toBeVisible();
   });
   ```

3. **Mock Navigation**
   ```typescript
   const mockNavigate = jest.fn();
   jest.mock('@react-navigation/native', () => ({
     useNavigation: () => ({ navigate: mockNavigate })
   }));
   ```

4. **Test Accessibility**
   ```typescript
   expect(screen.getByRole('button')).toBeAccessible();
   ```

---

## 8. Metrics & Monitoring

### Track These Metrics

- **Coverage Percentage** (lines, branches, functions)
- **Test Execution Time**
- **Flaky Test Rate** (tests that fail intermittently)
- **Code Churn vs Test Updates** (are tests kept up to date?)

### Tools

- **Coverage Reports:** codecov.io or Coveralls
- **Test Dashboard:** GitHub Actions or CircleCI
- **Performance:** Track test suite execution time

---

## 9. Maintenance

### Weekly Tasks
- [ ] Review failing tests
- [ ] Update tests for new features
- [ ] Refactor slow tests

### Monthly Tasks
- [ ] Review coverage reports
- [ ] Identify gaps in coverage
- [ ] Clean up obsolete tests
- [ ] Update testing dependencies

---

## Conclusion

Achieving 80/70% coverage will significantly improve the Grover app's **reliability, maintainability, and confidence in deployments**. Following this roadmap systematically over 8 weeks will establish a robust testing foundation.

**Next Steps:**
1. Review and approve this plan
2. Allocate developer time (estimate 40-60 hours total)
3. Set up infrastructure (Week 1)
4. Begin Phase 1 implementation

---

**Document maintained by:** Development Team  
**Next review:** Monthly during implementation
