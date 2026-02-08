# Bug Prevention & Testing Guide

## Overview
This guide provides strategies to prevent bugs and maintain code quality in the Grover social media platform.

**Created:** 2026-02-08  
**Purpose:** Prevent future bugs, maintain code quality, ensure smooth operation

---

## 🛡️ Bug Prevention Strategies

### 1. Code Review Checklist

Before committing code, check:

#### Backend (Python)
- [ ] No undefined variables (run flake8)
- [ ] No bare `except:` clauses
- [ ] Specific exception types caught
- [ ] Errors logged with context
- [ ] All async functions await properly
- [ ] Database queries handle None
- [ ] Input validation on all endpoints
- [ ] HTTPException for errors
- [ ] No function redefinitions

#### Frontend (TypeScript/React)
- [ ] No unsafe null/undefined access
- [ ] Array operations have null checks
- [ ] useEffect cleanup functions
- [ ] API calls wrapped in try-catch
- [ ] Loading states for all async
- [ ] Error boundaries in place
- [ ] No memory leaks
- [ ] Props properly typed

---

## 🧪 Testing Strategy

### 1. Unit Tests

**Backend:**
```python
# Test database operations
async def test_create_post():
    post = await create_post(user_id="test", content="Test")
    assert post is not None
    assert post["content"] == "Test"

# Test error handling
async def test_get_post_not_found():
    with pytest.raises(HTTPException) as exc:
        await get_post("nonexistent")
    assert exc.status_code == 404
```

**Frontend:**
```typescript
// Test component rendering
test('renders post correctly', () => {
  render(<Post post={mockPost} />);
  expect(screen.getByText(mockPost.content)).toBeInTheDocument();
});

// Test error handling
test('shows error on API failure', async () => {
  api.getPost = jest.fn().mockRejectedValue(new Error('Network'));
  render(<PostDetail postId="123" />);
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

### 2. Integration Tests

```python
# Test full API flow
async def test_post_creation_flow():
    # Register user
    user = await register_user("test@example.com", "password")
    
    # Login
    token = await login_user("test@example.com", "password")
    
    # Create post
    post = await create_post(token, "Test content")
    assert post["user_id"] == user["user_id"]
    
    # Get post
    retrieved = await get_post(post["post_id"])
    assert retrieved["content"] == "Test content"
```

### 3. End-to-End Tests

```typescript
// Test user journey
describe('User creates post', () => {
  it('should create and view post', async () => {
    await login('test@example.com', 'password');
    await navigateTo('/create-post');
    await typeText('content', 'My first post');
    await clickButton('Post');
    await waitFor(() => {
      expect(screen.getByText('My first post')).toBeVisible();
    });
  });
});
```

---

## 🔍 Static Analysis

### Backend: flake8

```bash
# Run flake8 on modified files
flake8 backend/server.py --max-line-length=120 \
  --extend-ignore=E501,W503,E203,E402,F401,E302,W291,W293 \
  --select=F,E9,W6

# Check for critical errors only
flake8 backend/server.py --select=F821,F811,E722
```

### Backend: mypy

```bash
# Type checking
mypy backend/server.py --ignore-missing-imports
```

### Frontend: ESLint

```bash
# Run ESLint
cd frontend
npx eslint app/ services/ components/ --ext .ts,.tsx

# Fix auto-fixable issues
npx eslint app/ services/ components/ --ext .ts,.tsx --fix
```

### Frontend: TypeScript

```bash
# Type checking
cd frontend
npx tsc --noEmit
```

---

## 🐛 Common Bug Patterns & Prevention

### 1. Undefined Variable Access

**Problem:**
```python
logger.info("Starting...")  # logger not defined yet
logger = logging.getLogger(__name__)
```

**Prevention:**
- Define variables before use
- Use flake8 to catch (F821)
- Initialize early in file

**Solution:**
```python
logger = logging.getLogger(__name__)  # Define first
logger.info("Starting...")  # Then use
```

---

### 2. Null/None Access

**Problem:**
```python
user = await db.users.find_one({"user_id": user_id})
return user["name"]  # Crash if user is None
```

**Prevention:**
- Check for None before access
- Use .get() with defaults
- Raise HTTPException for missing data

**Solution:**
```python
user = await db.users.find_one({"user_id": user_id})
if not user:
    raise HTTPException(status_code=404, detail="User not found")
return user["name"]  # Safe
```

---

### 3. Bare Except Clauses

**Problem:**
```python
try:
    data = json.loads(text)
except:  # Catches everything!
    data = {}
```

**Prevention:**
- Specify exception types
- Log the error
- Use flake8 to catch (E722)

**Solution:**
```python
try:
    data = json.loads(text)
except (json.JSONDecodeError, TypeError, ValueError) as e:
    logger.warning(f"Failed to parse JSON: {e}")
    data = {}
```

---

### 4. Unhandled Async Errors

**Problem:**
```python
async def get_data():
    response = await httpx.get(url)  # May timeout or fail
    return response.json()
```

**Prevention:**
- Wrap in try-catch
- Set timeouts
- Handle network errors

**Solution:**
```python
async def get_data():
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error(f"HTTP error: {e}")
        raise HTTPException(status_code=502, detail="External service error")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal error")
```

---

### 5. Memory Leaks (Frontend)

**Problem:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);
  // No cleanup!
}, []);
```

**Prevention:**
- Always cleanup in useEffect
- Clear intervals/timeouts
- Unsubscribe from events

**Solution:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    fetchData();
  }, 5000);
  
  return () => {
    clearInterval(interval);  // Cleanup
  };
}, []);
```

---

### 6. Race Conditions

**Problem:**
```typescript
const [data, setData] = useState(null);

useEffect(() => {
  fetchData().then(result => {
    setData(result);  // May set stale data
  });
}, [id]);
```

**Prevention:**
- Use cleanup flags
- Cancel pending requests
- Check if component mounted

**Solution:**
```typescript
const [data, setData] = useState(null);

useEffect(() => {
  let cancelled = false;
  
  fetchData().then(result => {
    if (!cancelled) {
      setData(result);
    }
  });
  
  return () => {
    cancelled = true;
  };
}, [id]);
```

---

### 7. Unsafe Array Operations

**Problem:**
```typescript
{posts.map(post => (  // Crash if posts is undefined
  <Post key={post.id} post={post} />
))}
```

**Prevention:**
- Check for null/undefined
- Provide default empty array
- Use optional chaining

**Solution:**
```typescript
{posts?.map(post => (  // Safe with optional chaining
  <Post key={post.id} post={post} />
)) || <EmptyState />}

// Or with default
{(posts || []).map(post => (
  <Post key={post.id} post={post} />
))}
```

---

## 🔄 Continuous Integration

### Pre-commit Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "Running pre-commit checks..."

# Backend checks
cd backend
echo "Checking Python syntax..."
python -m py_compile server.py || exit 1

echo "Running flake8..."
flake8 server.py --select=F821,F811,E722 || exit 1

# Frontend checks
cd ../frontend
echo "Checking TypeScript..."
npx tsc --noEmit || exit 1

echo "✓ All pre-commit checks passed"
```

### GitHub Actions

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Run flake8
        run: |
          cd backend
          flake8 server.py --select=F,E9
      
      - name: Run tests
        run: |
          cd backend
          pytest tests/
```

---

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

1. **Error Rate**
   - Track HTTP 5xx errors
   - Alert if > 1%
   - Review error logs daily

2. **Response Time**
   - Track p95, p99 latency
   - Alert if > 1 second
   - Optimize slow endpoints

3. **Database Errors**
   - Connection failures
   - Query timeouts
   - Lock timeouts

4. **Memory Usage**
   - Track heap size
   - Alert if > 80%
   - Check for leaks

5. **WebSocket Connections**
   - Active connections
   - Connection errors
   - Message delivery rate

### Sentry Configuration

```python
import sentry_sdk

sentry_sdk.init(
    dsn="YOUR_SENTRY_DSN",
    environment="production",
    traces_sample_rate=0.1,
    
    # Capture user context (no PII)
    send_default_pii=False,
    
    # Before send hook (filter sensitive data)
    before_send=lambda event, hint: event,
    
    # Integrations
    integrations=[
        FastApiIntegration(),
        StarletteIntegration(),
    ],
)
```

---

## 🚨 Incident Response

### When a Bug is Discovered

1. **Assess Severity**
   - Critical: Affects all users, data loss
   - High: Affects some users, feature broken
   - Medium: Affects edge case
   - Low: Cosmetic issue

2. **Immediate Actions**
   - Critical: Hotfix + deploy immediately
   - High: Fix within 24 hours
   - Medium: Fix in next release
   - Low: Add to backlog

3. **Root Cause Analysis**
   - What happened?
   - Why did it happen?
   - How can we prevent it?
   - What tests would catch it?

4. **Prevention**
   - Add unit test
   - Add integration test
   - Update documentation
   - Share learnings with team

---

## 📝 Bug Report Template

```markdown
## Bug Description
Clear description of the issue

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., iOS 15]
- App Version: [e.g., 1.0.0]
- Device: [e.g., iPhone 13]

## Screenshots
If applicable

## Logs
Relevant error messages

## Severity
- [ ] Critical (app crashes)
- [ ] High (feature broken)
- [ ] Medium (workaround exists)
- [ ] Low (cosmetic)
```

---

## ✅ Best Practices

### Code Quality
1. Write self-documenting code
2. Keep functions small (< 50 lines)
3. Use meaningful variable names
4. Add comments for complex logic
5. Follow style guides (PEP8, Airbnb)

### Error Handling
1. Catch specific exceptions
2. Log errors with context
3. Provide user-friendly messages
4. Don't silence errors
5. Handle edge cases

### Testing
1. Write tests first (TDD)
2. Test happy path + edge cases
3. Mock external dependencies
4. Use realistic test data
5. Run tests before commit

### Performance
1. Optimize database queries
2. Use caching appropriately
3. Profile slow endpoints
4. Monitor memory usage
5. Use async where possible

---

## 🎓 Resources

### Documentation
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Native Docs](https://reactnative.dev/)
- [MongoDB Best Practices](https://www.mongodb.com/docs/manual/)

### Tools
- **Linting:** flake8, eslint, prettier
- **Testing:** pytest, jest, react-testing-library
- **Monitoring:** Sentry, Prometheus, Grafana
- **Profiling:** cProfile, React DevTools

### Learning
- [Python Testing Guide](https://realpython.com/pytest-python-testing/)
- [React Testing Guide](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Error Handling Best Practices](https://docs.python.org/3/tutorial/errors.html)

---

**Remember:** Prevention is better than cure. Invest time in quality code upfront to avoid bugs later.

**Last Updated:** 2026-02-08
