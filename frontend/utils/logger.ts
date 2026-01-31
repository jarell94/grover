/**
 * Logger utility for Grover app
 * 
 * Provides development-safe logging that automatically removes console
 * statements in production builds.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('Debug message', data);
 *   logger.error('Error occurred', error);
 */

import * as Sentry from '@sentry/react-native';

const isDevelopment = __DEV__;

export const logger = {
  /**
   * Log general debug information (only in development)
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log informational messages (only in development)
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Log warnings (only in development)
   */
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  /**
   * Log errors (always logged, sent to Sentry in production)
   */
  error: (...args: any[]) => {
    console.error(...args);
    
    // Send to Sentry in production
    if (!isDevelopment) {
      const error = args[0];
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), 'error');
      }
    }
  },

  /**
   * Log detailed debug information (only in development)
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Group related log messages (only in development)
   */
  group: (label: string, callback: () => void) => {
    if (isDevelopment) {
      console.group(label);
      callback();
      console.groupEnd();
    }
  },

  /**
   * Log with timestamp (only in development)
   */
  logWithTime: (message: string, ...args: any[]) => {
    if (isDevelopment) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${message}`, ...args);
    }
  }
};

export default logger;
