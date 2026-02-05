/**
 * Type definitions for API service
 * Provides type safety for all API requests and responses
 */

// ============ Request Types ============

export interface ApiHeaders {
  'Content-Type'?: string;
  Authorization?: string;
  [key: string]: string | undefined;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: ApiHeaders;
}

// ============ User Types ============

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  bio?: string;
  is_premium: boolean;
  is_private: boolean;
  monetization_enabled?: boolean;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
}

export interface UserStats {
  followers: number;
  following: number;
  posts: number;
  likes_received: number;
}

// ============ Auth Types ============

export interface SessionResponse {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  session_token: string;
}

// ============ Post Types ============

export interface Post {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: 'image' | 'video' | 'audio';
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked?: boolean;
  disliked?: boolean;
  saved?: boolean;
  user?: User;
}

export interface CreatePostData {
  content: string;
  media?: File | Blob;
  tagged_users?: string;
  location?: string;
}

// ============ Comment Types ============

export interface Comment {
  comment_id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  parent_id?: string;
  user?: User;
}

// ============ Message Types ============

export interface Message {
  message_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'gif';
  read: boolean;
  created_at: string;
  media_url?: string;
}

export interface Conversation {
  conversation_id: string;
  participants: string[];
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

// ============ Notification Types ============

export interface Notification {
  notification_id: string;
  user_id: string;
  type: 'follow' | 'like' | 'comment' | 'message' | 'mention' | 'sale';
  content: string;
  read: boolean;
  created_at: string;
  related_id?: string;
}

// ============ Product Types ============

export interface Product {
  product_id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  product_type: 'physical' | 'digital' | 'service';
  created_at: string;
}

// ============ Stream Types ============

export interface StreamInfo {
  stream_id: string;
  user_id: string;
  title: string;
  description: string;
  channel_name: string;
  status: 'live' | 'ended';
  viewer_count: number;
  started_at: string;
}

export interface StreamTokenResponse {
  token: string;
  channel: string;
  uid: number;
  app_id: string;
}

// ============ Pagination Types ============

export interface PaginationParams {
  skip?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  skip: number;
  limit: number;
  hasMore?: boolean;
}

// ============ Error Types ============

export interface ApiError {
  detail: string;
  status: number;
}

// ============ Response Types ============

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  message?: string;
}

export interface SuccessResponse {
  message: string;
  [key: string]: any;
}
