# CI/CD Pipeline Setup Guide - Grover App

**Platform:** GitHub Actions  
**Target:** Automated testing, building, and deployment  
**Timeline:** 1-2 days to implement

---

## Overview

This guide provides complete CI/CD workflows for the Grover app, covering:
- Automated testing (backend + frontend)
- Code quality checks
- Security scanning
- Dependency audits
- Automated deployments
- Performance monitoring

---

## 1. Testing Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
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
      
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt
      
      - name: Install dependencies
        run: |
          cd backend
          pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest pytest-asyncio pytest-cov pytest-timeout
      
      - name: Run linters
        run: |
          cd backend
          pip install black flake8 mypy
          black --check .
          flake8 . --count --max-line-length=120 --statistics
          mypy server.py --ignore-missing-imports
      
      - name: Run tests
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_grover
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          ENVIRONMENT: test
        run: |
          cd backend
          pytest tests/ \
            --cov=backend \
            --cov-report=xml \
            --cov-report=term \
            --cov-fail-under=70 \
            --maxfail=5 \
            -v
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./backend/coverage.xml
          flags: backend
          name: backend-coverage
          fail_ci_if_error: true
      
      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: py-cov-action/python-coverage-comment-action@v3
        with:
          GITHUB_TOKEN: ${{ github.token }}

  frontend-tests:
    name: Frontend Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Run linter
        run: |
          cd frontend
          npm run lint
      
      - name: Run type check
        run: |
          cd frontend
          npx tsc --noEmit
      
      - name: Run tests
        run: |
          cd frontend
          npm test -- \
            --coverage \
            --maxWorkers=2 \
            --ci \
            --passWithNoTests
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./frontend/coverage/coverage-final.json
          flags: frontend
          name: frontend-coverage
          fail_ci_if_error: false
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-test-results
          path: frontend/coverage/
          retention-days: 7

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    timeout-minutes: 20
    
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install backend dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      
      - name: Start backend server
        run: |
          cd backend
          uvicorn server:app --host 0.0.0.0 --port 8001 &
          sleep 10
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_grover
          ENVIRONMENT: test
      
      - name: Run integration tests
        run: |
          python backend_test.py
          python comprehensive_backend_test.py
```

---

## 2. Security Scanning Workflow

**File:** `.github/workflows/security.yml`

```yaml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Monday

jobs:
  dependency-scan:
    name: Dependency Vulnerability Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Trivy scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
  
  python-security:
    name: Python Security Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install pip-audit
        run: pip install pip-audit
      
      - name: Run pip-audit
        run: |
          cd backend
          pip-audit -r requirements.txt --format json --output pip-audit-results.json
      
      - name: Upload pip-audit results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: pip-audit-results
          path: backend/pip-audit-results.json
  
  javascript-security:
    name: JavaScript Security Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run npm audit
        run: |
          cd frontend
          npm audit --json > npm-audit-results.json || true
      
      - name: Upload npm audit results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: npm-audit-results
          path: frontend/npm-audit-results.json
  
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: read
    
    strategy:
      matrix:
        language: ['python', 'javascript']
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v3
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

---

## 3. Build & Deploy Workflow

**File:** `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-backend:
    name: Build Backend Docker Image
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  build-frontend:
    name: Build Frontend
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Build web version
        run: |
          cd frontend
          npm run build:web
        env:
          EXPO_PUBLIC_API_URL: ${{ secrets.API_URL }}
      
      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist/
          retention-days: 7

  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest
    needs: [build-backend]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to production
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/grover
            docker-compose pull backend
            docker-compose up -d backend
            docker-compose exec backend python db_optimize.py

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: [build-frontend]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: dist
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./dist
```

---

## 4. Performance Monitoring Workflow

**File:** `.github/workflows/performance.yml`

```yaml
name: Performance Check

on:
  pull_request:
    branches: [main, develop]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  lighthouse:
    name: Lighthouse Performance Audit
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v10
        with:
          urls: |
            https://grover-staging.example.com
            https://grover-staging.example.com/explore
          uploadArtifacts: true
          temporaryPublicStorage: true

  backend-performance:
    name: Backend Performance Test
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:7.0
        ports:
          - 27017:27017
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install locust
      
      - name: Start server
        run: |
          cd backend
          uvicorn server:app --host 0.0.0.0 --port 8001 &
          sleep 10
        env:
          MONGO_URL: mongodb://localhost:27017
          DB_NAME: test_grover
      
      - name: Run performance tests
        run: |
          python backend/performance_benchmark.py
      
      - name: Run load test
        run: |
          locust -f backend/load_test.py \
            --host=http://localhost:8001 \
            --users 100 \
            --spawn-rate 10 \
            --run-time 60s \
            --headless \
            --html locust-report.html
      
      - name: Upload performance reports
        uses: actions/upload-artifact@v4
        with:
          name: performance-reports
          path: locust-report.html
```

---

## 5. Code Quality Workflow

**File:** `.github/workflows/quality.yml`

```yaml
name: Code Quality

on:
  pull_request:
    branches: [main, develop]

jobs:
  sonarcloud:
    name: SonarCloud Analysis
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  code-review:
    name: Automated Code Review
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Run CodeGuru Reviewer
        uses: aws-actions/codeguru-reviewer@v1.1
        with:
          s3_bucket: ${{ secrets.AWS_S3_BUCKET }}
```

---

## 6. Required GitHub Secrets

Add these secrets in **Settings → Secrets → Actions**:

### Backend Deployment
- `PROD_HOST` - Production server IP/hostname
- `PROD_USER` - SSH username
- `PROD_SSH_KEY` - SSH private key

### Frontend Deployment
- `VERCEL_TOKEN` - Vercel deployment token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

### External Services
- `SONAR_TOKEN` - SonarCloud token
- `AWS_S3_BUCKET` - S3 bucket for artifacts

### Runtime Configuration
- `API_URL` - Production API URL

---

## 7. Branch Protection Rules

Configure in **Settings → Branches → Branch protection rules**:

### For `main` branch:
- ✅ Require pull request reviews before merging (1 approval)
- ✅ Require status checks to pass:
  - `backend-tests`
  - `frontend-tests`
  - `dependency-scan`
  - `codeql`
- ✅ Require branches to be up to date before merging
- ✅ Include administrators
- ✅ Restrict who can push to matching branches

### For `develop` branch:
- ✅ Require status checks to pass:
  - `backend-tests`
  - `frontend-tests`
- ✅ Require branches to be up to date

---

## 8. Docker Setup

**File:** `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8001/api/health')"

# Run application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8001:8001"
    environment:
      - MONGO_URL=mongodb://mongodb:27017
      - DB_NAME=grover
      - REDIS_HOST=redis
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped

  mongodb:
    image: mongo:7.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  mongo-data:
```

---

## 9. Local Development Setup

**File:** `.github/workflows/local-setup.sh`

```bash
#!/bin/bash
# Local development setup script

set -e

echo "🚀 Setting up Grover development environment..."

# Backend setup
echo "📦 Setting up backend..."
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-test.txt

# Frontend setup
echo "📱 Setting up frontend..."
cd ../frontend
npm install

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d mongodb redis

echo "✅ Setup complete!"
echo "Run 'cd backend && uvicorn server:app --reload' to start backend"
echo "Run 'cd frontend && npm start' to start frontend"
```

---

## 10. Monitoring & Alerts

### GitHub Actions Notifications

Configure Slack/Discord webhooks:

```yaml
# Add to any workflow
- name: Notify on failure
  if: failure()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    payload: |
      {
        "text": "❌ ${{ github.workflow }} failed in ${{ github.repository }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Build Failed*\nWorkflow: ${{ github.workflow }}\nBranch: ${{ github.ref }}\nCommit: ${{ github.sha }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Implementation Checklist

- [ ] Create `.github/workflows/` directory
- [ ] Add test.yml workflow
- [ ] Add security.yml workflow
- [ ] Add deploy.yml workflow
- [ ] Add performance.yml workflow
- [ ] Add quality.yml workflow
- [ ] Configure GitHub secrets
- [ ] Set up branch protection rules
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Test workflows on pull request
- [ ] Configure Slack/Discord notifications
- [ ] Document deployment process
- [ ] Train team on CI/CD usage

---

**Estimated Setup Time:** 1-2 days  
**Maintenance:** ~1 hour/month  
**Benefits:** Automated quality checks, faster deployments, reduced bugs

---

**Document maintained by:** DevOps Team  
**Last updated:** January 2026
