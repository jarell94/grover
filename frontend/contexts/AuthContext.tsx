import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { api, setAuthToken } from '../services/api';
import socketService from '../services/socket';

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

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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
  };

  const login = async (args?: LoginArgs) => {
    const mode = args?.mode || 'signin';
    
    try {
      let redirectUrl = '';
      
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
          redirectUrl = window.location.origin + '/';
        } else {
          redirectUrl = 'http://localhost:3000/';
        }
      } else {
        redirectUrl = Linking.createURL('/');
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
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        console.log('Login - WebBrowser result:', result);
        
        if (result.type === 'success' && result.url) {
          await processRedirectUrl(result.url);
        } else if (result.type === 'cancel') {
          console.log('Login cancelled by user');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const processRedirectUrl = async (url: string) => {
    try {
      const parsed = Linking.parse(url);
      const sessionId = parsed.queryParams?.session_id as string || 
                        (url.includes('#session_id=') ? url.split('#session_id=')[1].split('&')[0] : null);

      if (sessionId) {
        const response = await api.createSession(sessionId);
        const { session_token, ...userData } = response;
        
        await AsyncStorage.setItem('session_token', session_token);
        setAuthToken(session_token);
        setUser(userData);
        
        // Connect socket
        try {
          await socketService.connect(userData.user_id);
        } catch (error) {
          console.error('Socket connection failed:', error);
        }
      }
    } catch (error) {
      console.error('Process redirect error:', error);
      throw error;
    }
  };

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
  }, []);

  // Handle deep link on mobile
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const handleUrl = async (event: { url: string }) => {
        await processRedirectUrl(event.url);
      };

      const subscription = Linking.addEventListener('url', handleUrl);

      Linking.getInitialURL().then((url) => {
        if (url) {
          handleUrl({ url });
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, []);

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