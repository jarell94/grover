// Safe utility functions to prevent crashes

type Timeout = ReturnType<typeof setTimeout>;

/**
 * Safely parse JSON with fallback
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

/**
 * Parse "a.b[0].c" or "a.b.0.c" into keys
 */
function parsePath(path: string): Array<string | number> {
  // Convert brackets to dots: a.b[0].c -> a.b.0.c
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized
    .split('.')
    .filter(Boolean)
    .map((k) => (/^\d+$/.test(k) ? Number(k) : k));
}

/**
 * Safely access nested object properties (supports array indexes)
 */
export const safeGet = <T>(obj: any, path: string, fallback: T): T => {
  try {
    const keys = parsePath(path);
    let result = obj;

    for (const key of keys) {
      result = result?.[key as any];
      if (result === undefined || result === null) break;
    }

    return (result ?? fallback) as T;
  } catch {
    return fallback;
  }
};

/**
 * Safely execute async function with error handling
 */
export const safeAsync = async <T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (error: Error) => void
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (__DEV__) console.error('safeAsync error:', error);
    onError?.(error as Error);
    return fallback;
  }
};

/**
 * Common helper for event handlers returning void
 */
export const safeAsyncVoid = async (
  fn: () => Promise<void>,
  onError?: (error: Error) => void
): Promise<void> => {
  await safeAsync(fn, undefined, onError);
};

/**
 * Debounce function to prevent rapid calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function to limit call frequency (leading only)
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (inThrottle) return;
    func(...args);
    inThrottle = true;
    setTimeout(() => (inThrottle = false), limit);
  };
};

/**
 * Retry function with exponential backoff (optional shouldRetry)
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  shouldRetry?: (error: unknown) => boolean
): Promise<T> => {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (shouldRetry && !shouldRetry(error)) break;

      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('retryWithBackoff failed');
};

/**
 * Safe array operations
 */
export const safeArray = {
  first: <T>(arr: T[] | null | undefined, fallback: T | null = null): T | null =>
    arr?.[0] ?? fallback,

  last: <T>(arr: T[] | null | undefined, fallback: T | null = null): T | null =>
    arr?.[arr.length - 1] ?? fallback,

  at: <T>(arr: T[] | null | undefined, index: number, fallback: T | null = null): T | null =>
    arr?.[index] ?? fallback,

  length: (arr: any[] | null | undefined): number => arr?.length ?? 0,
};

/**
 * Format error message for display
 */
export const formatErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
};

/**
 * Check if value is valid (not null, undefined, or empty)
 */
export const isValid = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
};
