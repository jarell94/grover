# Sentry Error Monitoring Setup Guide

## Overview

Sentry provides real-time error tracking and performance monitoring for Grover. This guide covers:
- Installation and configuration
- Integration with FastAPI backend
- Frontend error tracking
- Performance monitoring setup
- Best practices

## Why Sentry?

- **Real-time Error Notifications**: Get alerts when errors occur
- **Error Grouping**: Automatically groups similar errors
- **Performance Monitoring**: Track API performance
- **Release Tracking**: Monitor specific app versions
- **Custom Context**: Attach user/request data to errors
- **Source Maps**: Map minified code back to source for frontend
- **Free Tier**: Generous free tier for starting out

## Backend Setup (FastAPI)

### 1. Install Sentry SDK

```bash
pip install sentry-sdk[fastapi]
```

### 2. Add to `.env`

```
SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_ENVIRONMENT=development  # or production
SENTRY_TRACES_SAMPLE_RATE=0.1   # Sample 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1 # Sample 10% of profiles
```

### 3. Update `backend/config.py`

```python
from sentry_sdk import init as sentry_init
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.socket import SocketIntegration

class Settings:
    # ... existing settings ...
    SENTRY_DSN = os.getenv('SENTRY_DSN', '')
    SENTRY_ENVIRONMENT = os.getenv('SENTRY_ENVIRONMENT', 'development')
    SENTRY_TRACES_SAMPLE_RATE = float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1'))
    SENTRY_PROFILES_SAMPLE_RATE = float(os.getenv('SENTRY_PROFILES_SAMPLE_RATE', '0.0'))
    
    @classmethod
    def init_sentry(cls):
        if not cls.SENTRY_DSN:
            return
        
        sentry_init(
            dsn=cls.SENTRY_DSN,
            environment=cls.SENTRY_ENVIRONMENT,
            traces_sample_rate=cls.SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=cls.SENTRY_PROFILES_SAMPLE_RATE,
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
            release="grover@1.0.0",
        )
```

### 4. Update `backend/server.py`

```python
from config import settings

# Initialize Sentry before creating app
settings.init_sentry()

app = FastAPI(title=settings.APP_NAME)

# Optional: Capture unhandled exceptions
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    with sentry_sdk.push_scope() as scope:
        scope.set_context("request", {
            "method": request.method,
            "url": str(request.url),
            "headers": dict(request.headers),
        })
        sentry_sdk.capture_exception(exc)
    
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

## Frontend Setup (React Native / Expo)

### 1. Install Sentry SDK

```bash
npm install @sentry/react-native @sentry/react-native-healthchecks
# or
yarn add @sentry/react-native
```

### 2. Add to `frontend/.env`

```
EXPO_PUBLIC_SENTRY_DSN=https://your-frontend-key@your-org.ingest.sentry.io/your-frontend-project-id
EXPO_PUBLIC_SENTRY_ENVIRONMENT=development
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

### 3. Create `frontend/utils/sentry.ts`

```typescript
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export function initSentry() {
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn('Sentry DSN not configured');
    return;
  }
  
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT || 'development',
    tracesSampleRate: parseFloat(
      process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'
    ),
    enableAppHangDetection: true,
    attachStacktrace: true,
    maxBreadcrumbs: 50,
    release: Constants.expoConfig?.version,
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('custom', context);
    }
    Sentry.captureException(error);
  });
}

export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') {
  Sentry.captureMessage(message, level);
}

export function setUser(userId: string, email?: string) {
  Sentry.setUser({
    id: userId,
    email: email,
  });
}

export function clearUser() {
  Sentry.setUser(null);
}
```

### 4. Update `frontend/app/_layout.tsx`

```typescript
import { initSentry } from './utils/sentry';

// Initialize Sentry early
initSentry();

export default function RootLayout() {
  // ... rest of layout
}
```

### 5. Wrap Components with Error Boundary

```typescript
import * as Sentry from '@sentry/react-native';

// Automatically wrap all navigation with error boundary
export const SentryErrorBoundary = Sentry.withErrorBoundary(
  YourComponent,
  {
    fallback: <ErrorFallback />,
    showDialog: true,
  }
);
```

## Best Practices

### 1. Add User Context
Always associate errors with users when available:

```python
# Backend
import sentry_sdk

@app.get("/api/posts")
async def get_posts(current_user: User = Depends(require_auth)):
    with sentry_sdk.push_scope() as scope:
        scope.set_user({
            "id": current_user.user_id,
            "email": current_user.email,
            "name": current_user.name,
        })
        # Your endpoint logic
```

### 2. Add Custom Breadcrumbs
Track important events:

```python
import sentry_sdk

# Log API calls
sentry_sdk.add_breadcrumb(
    category="api",
    message="Creating post",
    level="info",
    data={"user_id": current_user.user_id}
)
```

### 3. Release Tracking
Tag errors with app version:

```python
sentry_sdk.init(
    dsn="...",
    release="grover@1.0.0",
    environment="production"
)
```

### 4. Custom Error Tags
Tag errors for easier filtering:

```python
import sentry_sdk

try:
    process_payment()
except Exception as e:
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("component", "payments")
        scope.set_tag("action", "process_payment")
        sentry_sdk.capture_exception(e)
```

## Dashboard Features

### Alerts
Set up alerts for:
- New errors
- Error spikes (e.g., 10+ errors in 5 minutes)
- Performance degradation
- Release deploys

### Filters
Filter errors by:
- Environment (development/production)
- Release version
- User ID
- URL path
- Status code
- Browser/device
- Custom tags

### Performance Monitoring
- Track slow API endpoints
- Monitor database query performance
- Identify bottlenecks

## Error Severity Levels

```python
# Critical - System down
Sentry.captureMessage("Payment system down", "fatal")

# High - Major functionality broken
Sentry.captureMessage("Auth system failed", "error")

# Medium - Feature not working
Sentry.captureMessage("Image upload failed", "warning")

# Low - Informational
Sentry.captureMessage("User logged in", "info")
```

## Testing Sentry Integration

### Backend
```python
# Add a test route
@app.get("/test-sentry")
async def test_sentry():
    try:
        raise Exception("Test Sentry integration")
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return {"status": "error sent to Sentry"}
```

### Frontend
```typescript
import { captureException } from './utils/sentry';

<Button
  title="Test Sentry"
  onPress={() => {
    try {
      throw new Error("Test Sentry integration");
    } catch (error) {
      captureException(error as Error);
    }
  }}
/>
```

## Next Steps

1. Create Sentry project at https://sentry.io
2. Get your DSN from project settings
3. Add to `.env` files
4. Run tests using test routes above
5. View errors in Sentry dashboard
6. Configure alerts and release tracking

## Pricing

- **Free Tier**: Up to 5,000 events/month per project
- **Team**: $29/month for higher limits and features
- **Business**: Custom pricing for enterprise

For Grover's scale, the free tier should be sufficient initially!
