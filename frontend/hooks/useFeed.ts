import { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { api } from '../services/api';

export interface Post {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  dislikes_count?: number;
  comments_count?: number;
  repost_count?: number;
  shares_count?: number;
  created_at: string;
  user?: any;
  liked?: boolean;
  disliked?: boolean;
  saved?: boolean;
  reposted?: boolean;
  tagged_users?: string[];
  location?: string;
  is_repost?: boolean;
  original_post_id?: string;
  repost_comment?: string;
  original_post?: Post;
}

type FetchFn = (limit: number, skip: number) => Promise<any[]>;

interface UseFeedOptions {
  pageSize?: number;
  fetchFn?: FetchFn;
}

/**
 * Reusable feed hook with pagination, optimistic updates, and CRUD operations
 */
export function useFeed(options: UseFeedOptions = {}) {
  const { pageSize = 20, fetchFn = api.getFeed } = options;
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  // Use ref to avoid stale closures in callbacks
  const skipRef = useRef(0);

  /**
   * Load feed with optional refresh
   */
  const loadFeed = useCallback(async (isRefresh = false) => {
    const skip = isRefresh ? 0 : skipRef.current;
    
    try {
      const data = await fetchFn(pageSize, skip);
      const newPosts = Array.isArray(data) ? data : [];
      
      setPosts((prev) => isRefresh ? newPosts : [...prev, ...newPosts]);
      skipRef.current = isRefresh ? pageSize : skipRef.current + pageSize;
      setHasMore(newPosts.length === pageSize);
    } catch (error) {
      if (__DEV__) console.error('Feed load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [fetchFn, pageSize]);

  /**
   * Refresh feed (pull-to-refresh)
   */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    skipRef.current = 0;
    await loadFeed(true);
  }, [loadFeed]);

  /**
   * Load more posts (infinite scroll)
   */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadFeed(false);
  }, [loadingMore, hasMore, loadFeed]);

  /**
   * Reset feed state
   */
  const reset = useCallback(() => {
    setPosts([]);
    skipRef.current = 0;
    setHasMore(true);
    setLoading(true);
  }, []);

  // ==================== Optimistic Update Helpers ====================

  /**
   * Update a single post by ID with functional update
   */
  const updatePost = useCallback((postId: string, updater: (post: Post) => Post) => {
    setPosts((prev) => prev.map((p) => (p.post_id === postId ? updater(p) : p)));
  }, []);

  /**
   * Remove a post by ID
   */
  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.post_id !== postId));
  }, []);

  /**
   * Add a new post at the beginning
   */
  const prependPost = useCallback((post: Post) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  // ==================== Post Interactions ====================

  const handleLike = useCallback(async (postId: string) => {
    // Optimistic update
    updatePost(postId, (p) => ({
      ...p,
      liked: !p.liked,
      likes_count: p.likes_count + (p.liked ? -1 : 1),
    }));

    try {
      const result = await api.likePost(postId);
      // Reconcile with server
      updatePost(postId, (p) => ({
        ...p,
        liked: !!result?.liked,
        likes_count: typeof result?.likes_count === 'number' ? result.likes_count : p.likes_count,
      }));
    } catch (error) {
      // Rollback
      updatePost(postId, (p) => ({
        ...p,
        liked: !p.liked,
        likes_count: p.likes_count + (p.liked ? -1 : 1),
      }));
      if (__DEV__) console.error('Like error:', error);
    }
  }, [updatePost]);

  const handleDislike = useCallback(async (postId: string) => {
    updatePost(postId, (p) => ({
      ...p,
      disliked: !p.disliked,
      dislikes_count: (p.dislikes_count || 0) + (p.disliked ? -1 : 1),
    }));

    try {
      const result = await api.dislikePost(postId);
      updatePost(postId, (p) => ({
        ...p,
        disliked: !!result?.disliked,
        dislikes_count: typeof result?.dislikes_count === 'number' ? result.dislikes_count : p.dislikes_count,
      }));
    } catch (error) {
      updatePost(postId, (p) => ({
        ...p,
        disliked: !p.disliked,
        dislikes_count: (p.dislikes_count || 0) + (p.disliked ? -1 : 1),
      }));
      if (__DEV__) console.error('Dislike error:', error);
    }
  }, [updatePost]);

  const handleSave = useCallback(async (postId: string) => {
    updatePost(postId, (p) => ({ ...p, saved: !p.saved }));

    try {
      const result = await api.savePost(postId);
      updatePost(postId, (p) => ({ ...p, saved: !!result?.saved }));
    } catch (error) {
      updatePost(postId, (p) => ({ ...p, saved: !p.saved }));
      if (__DEV__) console.error('Save error:', error);
    }
  }, [updatePost]);

  const handleShare = useCallback(async (postId: string) => {
    updatePost(postId, (p) => ({ ...p, shares_count: (p.shares_count || 0) + 1 }));

    try {
      await api.sharePost(postId);
    } catch (error) {
      updatePost(postId, (p) => ({ ...p, shares_count: Math.max(0, (p.shares_count || 1) - 1) }));
      if (__DEV__) console.error('Share error:', error);
    }
  }, [updatePost]);

  const handleRepost = useCallback(async (postId: string, comment?: string) => {
    try {
      await api.repostPost(postId, comment);
      updatePost(postId, (p) => ({
        ...p,
        repost_count: (p.repost_count || 0) + 1,
        reposted: true,
      }));
      return true;
    } catch (error: any) {
      if (__DEV__) console.error('Repost error:', error);
      throw error;
    }
  }, [updatePost]);

  const handleUnrepost = useCallback(async (postId: string) => {
    try {
      await api.unrepostPost(postId);
      updatePost(postId, (p) => ({
        ...p,
        repost_count: Math.max(0, (p.repost_count || 0) - 1),
        reposted: false,
      }));
      return true;
    } catch (error) {
      if (__DEV__) console.error('Unrepost error:', error);
      throw error;
    }
  }, [updatePost]);

  const handleDelete = useCallback(async (postId: string) => {
    try {
      await api.deletePost(postId);
      removePost(postId);
      return true;
    } catch (error) {
      if (__DEV__) console.error('Delete error:', error);
      throw error;
    }
  }, [removePost]);

  const incrementCommentCount = useCallback((postId: string) => {
    updatePost(postId, (p) => ({ ...p, comments_count: (p.comments_count || 0) + 1 }));
  }, [updatePost]);

  const decrementCommentCount = useCallback((postId: string) => {
    updatePost(postId, (p) => ({ ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) }));
  }, [updatePost]);

  return {
    // State
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    
    // Actions
    loadFeed,
    refresh,
    loadMore,
    reset,
    
    // Post updates
    setPosts,
    updatePost,
    removePost,
    prependPost,
    
    // Interactions
    handleLike,
    handleDislike,
    handleSave,
    handleShare,
    handleRepost,
    handleUnrepost,
    handleDelete,
    incrementCommentCount,
    decrementCommentCount,
  };
}

// ==================== Upload Helpers ====================

interface MediaFile {
  uri: string;
  type?: string;
  name?: string;
  mimeType?: string;
}

/**
 * Build FormData for post creation using file URI (not base64)
 */
export function buildPostFormData(options: {
  content: string;
  media?: MediaFile | null;
  taggedUsers?: string;
  location?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  pollDurationHours?: number;
}): FormData {
  const formData = new FormData();
  
  formData.append('content', options.content.trim() || '');
  
  if (options.taggedUsers?.trim()) {
    formData.append('tagged_users', options.taggedUsers.trim());
  }
  
  if (options.location?.trim()) {
    formData.append('location', options.location.trim());
  }
  
  if (options.pollQuestion?.trim()) {
    formData.append('poll_question', options.pollQuestion.trim());
    if (options.pollOptions) {
      formData.append('poll_options', JSON.stringify(options.pollOptions.filter((o) => o.trim())));
    }
    if (options.pollDurationHours) {
      formData.append('poll_duration_hours', options.pollDurationHours.toString());
    }
  }
  
  if (options.media?.uri) {
    const uri = options.media.uri;
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    
    // Infer MIME type from extension
    let mimeType = options.media.mimeType || 'application/octet-stream';
    let fileName = options.media.name || `media.${fileExt}`;
    
    if (['jpg', 'jpeg'].includes(fileExt)) {
      mimeType = 'image/jpeg';
      fileName = `image.${fileExt}`;
    } else if (fileExt === 'png') {
      mimeType = 'image/png';
      fileName = 'image.png';
    } else if (fileExt === 'gif') {
      mimeType = 'image/gif';
      fileName = 'image.gif';
    } else if (['mp4', 'mov', 'm4v'].includes(fileExt)) {
      mimeType = 'video/mp4';
      fileName = 'video.mp4';
    } else if (['mp3', 'mpeg', 'm4a', 'aac'].includes(fileExt)) {
      mimeType = 'audio/mpeg';
      fileName = `audio.${fileExt}`;
    } else if (fileExt === 'wav') {
      mimeType = 'audio/wav';
      fileName = 'audio.wav';
    }
    
    formData.append('media', {
      uri,
      type: mimeType,
      name: fileName,
    } as any);
  }
  
  return formData;
}

/**
 * Build FormData for product creation using file URI
 */
export function buildProductFormData(options: {
  name: string;
  description: string;
  price: string;
  image?: MediaFile | null;
}): FormData {
  const formData = new FormData();
  
  formData.append('name', options.name);
  formData.append('description', options.description);
  formData.append('price', options.price);
  
  if (options.image?.uri) {
    const uri = options.image.uri;
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : 'image/jpeg';
    
    formData.append('image', {
      uri,
      name: `product.${fileExt}`,
      type: mimeType,
    } as any);
  }
  
  return formData;
}

/**
 * Build FormData for story creation using file URI
 */
export function buildStoryFormData(options: {
  media: MediaFile;
  caption?: string;
}): FormData {
  const formData = new FormData();
  
  if (options.caption?.trim()) {
    formData.append('caption', options.caption.trim());
  }
  
  const uri = options.media.uri;
  const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
  
  let mimeType = 'image/jpeg';
  let mediaType = 'image';
  
  if (['mp4', 'mov', 'm4v'].includes(fileExt)) {
    mimeType = 'video/mp4';
    mediaType = 'video';
  } else if (fileExt === 'png') {
    mimeType = 'image/png';
  } else if (fileExt === 'gif') {
    mimeType = 'image/gif';
  }
  
  formData.append('media', {
    uri,
    type: mimeType,
    name: `story.${fileExt}`,
  } as any);
  
  formData.append('media_type', mediaType);
  
  return formData;
}

export default useFeed;
