import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const ENVIRONMENT = process.env.EXPO_PUBLIC_ENVIRONMENT || 'development';

export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Set debug to true for development
    debug: ENVIRONMENT === 'development',
    
    // Performance Monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Session Replay (only in production)
    replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: ENVIRONMENT === 'production' ? 1.0 : 0,
    
    // Enable auto session tracking
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    
    // Attach stack traces to all messages
    attachStacktrace: true,
    
    // Auto-detect release version
    release: Constants.expoConfig?.version || '1.0.0',
    dist: Platform.OS,
    
    // Filter out known non-critical errors
    beforeSend(event, hint) {
      const error = hint.originalException as Error;
      
      // Filter out generic network errors, but keep auth-related network errors
      if (error?.message?.includes('Network request failed')) {
        // Keep network errors that happen during authentication or critical operations
        if (event.breadcrumbs?.some(b => b.category === 'auth')) {
          // Keep this error - it's an auth-related network failure
          return event;
        }
        // Don't send generic network errors - they're usually connectivity issues
        return null;
      }
      
      // Filter out cancelled navigation errors
      if (error?.message?.includes('Navigation cancelled')) {
        return null;
      }
      
      return event;
    },
    
    // Enrich error context
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy console logs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      return breadcrumb;
    },
  });

  console.log(`Sentry initialized for ${ENVIRONMENT} environment`);
};

// Helper to capture errors with extra context
export const captureError = (error: Error, context?: Record<string, any>) => {
  if (!SENTRY_DSN) return;
  
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

// Helper to capture messages
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
};

// Helper to set user context
export const setUser = (user: { id: string; email?: string; username?: string } | null) => {
  if (!SENTRY_DSN) return;
  
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
};

// Helper to add breadcrumb
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, any>
) => {
  if (!SENTRY_DSN) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
};

// Helper to start a transaction for performance monitoring
export const startTransaction = (name: string, op: string) => {
  if (!SENTRY_DSN) return null;
  return Sentry.startInactiveSpan({ name, op });
};

// Export Sentry for direct access if needed
export { Sentry };
