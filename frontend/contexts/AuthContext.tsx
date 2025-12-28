import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform, AppState } from 'react-native';
import { api, setAuthToken } from '../services/api';
import socketService from '../services/socket';

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
  const processRedirectUrl = useCallback(async (url: string) => {
    // Prevent duplicate processing
    if (isProcessingAuth.current) {
      console.log('Already processing auth, skipping...');
      return;
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
        const { session_token, ...userData } = response;
        
        await AsyncStorage.setItem('session_token', session_token);
        setAuthToken(session_token);
        setUser(userData);
        
        console.log('Login successful for user:', userData.email);
        
        // Connect socket
        try {
          await socketService.connect(userData.user_id);
        } catch (error) {
          console.error('Socket connection failed:', error);
        }
      } else {
        console.warn('No session_id found in redirect URL');
      }
    } catch (error) {
      console.error('Process redirect error:', error);
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
        // Use window.location.origin directly - NO fallbacks for proper deployment
        if (typeof window !== 'undefined' && window.location?.origin) {
          redirectUrl = window.location.origin + '/';
        }
        // Note: No fallback - this ensures auth works correctly across all environments
      } else {
        // Use makeRedirectUri for proper Expo Go handling
        // This handles tunnel URLs, development builds, and production correctly
        redirectUrl = makeRedirectUri({
          scheme: 'frontend',
          path: '/',
        });
      }

      if (!redirectUrl) {
        console.error('Unable to determine redirect URL - window.location.origin may be unavailable');
        throw new Error('Unable to determine redirect URL');
      }

      console.log('Login - Mode:', mode, 'Redirect URL:', redirectUrl);
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
            preferEphemeralSession: false, // Allow session cookies
          }
        );
        console.log('Login - WebBrowser result:', JSON.stringify(result));
        
        if (result.type === 'success' && result.url) {
          console.log('Auth success - processing URL:', result.url);
          await processRedirectUrl(result.url);
        } else if (result.type === 'cancel') {
          console.log('Login cancelled by user');
        } else if (result.type === 'dismiss') {
          // Browser was dismissed - this can happen in Expo Go
          // The URL might have been sent to the app via deep link
          console.log('Browser dismissed, checking for pending auth...');
          
          // Small delay to allow the deep link to be processed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const pendingUrl = await Linking.getInitialURL();
          console.log('Pending URL after dismiss:', pendingUrl);
          if (pendingUrl && pendingUrl.includes('session_id')) {
            await processRedirectUrl(pendingUrl);
          }
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

  // Handle deep link on mobile - this is critical for Expo Go auth
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const handleUrl = async (event: { url: string }) => {
      console.log('Deep link received:', event.url);
      if (event.url.includes('session_id')) {
        await processRedirectUrl(event.url);
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', handleUrl);

    // Check for initial URL (when app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL found:', url);
        if (url.includes('session_id')) {
          handleUrl({ url });
        }
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