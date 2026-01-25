import React, { useEffect } from 'react';
import { Stack, usePathname } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ErrorBoundary from '../components/ErrorBoundary';
import { initSentry } from '../utils/sentry';

// Initialize Sentry as early as possible
initSentry();

export default function RootLayout() {
  const pathname = usePathname();
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary resetKey={pathname}>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[conversationId]" options={{ presentation: 'card' }} />

            {/* Post view */}
            <Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />

            {/* Editors */}
            <Stack.Screen name="edit-post" options={{ presentation: 'modal' }} />
            <Stack.Screen name="edit-product" options={{ presentation: 'modal' }} />

            {/* New feature screens */}
            <Stack.Screen name="mentions" options={{ presentation: 'card' }} />
            <Stack.Screen name="marketplace" options={{ presentation: 'card' }} />
            <Stack.Screen name="collections" options={{ presentation: 'card' }} />
            <Stack.Screen name="collection-detail" options={{ presentation: 'card' }} />
            <Stack.Screen name="communities" options={{ presentation: 'card' }} />
            <Stack.Screen name="community-detail" options={{ presentation: 'card' }} />
            <Stack.Screen name="analytics" options={{ presentation: 'card' }} />
            <Stack.Screen name="schedule-post" options={{ presentation: 'card' }} />

            {/* Story and live streaming screens */}
            <Stack.Screen name="stories" options={{ presentation: 'modal' }} />
            <Stack.Screen name="create-story" options={{ presentation: 'modal' }} />
            <Stack.Screen name="go-live" options={{ presentation: 'modal' }} />
            <Stack.Screen name="live-stream/[streamId]" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="schedule-stream" options={{ presentation: 'card' }} />

            {/* Settings and notification screens */}
            <Stack.Screen name="notification-settings" options={{ presentation: 'card' }} />
          </Stack>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
