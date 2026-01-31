# Dependency Upgrade Guide - Grover App

**Last Updated:** January 31, 2026

This guide provides specific instructions for upgrading dependencies in the Grover app.

---

## Backend (Python) Upgrades

### Critical Security Updates

#### 1. Upgrade passlib (IMMEDIATE)

**Current:** passlib==1.7.4 (Released: 2014)  
**Target:** passlib==1.8.0  
**Risk Level:** HIGH - 10 years outdated, missing security patches

**Steps:**
```bash
# Update requirements.txt
sed -i 's/passlib==1.7.4/passlib==1.8.0/' backend/requirements.txt

# Install updated version
cd backend
pip install --upgrade passlib==1.8.0

# Test password hashing (if used)
python -c "from passlib.hash import bcrypt; print(bcrypt.hash('test'))"
```

**Breaking Changes:** None for bcrypt/argon2 usage  
**Migration Required:** No

---

#### 2. Migrate from paypalrestsdk (IMMEDIATE)

**Current:** paypalrestsdk==1.13.3 (Released: 2016, DEPRECATED)  
**Target:** paypal-server-sdk==0.5.0 (Official SDK)  
**Risk Level:** HIGH - Deprecated package, no security updates

**Why Migrate:**
- paypalrestsdk is deprecated by PayPal
- No Python 3.10+ support
- Missing modern payment features
- Security vulnerabilities not patched

**Migration Steps:**

1. **Install new SDK:**
```bash
pip uninstall paypalrestsdk
pip install paypal-server-sdk==0.5.0
```

2. **Update requirements.txt:**
```diff
- paypalrestsdk==1.13.3
+ paypal-server-sdk==0.5.0
```

3. **Update backend/paypal_service.py:**

**OLD CODE:**
```python
import paypalrestsdk

paypalrestsdk.configure({
    "mode": "sandbox",  # or "live"
    "client_id": os.getenv("PAYPAL_CLIENT_ID"),
    "client_secret": os.getenv("PAYPAL_CLIENT_SECRET")
})

payment = paypalrestsdk.Payment({
    "intent": "sale",
    "payer": {"payment_method": "paypal"},
    "transactions": [{
        "amount": {"total": "10.00", "currency": "USD"}
    }]
})
```

**NEW CODE:**
```python
from paypalserversdk.client import PayPalClient
from paypalserversdk.models import Order, Amount, PurchaseUnit

client = PayPalClient(
    client_id=os.getenv("PAYPAL_CLIENT_ID"),
    client_secret=os.getenv("PAYPAL_CLIENT_SECRET"),
    environment='sandbox'  # or 'production'
)

order = Order(
    intent='CAPTURE',
    purchase_units=[
        PurchaseUnit(
            amount=Amount(
                currency_code='USD',
                value='10.00'
            )
        )
    ]
)

response = client.orders.create(order)
```

4. **Update backend/paypal_payout_service.py** similarly

5. **Test integration:**
```bash
python backend/test_paypal_integration.py
```

**Estimated Effort:** 4-6 hours  
**Testing Required:** Full payment flow testing

---

### High Priority Updates

#### 3. Upgrade FastAPI Ecosystem

**Current Versions:**
- fastapi==0.110.1
- uvicorn==0.25.0
- starlette==0.37.2

**Target Versions:**
- fastapi==0.115.0
- uvicorn==0.32.0
- starlette==0.41.0

**Benefits:**
- Performance improvements (15-20% faster)
- Better WebSocket support
- Improved async context manager handling
- Security patches

**Steps:**
```bash
# Update requirements.txt
pip install --upgrade fastapi==0.115.0 uvicorn==0.32.0 starlette==0.41.0

# Test server startup
cd backend
uvicorn server:app --reload

# Run test suite
pytest tests/
```

**Breaking Changes:**
- Minor changes to dependency injection
- WebSocket lifecycle methods updated

**Migration Guide:** https://fastapi.tiangolo.com/release-notes/

---

#### 4. Update MongoDB Driver

**Current:** motor==3.3.1, pymongo==4.5.0  
**Target:** motor==3.7.0, pymongo==4.10.1

**Benefits:**
- Better performance (10-15% improvement)
- Bug fixes for async operations
- MongoDB 7.0+ support

**Steps:**
```bash
pip install --upgrade motor==3.7.0 pymongo==4.10.1
```

**Breaking Changes:** None  
**Testing:** Run database performance tests
```bash
python backend/performance_benchmark.py
```

---

### Medium Priority Updates

#### 5. Update Python Type Checking Tools

**Current:**
- mypy==1.19.0
- typing_extensions==4.15.0

**Target:**
- mypy==1.25.0
- typing_extensions==4.18.0

**Steps:**
```bash
# These should be in requirements-dev.txt (not requirements.txt)
pip install --upgrade mypy==1.25.0 typing_extensions==4.18.0

# Run type checking
cd backend
mypy server.py
```

---

### Cleanup: Remove Unused Dependencies

**Remove these from requirements.txt:**

```diff
- agora_token_builder==1.0.0  # Not imported in codebase
- bidict==0.23.1              # No usage found
- jq==1.10.0                  # CLI tool, not runtime dep
- librt==0.7.3                # Suspicious/unknown package
- s5cmd==0.2.0                # CLI tool for AWS S3
```

**Verification:**
```bash
# Search for imports
grep -r "import agora_token_builder" backend/
grep -r "from agora_token_builder" backend/
# (Should return no results)
```

---

### Best Practice: Split Dev Dependencies

**Create requirements-dev.txt:**
```txt
# Testing
pytest==9.0.2
pytest-asyncio==0.23.0
pytest-cov==4.1.0
pytest-mock==3.12.0

# Code Quality
black==25.12.0
flake8==7.3.0
isort==7.0.0
mypy==1.25.0
pylint==3.3.0

# Type Checking
mypy_extensions==1.1.0
typing-inspection==0.4.2
```

**Install:**
```bash
# Production
pip install -r requirements.txt

# Development
pip install -r requirements.txt -r requirements-dev.txt
```

---

## Frontend (JavaScript/TypeScript) Upgrades

### Critical: Fix React Compatibility Issue

#### 1. Downgrade React to 18.3.1 (IMMEDIATE)

**Current:** React 19.0.0 + React Native 0.79.5  
**Issue:** RN 0.79.5 doesn't fully support React 19  
**Risk Level:** HIGH - Potential runtime errors

**Steps:**
```bash
cd frontend

# Downgrade React
npm install react@18.3.1 react-dom@18.3.1

# Verify compatibility
npm list react react-dom react-native

# Expected output:
# react@18.3.1
# react-dom@18.3.1  
# react-native@0.79.5
```

**Update package.json:**
```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-native": "0.79.5"
  }
}
```

**Testing:**
```bash
npm start
# Test on iOS, Android, and Web
```

**Alternative:** Wait for React Native 0.80+ with React 19 support  
**Timeline:** Expected Q2 2026

---

### High Priority Updates

#### 2. Update Babel Runtime

**Current:** @babel/runtime@^7.28.4 (2023)  
**Target:** @babel/runtime@^7.26.0

**Steps:**
```bash
cd frontend
npm install --save @babel/runtime@^7.26.0
npm install --save-dev @babel/core@^7.26.0
```

---

#### 3. Update TypeScript ESLint

**Current:** typescript-eslint@^8.50.1  
**Target:** typescript-eslint@^8.55.0

**Steps:**
```bash
cd frontend
npm install --save-dev typescript-eslint@^8.55.0
```

---

### Testing: Add Missing Dependencies

**Current:** No testing framework installed  
**Required:** Jest + React Native Testing Library

**Installation:**
```bash
cd frontend

# Install testing dependencies
npm install --save-dev \
  @testing-library/react-native@^12.4.0 \
  @testing-library/jest-native@^5.4.3 \
  jest@^29.7.0 \
  jest-expo@^51.0.0 \
  @types/jest@^29.5.0

# Add test script to package.json
```

**Update package.json:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "preset": "jest-expo",
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ],
    "setupFilesAfterEnv": ["@testing-library/jest-native/extend-expect"]
  }
}
```

**Create first test:**
```typescript
// __tests__/App.test.tsx
import { render } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId).toBeDefined();
  });
});
```

---

## Upgrade Execution Plan

### Phase 1: Critical Security (Week 1)
**Priority:** IMMEDIATE  
**Risk:** HIGH if delayed

1. ✅ Upgrade passlib to 1.8.0
2. ✅ Migrate paypalrestsdk to paypal-server-sdk
3. ✅ Downgrade React to 18.3.1
4. ✅ Test all payment flows
5. ✅ Test all authentication flows

**Validation:**
```bash
# Backend
cd backend
pip install -r requirements.txt
python -m pytest tests/

# Frontend
cd frontend
npm install
npm start
```

---

### Phase 2: Performance & Stability (Week 2-3)

1. ✅ Upgrade FastAPI ecosystem
2. ✅ Update MongoDB drivers
3. ✅ Update Babel runtime
4. ✅ Add frontend testing framework
5. ✅ Run performance benchmarks

**Validation:**
```bash
# Performance test
python backend/performance_benchmark.py

# Load test
locust -f backend/load_test.py --host=http://localhost:8001
```

---

### Phase 3: Cleanup & Optimization (Week 4)

1. ✅ Remove unused dependencies
2. ✅ Split dev dependencies
3. ✅ Update TypeScript tooling
4. ✅ Document breaking changes
5. ✅ Update deployment configs

---

## Dependency Health Monitoring

### Automated Checks

**Add to .github/workflows/dependency-check.yml:**
```yaml
name: Dependency Check

on:
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  check-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install pip-audit
      - run: pip-audit -r backend/requirements.txt

  check-javascript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: cd frontend && npm audit
      - run: cd frontend && npm outdated
```

### Manual Checks

**Python:**
```bash
# Check for security vulnerabilities
pip-audit -r backend/requirements.txt

# Check for outdated packages
pip list --outdated

# Check for deprecated packages
pip-check
```

**JavaScript:**
```bash
cd frontend

# Security audit
npm audit

# Check for outdated
npm outdated

# Check for deprecated
npm-check --skip-unused
```

---

## Rollback Procedures

### Backend Rollback

If upgrades cause issues:
```bash
# Revert to previous requirements.txt
git checkout HEAD~1 backend/requirements.txt

# Reinstall old versions
pip install -r backend/requirements.txt --force-reinstall

# Restart services
systemctl restart grover-backend
```

### Frontend Rollback

```bash
cd frontend

# Revert package.json and package-lock.json
git checkout HEAD~1 package.json package-lock.json

# Reinstall old versions
rm -rf node_modules
npm install

# Rebuild
npm run build
```

---

## Support & Resources

**Package Documentation:**
- FastAPI: https://fastapi.tiangolo.com/
- PayPal SDK: https://github.com/paypal/PayPal-Python-Server-SDK
- React Native: https://reactnative.dev/
- Expo: https://docs.expo.dev/

**Security Advisories:**
- Python: https://pypi.org/security/
- JavaScript: https://github.com/advisories
- GitHub: https://github.com/jarell94/grover/security/advisories

**Questions?** Open an issue or contact the development team.

---

**Document maintained by:** Development Team  
**Review frequency:** Monthly  
**Last security audit:** January 2026
