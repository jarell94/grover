import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Test component that uses auth context
const TestComponent = () => {
  const { user, loading } = useAuth();
  return (
    <>
      <Text testID="loading">{loading ? 'loading' : 'ready'}</Text>
      <Text testID="user">{user ? user.email : 'no-user'}</Text>
    </>
  );
};

describe('AuthContext', () => {
  it('should provide initial loading state', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initially should be loading
    await waitFor(() => {
      expect(getByTestId('loading')).toBeTruthy();
    });
  });

  it('should show no user when not authenticated', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('user').props.children).toBe('no-user');
    }, { timeout: 3000 });
  });
});
