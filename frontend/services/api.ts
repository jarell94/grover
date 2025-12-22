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

const REQUEST_TIMEOUT = 30000; // 30 seconds

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  initializeUrls(); // Ensure URLs are initialized
  
  const headers: any = {};
  
  // Only set Content-Type if body is not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add custom headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const url = `${API_URL}${endpoint}`;
  
  // Only log in development
  if (__DEV__) {
    console.log('API Request:', { url, method: options.method || 'GET' });
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (__DEV__) {
      console.log('API Response:', { url, status: response.status, ok: response.ok });
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return null;
    
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Handle timeout
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please check your connection.');
    }
    
    // Handle network errors
    if (error.message === 'Network request failed') {
      throw new Error('Network error. Please check your connection.');
    }
    
    if (__DEV__) {
      console.error('API Request Failed:', { url, error: error.message });
    }
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
  
  if (__DEV__) {
    console.log('API Form Request:', { url });
  }

  // Create abort controller for timeout (longer for file uploads)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Upload timeout. Please try again.');
    }
    
    if (__DEV__) {
      console.error('API Form Request Failed:', { url, error: error.message });
    }
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
  getPostsByUser: (userId: string, limit = 18, skip = 0) => apiRequest(`/posts?user_id=${userId}&limit=${limit}&skip=${skip}`),
  getPostsByUserMedia: (userId: string, mediaType: string, limit = 18, skip = 0) => apiRequest(`/posts/media?user_id=${userId}&media_type=${mediaType}&limit=${limit}&skip=${skip}`),
  // Aliases for ProfileContentTabs component
  getUserPosts: (userId: string, limit = 18, skip = 0) => apiRequest(`/posts?user_id=${userId}&limit=${limit}&skip=${skip}`),
  getUserMedia: (userId: string, mediaType: "image" | "video" | "audio", limit = 18, skip = 0) => apiRequest(`/posts/media?user_id=${userId}&media_type=${mediaType}&limit=${limit}&skip=${skip}`),
  updateProfile: (data: any) => apiRequest('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  followUser: (userId: string) => apiRequest(`/users/${userId}/follow`, { method: 'POST' }),

  // Posts
  getPosts: (limit = 20, skip = 0) => apiRequest(`/posts?limit=${limit}&skip=${skip}`),
  getMyPosts: (limit = 50, skip = 0) => apiRequest(`/posts/me?limit=${limit}&skip=${skip}`),
  getPostById: (postId: string) => apiRequest(`/posts/${postId}`),
  getFeed: (limit = 20, skip = 0) => apiRequest(`/posts/feed?limit=${limit}&skip=${skip}`),
  getExplore: (limit = 20, skip = 0) => apiRequest(`/posts/explore?limit=${limit}&skip=${skip}`),
  createPost: (formData: FormData) => apiFormRequest('/posts', formData),
  likePost: (postId: string) => apiRequest(`/posts/${postId}/like`, { method: 'POST' }),
  deletePost: (postId: string) => apiRequest(`/posts/${postId}`, { method: 'DELETE' }),
  updatePost: (postId: string, data: { content: string }) => apiRequest(`/posts/${postId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Products
  getProducts: () => apiRequest('/products'),
  getMyProducts: (limit = 50, skip = 0) => apiRequest(`/products/me?limit=${limit}&skip=${skip}`),
  getProductById: (productId: string) => apiRequest(`/products/${productId}`),
  createProduct: (formData: FormData) => apiFormRequest('/products', formData),
  deleteProduct: (productId: string) => apiRequest(`/products/${productId}`, { method: 'DELETE' }),
  updateProduct: (productId: string, data: { name: string; description: string; price: number }) => apiRequest(`/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Orders
  createPaypalCheckout: (productId: string) => apiRequest('/payments/paypal/create', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  }),
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
  getNotifications: (limit = 50, skip = 0, unreadOnly = false) => 
    apiRequest(`/notifications?limit=${limit}&skip=${skip}&unread_only=${unreadOnly}`),
  markNotificationsRead: () => apiRequest('/notifications/mark-read', { method: 'POST' }),
  markNotificationRead: (notificationId: string) => apiRequest(`/notifications/${notificationId}/read`, { method: 'POST' }),

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

  // Repost
  repostPost: (postId: string, repostComment?: string) => apiRequest(`/posts/${postId}/repost`, {
    method: 'POST',
    body: JSON.stringify({ repost_comment: repostComment }),
  }),
  unrepostPost: (postId: string) => apiRequest(`/posts/${postId}/unrepost`, { method: 'DELETE' }),
  getReposts: (postId: string) => apiRequest(`/posts/${postId}/reposts`),

  // Notification Settings
  getNotificationSettings: () => apiRequest('/users/me/notification-settings'),
  updateNotificationSettings: (settings: any) => apiRequest('/users/me/notification-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  }),

  // Stories
  createStory: (formData: FormData) => apiRequest('/stories', { method: 'POST', body: formData }),
  getStories: () => apiRequest('/stories'),
  viewStory: (storyId: string) => apiRequest(`/stories/${storyId}/view`, { method: 'POST' }),
  getStoryViewers: (storyId: string) => apiRequest(`/stories/${storyId}/viewers`),
  reactToStory: (storyId: string, reaction: string) => apiRequest(`/stories/${storyId}/react`, {
    method: 'POST',
    body: JSON.stringify({ reaction }),
  }),
  replyToStory: (storyId: string, message: string) => apiRequest(`/stories/${storyId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  }),
  highlightStory: (storyId: string, title: string) => apiRequest(`/stories/${storyId}/highlight`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),
  deleteStory: (storyId: string) => apiRequest(`/stories/${storyId}`, { method: 'DELETE' }),
  getUserHighlights: (userId: string) => apiRequest(`/users/${userId}/highlights`),

  // Polls
  voteOnPoll: (postId: string, optionIndex: number) => apiRequest(`/posts/${postId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ option_index: optionIndex }),
  }),
  getPollResults: (postId: string) => apiRequest(`/posts/${postId}/poll-results`),

  // Live Streaming
  startStream: (data: any) => apiRequest('/streams/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  endStream: (streamId: string) => apiRequest(`/streams/${streamId}/end`, { method: 'POST' }),
  getStreamJoinInfo: (streamId: string) => apiRequest(`/streams/${streamId}/join-info`),
  scheduleStream: (data: any) => apiRequest('/streams/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getLiveStreams: () => apiRequest('/streams/live'),
  getStream: (streamId: string) => apiRequest(`/streams/${streamId}`),
  getAgoraConfig: () => apiRequest('/streams/agora-config'),
  getStreamToken: (channelName: string, role: string = 'subscriber') => {
    const formData = new FormData();
    formData.append('channel_name', channelName);
    formData.append('role', role);
    return apiFormRequest('/streams/token', formData);
  },
  sendSuperChat: (streamId: string, amount: number, message: string) => apiRequest(`/streams/${streamId}/super-chat`, {
    method: 'POST',
    body: JSON.stringify({ amount, message }),
  }),
  joinStream: (streamId: string) => apiRequest(`/streams/${streamId}/join`, { method: 'POST' }),
  leaveStream: (streamId: string) => apiRequest(`/streams/${streamId}/leave`, { method: 'POST' }),
  
  // Stream interactions
  sendStreamChat: (streamId: string, data: { text: string }) => apiRequest(`/streams/${streamId}/chat`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  likeStream: (streamId: string) => apiRequest(`/streams/${streamId}/like`, { method: 'POST' }),
  sendStreamGift: (streamId: string, data: { giftId: string }) => apiRequest(`/streams/${streamId}/gift`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  sendStreamSuperChat: (streamId: string, data: { amount: number; message: string }) => apiRequest(`/streams/${streamId}/superchat`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // Media Service Status
  getMediaStatus: () => apiRequest('/media/status'),

  // Discovery & For You
  getForYouFeed: () => apiRequest('/discover/for-you'),
  getTrending: () => apiRequest('/discover/trending'),
  getSuggestedUsers: () => apiRequest('/discover/suggested-users'),
  getCategories: () => apiRequest('/categories'),
  getCategoryPosts: (categoryId: string) => apiRequest(`/categories/${categoryId}/posts`),

  // Analytics
  getAnalyticsOverview: () => apiRequest('/analytics/overview'),
  getContentPerformance: () => apiRequest('/analytics/content-performance'),

  // Tips
  sendTip: (userId: string, amount: number, message: string) => apiRequest(`/users/${userId}/tip`, {
    method: 'POST',
    body: JSON.stringify({ amount, message }),
  }),
  getTopSupporters: (userId: string) => apiRequest(`/users/${userId}/tips/leaderboard`),

  // Scheduled Posts
  schedulePost: (formData: FormData) => apiRequest('/posts/schedule', { method: 'POST', body: formData }),
  getScheduledPosts: () => apiRequest('/posts/scheduled'),
  deleteScheduledPost: (scheduledPostId: string) => apiRequest(`/posts/scheduled/${scheduledPostId}`, { method: 'DELETE' }),

  // Communities
  createCommunity: (formData: FormData) => apiRequest('/communities/create', { method: 'POST', body: formData }),
  getCommunity: (communityId: string) => apiRequest(`/communities/${communityId}`),
  joinCommunity: (communityId: string) => apiRequest(`/communities/${communityId}/join`, { method: 'POST' }),
  createCommunityPost: (communityId: string, formData: FormData) => apiRequest(`/communities/${communityId}/posts`, { method: 'POST', body: formData }),
  getCommunityPosts: (communityId: string) => apiRequest(`/communities/${communityId}/posts`),
  discoverCommunities: () => apiRequest('/communities/discover'),

  // Groups
  createGroup: (formData: FormData) => apiRequest('/groups/create', { method: 'POST', body: formData }),
  getGroup: (groupId: string) => apiRequest(`/groups/${groupId}`),
  sendGroupMessage: (groupId: string, content: string) => apiRequest(`/groups/${groupId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }),
  getGroupMessages: (groupId: string) => apiRequest(`/groups/${groupId}/messages`),

  // Calls
  initiateCall: (receiverId: string, callType: string) => apiRequest('/calls/initiate', {
    method: 'POST',
    body: JSON.stringify({ receiver_id: receiverId, call_type: callType }),
  }),
  answerCall: (callId: string) => apiRequest(`/calls/${callId}/answer`, { method: 'POST' }),
  endCall: (callId: string) => apiRequest(`/calls/${callId}/end`, { method: 'POST' }),
  getCallHistory: () => apiRequest('/calls/history'),

  // Collections
  createCollection: (data: any) => apiRequest('/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getCollections: () => apiRequest('/collections'),
  getCollectionDetail: (collectionId: string) => apiRequest(`/collections/${collectionId}`),
  updateCollection: (collectionId: string, data: any) => apiRequest(`/collections/${collectionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteCollection: (collectionId: string) => apiRequest(`/collections/${collectionId}`, { method: 'DELETE' }),
  addPostToCollection: (collectionId: string, postId: string) => apiRequest(`/collections/${collectionId}/posts/${postId}`, { method: 'POST' }),
  removePostFromCollection: (collectionId: string, postId: string) => apiRequest(`/collections/${collectionId}/posts/${postId}`, { method: 'DELETE' }),

  // Community Discovery
  getDiscoverCommunities: () => apiRequest('/communities/discover'),
  getCommunityDetail: (communityId: string) => apiRequest(`/communities/${communityId}`),

  // Discount Codes
  createDiscountCode: (data: { code: string; percent: number; expiry?: string }) => apiRequest('/discounts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getDiscountCodes: () => apiRequest('/discounts'),
  validateDiscountCode: (code: string) => apiRequest(`/discounts/validate/${code}`),
  deleteDiscountCode: (code: string) => apiRequest(`/discounts/${code}`, { method: 'DELETE' }),

  // Mentions
  getMentions: () => apiRequest('/mentions'),

  // Unlike Post (toggle like off)
  unlikePost: (postId: string) => apiRequest(`/posts/${postId}/like`, { method: 'DELETE' }),
};