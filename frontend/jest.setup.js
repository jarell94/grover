// Jest setup file
import '@testing-library/jest-native/extend-expect';

// Mock expo modules
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      EXPO_PUBLIC_BACKEND_URL: 'http://localhost:8001'
    }
  }
}));

jest.mock('expo-linking', () => ({
  createURL: jest.fn(() => 'grover://'),
  parse: jest.fn(() => ({ queryParams: {} })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null))
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn()
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Sentry
jest.mock('./utils/sentry', () => ({
  initSentry: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  reportError: jest.fn()
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
};
