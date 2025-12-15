import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get backend URL from environment
const getBackendUrl = () => {
  // For web, use the current origin (same domain)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // Try to get from process.env (works in web build)
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    const url = process.env.EXPO_PUBLIC_BACKEND_URL;
    // Skip if it contains REPLACEME placeholder
    if (!url.includes('REPLACEME')) {
      return url;
    }
  }
  
  // Try Constants (works in native)
  if (Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL) {
    const url = Constants.expoConfig.extra.EXPO_PUBLIC_BACKEND_URL;
    if (!url.includes('REPLACEME')) {
      return url;
    }
  }
  
  // Final fallback for web
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // For native, this should be set in .env
  return '';
};

// Make this dynamic to ensure window is available
let BACKEND_URL: string;
let API_URL: string;

const initializeUrls = () => {
  if (!BACKEND_URL) {
    BACKEND_URL = getBackendUrl();
    API_URL = `${BACKEND_URL}/api`;
    console.log('API Configuration:', { BACKEND_URL, API_URL });
  }
};

export const getApiUrl = () => {
  initializeUrls();
  return API_URL;
};

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  initializeUrls(); // Ensure URLs are initialized
  
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
  initializeUrls(); // Ensure URLs are initialized
  
  const headers: any = {};

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const url = `${API_URL}${endpoint}`;
  console.log('API Form Request:', { url });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('API Form Error:', { url, status: response.status, error });
      throw new Error(error || `Request failed with status ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('API Form Request Failed:', { url, error });
    throw error;
  }
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

  // Post interactions
  dislikePost: (postId: string) => apiRequest(`/posts/${postId}/dislike`, { method: 'POST' }),
  savePost: (postId: string) => apiRequest(`/posts/${postId}/save`, { method: 'POST' }),
  sharePost: (postId: string) => apiRequest(`/posts/${postId}/share`, { method: 'POST' }),
  getSavedPosts: () => apiRequest('/posts/saved'),

  // PayPal
  createPayPalPayment: (productId: string) => apiRequest('/paypal/create-payment', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  }),
  executePayPalPayment: (paymentId: string, payerId: string, productId: string) => apiRequest('/paypal/execute-payment', {
    method: 'POST',
    body: JSON.stringify({ payment_id: paymentId, payer_id: payerId, product_id: productId }),
  }),

  // Comments
  getComments: (postId: string) => apiRequest(`/posts/${postId}/comments`),
  getReplies: (commentId: string) => apiRequest(`/comments/${commentId}/replies`),
  createComment: (postId: string, content: string, parentCommentId?: string) => apiRequest(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content, parent_comment_id: parentCommentId }),
  }),
  likeComment: (commentId: string) => apiRequest(`/comments/${commentId}/like`, { method: 'POST' }),
  deleteComment: (commentId: string) => apiRequest(`/comments/${commentId}`, { method: 'DELETE' }),
};