import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

// Mock the AuthContext
const mockLogin = jest.fn();
const mockLoginWithApple = jest.fn();
const mockLoginWithDemo = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: mockLogin,
    loginWithApple: mockLoginWithApple,
    loginWithDemo: mockLoginWithDemo,
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock Colors
jest.mock('../../constants/Colors', () => ({
  Colors: {
    primary: '#000',
    background: '#fff',
    gradient: { start: '#000', middle: '#333', end: '#666' },
  },
}));

import IndexScreen from '../../app/index';

describe('Index (Login) Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Google Sign Up button', () => {
    const { getByText } = render(<IndexScreen />);
    expect(getByText('Sign up with Google')).toBeTruthy();
  });

  it('should render Google Sign In button', () => {
    const { getByText } = render(<IndexScreen />);
    expect(getByText('Sign in with Google')).toBeTruthy();
  });

  it('should render info text about account creation', () => {
    const { getByText } = render(<IndexScreen />);
    expect(getByText('New to Grover? Sign up creates your account automatically')).toBeTruthy();
  });

  it('should call login with signup mode when Sign Up button is pressed', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { getByText } = render(<IndexScreen />);
    fireEvent.press(getByText('Sign up with Google'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ mode: 'signup' });
    });
  });

  it('should call login with signin mode when Sign In button is pressed', async () => {
    mockLogin.mockResolvedValue(undefined);
    const { getByText } = render(<IndexScreen />);
    fireEvent.press(getByText('Sign in with Google'));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ mode: 'signin' });
    });
  });

  it('should render Try Demo Account button', () => {
    const { getByText } = render(<IndexScreen />);
    expect(getByText('Try Demo Account')).toBeTruthy();
  });

  it('should call loginWithDemo when Demo button is pressed', async () => {
    mockLoginWithDemo.mockResolvedValue(undefined);
    const { getByText } = render(<IndexScreen />);
    fireEvent.press(getByText('Try Demo Account'));
    await waitFor(() => {
      expect(mockLoginWithDemo).toHaveBeenCalled();
    });
  });
});
