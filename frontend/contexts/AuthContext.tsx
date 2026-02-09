import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform, AppState } from 'react-native';
import { api, setAuthToken } from '../services/api';
import socketService from '../services/socket';
import { setUser as setSentryUser, addBreadcrumb } from '../utils/sentry';

// Ensure any incomplete auth sessions are dismissed
WebBrowser.maybeCompleteAuthSession();

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  bio?: string;
  is_premium: boolean;
  is_private: boolean;
  website?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  github?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  snapchat?: string;
  discord?: string;
  twitch?: string;
  paypal_email?: string;
  monetization_enabled?: boolean;
  follower_count?: number;
  following_count?: number;
  post_count?: number;
}

type LoginArgs = { mode: 'signin' | 'signup' };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (args?: LoginArgs) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isProcessingAuth = useRef(false);
  const appState = useRef(AppState.currentState);

  // Process redirect URL to extract session and authenticate
  const processRedirectUrl = useCallback(async (url: string): Promise<boolean> => {
    // Prevent duplicate processing
    if (isProcessingAuth.current) {
      console.log('Already processing auth, skipping...');
      return false;
    }
    
    try {
      console.log('Processing redirect URL:', url);
      isProcessingAuth.current = true;
      
      const parsed = Linking.parse(url);
      console.log('Parsed URL:', JSON.stringify(parsed, null, 2));
      
      // Try multiple ways to extract session_id
      let sessionId: string | null = parsed.queryParams?.session_id as string || null;
      
      // Check hash fragment
      if (!sessionId && url.includes('#session_id=')) {
        sessionId = url.split('#session_id=')[1]?.split('&')[0] || null;
      }
      
      // Check URL hash params
      if (!sessionId && url.includes('#')) {
        const hashPart = url.split('#')[1];
        if (hashPart) {
          const hashParams = new URLSearchParams(hashPart);
          sessionId = hashParams.get('session_id');
        }
      }
      
      // Check URL search params
      if (!sessionId && url.includes('?')) {
        try {
          const urlObj = new URL(url);
          sessionId = urlObj.searchParams.get('session_id');
        } catch (e) {
          // URL parsing failed, try regex
          const match = url.match(/[?&]session_id=([^&#]+)/);
          sessionId = match ? match[1] : null;
        }
      }

      console.log('Extracted session_id:', sessionId ? sessionId.substring(0, 10) + '...' : 'null');

      if (sessionId) {
        console.log('Calling API to create session...');
        const response = await api.createSession(sessionId);
        console.log('Session created successfully, response:', JSON.stringify(response));
        const { session_token, ...userData } = response;
        
        // Store token FIRST
        await AsyncStorage.setItem('session_token', session_token);
        setAuthToken(session_token);
        
        // Then set user state - this will trigger navigation
        console.log('Setting user state:', userData.email);
        setUser(userData);
        
        // Set user in Sentry for error tracking
        setSentryUser({ id: userData.user_id, email: userData.email, username: userData.name });
        addBreadcrumb('User logged in', 'auth', { userId: userData.user_id });
        
        console.log('Login successful for user:', userData.email);
        
        // Connect socket
        try {
          await socketService.connect(userData.user_id);
        } catch (error) {
          console.error('Socket connection failed:', error);
        }
        
        return true;
      } else {
        console.warn('No session_id found in redirect URL');
        return false;
      }
    } catch (error) {
      console.error('Process redirect error:', error);
      // Clear any partial state
      await AsyncStorage.removeItem('session_token');
      setAuthToken(null);
      return false;
    } finally {
      isProcessingAuth.current = false;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        setAuthToken(token);
        const userData = await api.getMe();
        setUser(userData);
        
        // Set user in Sentry for error tracking
        setSentryUser({ id: userData.user_id, email: userData.email, username: userData.name });
        
        // Connect socket
        try {
          await socketService.connect(userData.user_id);
        } catch (error) {
          console.error('Socket connection failed:', error);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await AsyncStorage.removeItem('session_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (args?: LoginArgs) => {
    const mode = args?.mode || 'signin';
    
    try {
      let redirectUrl = '';
      
      if (Platform.OS === 'web') {
        // Use window.location.origin directly for proper deployment across all environments
        redirectUrl = window.location.origin + '/';
      } else {
        // For native apps (iOS/Android), use simple scheme URL
        // Android requires the scheme to match exactly what's in app.json intentFilters
        redirectUrl = 'grover://auth-callback';
      }

      if (!redirectUrl) {
        console.error('Unable to determine redirect URL');
        throw new Error('Unable to determine redirect URL');
      }

      console.log('Login - Platform:', Platform.OS, 'Mode:', mode, 'Redirect URL:', redirectUrl);
      // Include mode in auth URL for Emergent Auth to differentiate sign up vs sign in
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}&mode=${mode}`;
      console.log('Login - Auth URL:', authUrl);

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          window.location.href = authUrl;
        }
      } else {
        // Use WebBrowser.openAuthSessionAsync for mobile
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl, 
          redirectUrl,
          {
            showInRecents: true,
            preferEphemeralSession: false,
          }
        );
        console.log('Login - WebBrowser result type:', result.type);
        
        if (result.type === 'success' && result.url) {
          console.log('Auth success - processing URL:', result.url);
          await processRedirectUrl(result.url);
        } else if (result.type === 'dismiss' || result.type === 'cancel') {
          console.log('Auth dismissed/cancelled by user');
          // User cancelled, don't do anything
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Handle app state changes - check for auth when app comes to foreground
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const handleAppStateChange = async (nextAppState: string) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App came to foreground, checking for pending auth...');
        // Check if we have a pending auth URL
        const url = await Linking.getInitialURL();
        if (url && url.includes('session_id') && !user) {
          console.log('Found pending auth URL on foreground:', url);
          await processRedirectUrl(url);
        }
      }
      appState.current = nextAppState as any;
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user, processRedirectUrl]);

  // Handle web redirect on mount
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      
      if (hash.includes('session_id=') || search.includes('session_id=')) {
        const url = window.location.href;
        processRedirectUrl(url).then(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
      }
    }
  }, [processRedirectUrl]);

  // Handle deep link on mobile - this is critical for development build auth
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const handleUrl = async (event: { url: string }) => {
      console.log('Deep link received:', event.url);
      // Check for session_id in the URL (could be in query params or hash)
      if (event.url.includes('session_id') || event.url.includes('auth-callback')) {
        await processRedirectUrl(event.url);
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', handleUrl);

    // Check for initial URL (when app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL found:', url);
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [processRedirectUrl]);

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      setAuthToken(null);
      setUser(null);
      socketService.disconnect();
      
      // Clear Sentry user context
      setSentryUser(null);
      addBreadcrumb('User logged out', 'auth');
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
