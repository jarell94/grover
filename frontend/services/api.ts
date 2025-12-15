import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL from environment
const getBackendUrl = () => {
  // Try to get from process.env first (works in web)
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  
  // Try Constants (works in native)
  if (Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL) {
    return Constants.expoConfig.extra.EXPO_PUBLIC_BACKEND_URL;
  }
  
  // Fallback based on platform
  if (Platform.OS === 'web') {
    // For web, use the current origin
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }
  
  // For native, this should be set in .env
  return '';
};

const BACKEND_URL = getBackendUrl();
export const API_URL = `${BACKEND_URL}/api`;

console.log('API Configuration:', { BACKEND_URL, API_URL });

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const headers: any = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const url = `${API_URL}${endpoint}`;
  console.log('API Request:', { url, method: options.method || 'GET' });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('API Response:', { url, status: response.status, ok: response.ok });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Error:', { url, status: response.status, error });
      throw new Error(error || `Request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Request Failed:', { url, error });
    throw error;
  }
};

const apiFormRequest = async (endpoint: string, formData: FormData) => {
  const headers: any = {};

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Request failed');
  }

  return response.json();
};

export const api = {
  // Auth
  createSession: (sessionId: string) => apiRequest(`/auth/session?session_id=${sessionId}`),
  getMe: () => apiRequest('/auth/me'),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),

  // Users
  getUser: (userId: string) => apiRequest(`/users/${userId}`),
  getUserStats: (userId: string) => apiRequest(`/users/${userId}/stats`),
  updateProfile: (data: any) => apiRequest('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  followUser: (userId: string) => apiRequest(`/users/${userId}/follow`, { method: 'POST' }),

  // Posts
  getPosts: () => apiRequest('/posts'),
  getFeed: () => apiRequest('/posts/feed'),
  getExplore: () => apiRequest('/posts/explore'),
  createPost: (formData: FormData) => apiFormRequest('/posts', formData),
  likePost: (postId: string) => apiRequest(`/posts/${postId}/like`, { method: 'POST' }),
  deletePost: (postId: string) => apiRequest(`/posts/${postId}`, { method: 'DELETE' }),

  // Products
  getProducts: () => apiRequest('/products'),
  getMyProducts: () => apiRequest('/products/my-products'),
  createProduct: (formData: FormData) => apiFormRequest('/products', formData),
  deleteProduct: (productId: string) => apiRequest(`/products/${productId}`, { method: 'DELETE' }),

  // Orders
  createOrder: (productId: string, paypalOrderId: string) => apiRequest('/orders', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, paypal_order_id: paypalOrderId }),
  }),
  getMyOrders: () => apiRequest('/orders/my-orders'),

  // Messages
  getConversations: () => apiRequest('/messages/conversations'),
  getMessages: (userId: string) => apiRequest(`/messages/${userId}`),

  // Analytics
  getRevenue: () => apiRequest('/analytics/revenue'),
  getEngagement: () => apiRequest('/analytics/engagement'),

  // Notifications
  getNotifications: () => apiRequest('/notifications'),
  markNotificationsRead: () => apiRequest('/notifications/mark-read', { method: 'POST' }),

  // Premium
  subscribePremium: () => apiRequest('/premium/subscribe', { method: 'POST' }),
  cancelPremium: () => apiRequest('/premium/cancel', { method: 'POST' }),

  // Search
  search: (query: string) => apiRequest(`/search?q=${encodeURIComponent(query)}`),
};