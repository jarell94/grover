# Error Handling and Debugging Improvements

## Issue Addressed
Fixed the console error: "Process redirect error: Error: Network error. Please check your connection." that occurred during OAuth authentication redirect.

## Root Cause Analysis

The error occurred in the authentication flow when:
1. User completes OAuth authentication via Emergent Auth
2. Gets redirected back to the app with a `session_id` parameter
3. Frontend calls `api.createSession(sessionId)` to exchange the session ID for a token
4. Network request fails due to:
   - Backend not running or not accessible
   - Misconfigured `EXPO_PUBLIC_BACKEND_URL`
   - Actual network connectivity issues
   - Request timeout (30 seconds)

The original error messages were too generic and didn't provide enough context for debugging.

## Improvements Made

### 1. Enhanced Error Messages in `api.ts`

#### Before:
```typescript
if (error.name === 'AbortError') {
  throw new Error('Request timeout. Please check your connection.');
}
if (error.message === 'Network request failed') {
  throw new Error('Network error. Please check your connection.');
}
```

#### After:
```typescript
if (error.name === 'AbortError') {
  const timeoutError = new Error(`Request timeout after ${REQUEST_TIMEOUT}ms. URL: ${url}`);
  if (__DEV__) {
    console.error('API Request Timeout:', { url, timeout: REQUEST_TIMEOUT });
  }
  throw timeoutError;
}

if (error.message === 'Network request failed' || error.message === 'Failed to fetch') {
  const networkError = new Error(`Network error: Unable to reach ${url}. Please check your connection and ensure the backend is running.`);
  if (__DEV__) {
    console.error('API Network Error:', { 
      url, 
      backendUrl: BACKEND_URL,
      error: error.message,
      hint: 'Check if EXPO_PUBLIC_BACKEND_URL is set correctly and backend server is running'
    });
  }
  throw networkError;
}
```

**Benefits:**
- Error messages now include the specific URL that failed
- Timeout errors show the actual timeout duration
- Development mode shows additional debugging hints
- Helps developers quickly identify configuration issues

### 2. Improved Backend URL Initialization Logging

#### Before:
```typescript
const initializeUrls = () => {
  if (!BACKEND_URL) {
    BACKEND_URL = getBackendUrl();
    API_URL = `${BACKEND_URL.replace(/\/+$/, '')}/api`;
    console.log('API Configuration:', { BACKEND_URL, API_URL });
  }
};
```

#### After:
```typescript
const initializeUrls = () => {
  if (!BACKEND_URL) {
    try {
      BACKEND_URL = getBackendUrl();
      API_URL = `${BACKEND_URL.replace(/\/+$/, '')}/api`;
      
      if (__DEV__) {
        console.log('✓ API Configuration initialized:', { 
          BACKEND_URL, 
          API_URL,
          platform: Platform.OS,
          isDev: __DEV__
        });
      }
    } catch (error: any) {
      console.error('✗ Failed to initialize API URLs:', error.message);
      throw error;
    }
  }
};
```

**Benefits:**
- Visual indicators (✓/✗) make logs easy to scan
- Shows platform and development mode for context
- Fails loudly if initialization fails
- Only logs in development to avoid exposing info in production

### 3. Enhanced Auth Error Logging in `AuthContext.tsx`

#### Before:
```typescript
console.log('Calling API to create session...');
const response = await api.createSession(sessionId);
console.log('Session created successfully');
```

#### After:
```typescript
console.log('✓ Found session_id, authenticating...', sessionId.substring(0, 10) + '...');

try {
  const response = await api.createSession(sessionId);
  console.log('✓ Session created successfully');
  
  // ... rest of the code
  
  console.log('✓ Login successful for user:', userData.email);
  console.log('✓ Socket connected');
} catch (apiError: any) {
  console.error('✗ API createSession failed:', {
    error: apiError.message,
    sessionIdPreview: sessionId.substring(0, 10) + '...',
    hint: 'Check if backend is running and EXPO_PUBLIC_BACKEND_URL is configured'
  });
  throw apiError;
}
```

**Benefits:**
- Clear visual indicators for success (✓) and failure (✗)
- Session ID preview for debugging (only first 10 chars for security)
- Specific error context with hints
- Separated API errors from redirect URL parsing errors

### 4. Improved Error Context in Catch Block

#### Before:
```typescript
catch (error) {
  console.error('Process redirect error:', error);
  await AsyncStorage.removeItem('session_token');
  setAuthToken(null);
  return false;
}
```

#### After:
```typescript
catch (error) {
  console.error('✗ Process redirect error:', {
    error: error instanceof Error ? error.message : String(error),
    url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
    hasSessionId: url.includes('session_id'),
    hint: 'This could be due to: 1) Backend not running, 2) Network error, 3) Invalid session_id, 4) EXPO_PUBLIC_BACKEND_URL misconfigured'
  });
  
  await AsyncStorage.removeItem('session_token');
  setAuthToken(null);
  return false;
}
```

**Benefits:**
- Shows the full error message properly formatted
- Includes URL preview for context
- Indicates if session_id was found in the URL
- Provides actionable hints for common issues

### 5. Updated Sentry Error Filtering

#### Before:
```typescript
if (error?.message?.includes('Network request failed')) {
  // Don't send network errors - they're usually connectivity issues
  return null;
}
```

#### After:
```typescript
if (error?.message?.includes('Network request failed')) {
  // Keep network errors that happen during authentication or critical operations
  if (event.breadcrumbs?.some(b => b.category === 'auth')) {
    // Keep this error - it's an auth-related network failure
    return event;
  }
  // Don't send generic network errors - they're usually connectivity issues
  return null;
}
```

**Benefits:**
- Network errors during authentication are now tracked in Sentry
- Generic network errors are still filtered out to reduce noise
- Better visibility into critical auth failures in production

## How to Debug Network Errors Now

When you see a network error in the logs, follow these steps:

1. **Check the log messages with ✓ and ✗ indicators:**
   - ✓ = Success
   - ✗ = Failure

2. **Look for the API configuration log:**
   ```
   ✓ API Configuration initialized: {
     BACKEND_URL: "http://192.168.1.1:3000",
     API_URL: "http://192.168.1.1:3000/api",
     platform: "ios",
     isDev: true
   }
   ```
   - Verify the BACKEND_URL points to your backend server
   - Ensure the port is correct (default: 3000)

3. **If you see "✗ API Network Error":**
   - Check if the backend server is running
   - Verify EXPO_PUBLIC_BACKEND_URL is set correctly
   - Test the URL in a browser or curl
   - Check network connectivity

4. **If you see "API Request Timeout":**
   - Backend might be slow to respond
   - Network latency issues
   - Backend might be processing but taking >30 seconds
   - Consider increasing REQUEST_TIMEOUT if needed

5. **For auth errors specifically:**
   - Check if session_id was extracted: `✓ Found session_id, authenticating...`
   - If not found: The OAuth redirect might not have included the session_id
   - If found but API fails: Backend authentication endpoint issue

## Environment Variables

Make sure to set these environment variables:

### Development (Local)
```bash
# .env file or EAS Secrets
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000
```

### Production
```bash
# .env file or EAS Secrets
EXPO_PUBLIC_BACKEND_URL=https://api.yourdomain.com
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn
EXPO_PUBLIC_ENVIRONMENT=production
```

## Testing the Improvements

1. Start the backend server (command may vary based on your setup):
   ```bash
   # Python/FastAPI backend
   cd backend && python server.py
   
   # Node.js/Express backend
   cd backend && npm start
   
   # Or use your specific backend command
   ```
2. Start the frontend: `cd frontend && npm start`
3. Attempt to login
4. Check the console logs for clear error messages with hints
5. If network errors occur, follow the debugging steps above

## Future Improvements

Consider adding:
- Retry logic for transient network failures
- Exponential backoff for failed requests
- Connection health check before critical operations
- User-facing error messages for common issues
- Automatic backend URL detection based on app environment
