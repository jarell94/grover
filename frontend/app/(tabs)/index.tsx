import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../services/api';
import { pickMedia as pickMediaUtil } from '../../utils/mediaPicker';
import { buildPostFormData } from '../../utils/formData';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import MediaDisplay from '../../components/MediaDisplay';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Post {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  dislikes_count?: number;
  comments_count?: number;
  repost_count?: number;
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
  has_poll?: boolean;
  poll_question?: string;
  poll_options?: string[];
  poll_votes?: { [key: string]: number };
  poll_expires_at?: string;
}

// Estimated item heights for FlashList
const ESTIMATED_POST_HEIGHT = 400;
const ESTIMATED_POST_WITH_MEDIA_HEIGHT = 550;

// Memoized Post Component for optimal performance
const PostCard = memo(({ 
  item, 
  isVisible,
  onLike,
  onDislike,
  onSave,
  onShare,
  onComment,
  onRepost,
  onVotePoll,
  nextVideoUri,
}: {
  item: Post;
  isVisible: boolean;
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (id: string) => void;
  onComment: (post: Post) => void;
  onRepost: (post: Post) => void;
  onVotePoll: (postId: string, optionIndex: number) => void;
  nextVideoUri?: string;
}) => {
  const displayPost = item.is_repost && item.original_post ? item.original_post : item;
  
  return (
    <View style={styles.postCard}>
      {item.is_repost && item.original_post && (
        <View style={styles.repostHeader}>
          <Ionicons name="repeat" size={16} color={Colors.primary} />
          <Text style={styles.repostText}>
            {item.user?.name || 'Unknown'} reposted
          </Text>
        </View>
      )}

      <View style={styles.postHeader}>
        <Image
          source={{ uri: displayPost.user?.picture || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.postHeaderText}>
          <Text style={styles.username}>{displayPost.user?.name || 'Unknown'}</Text>
          <Text style={styles.timestamp}>
            {new Date(displayPost.created_at).toLocaleDateString()}
          </Text>
        </View>
        {displayPost.user?.is_premium && (
          <Ionicons name="star" size={20} color={Colors.accent} />
        )}
      </View>

      {item.repost_comment && (
        <View style={styles.repostCommentBox}>
          <Text style={styles.repostCommentText}>{item.repost_comment}</Text>
        </View>
      )}

      <Text style={styles.postContent}>{item.content}</Text>

      {item.location && (
        <View style={styles.postMeta}>
          <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.postMetaText}>{item.location}</Text>
        </View>
      )}

      {item.tagged_users && item.tagged_users.length > 0 && (
        <View style={styles.postMeta}>
          <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.postMetaText}>
            Tagged {item.tagged_users.length} user{item.tagged_users.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <MediaDisplay
        mediaUrl={item.media_url}
        mediaType={item.media_type}
        title={item.content}
        isVisible={isVisible}
        onDoubleTapLike={() => onLike(item.post_id)}
        preloadUri={nextVideoUri}
      />

      {/* Poll Display */}
      {item.has_poll && item.poll_options && (
        <View style={styles.pollContainer}>
          <Text style={styles.pollQuestion}>{item.poll_question}</Text>
          {item.poll_options.map((option, index) => {
            const votes = item.poll_votes?.[index.toString()] || 0;
            const totalVotes = Object.values(item.poll_votes || {}).reduce((a: any, b: any) => a + b, 0);
            const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
            
            return (
              <TouchableOpacity
                key={index}
                style={styles.pollOption}
                onPress={() => onVotePoll(item.post_id, index)}
              >
                <View style={styles.pollOptionContent}>
                  <View style={[styles.pollBar, { width: `${percentage}%` }]} />
                  <Text style={styles.pollOptionText}>{option}</Text>
                  <Text style={styles.pollPercentage}>{percentage.toFixed(0)}%</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollVoteCount}>
            {Object.values(item.poll_votes || {}).reduce((a: any, b: any) => a + b, 0)} votes
            {item.poll_expires_at && ` • Ends ${new Date(item.poll_expires_at).toLocaleDateString()}`}
          </Text>
        </View>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => onLike(item.post_id)}>
          <Ionicons
            name={item.liked ? 'heart' : 'heart-outline'}
            size={24}
            color={item.liked ? Colors.error : Colors.textSecondary}
          />
          <Text style={[styles.actionText, item.liked && { color: Colors.error }]}>
            {item.likes_count}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onDislike(item.post_id)}>
          <Ionicons
            name={item.disliked ? 'heart-dislike' : 'heart-dislike-outline'}
            size={24}
            color={item.disliked ? Colors.secondary : Colors.textSecondary}
          />
          <Text style={[styles.actionText, item.disliked && { color: Colors.secondary }]}>
            {item.dislikes_count || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onComment(item)}>
          <Ionicons name="chatbubble-outline" size={24} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.comments_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onRepost(item)}>
          <Ionicons
            name={item.reposted ? 'repeat' : 'repeat-outline'}
            size={24}
            color={item.reposted ? Colors.primary : Colors.textSecondary}
          />
          {(item.repost_count ?? 0) > 0 && (
            <Text style={[styles.actionText, item.reposted && { color: Colors.primary }]}>
              {item.repost_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onShare(item.post_id)}>
          <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onSave(item.post_id)}>
          <Ionicons
            name={item.saved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={item.saved ? Colors.accent : Colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.item.post_id === nextProps.item.post_id &&
    prevProps.item.liked === nextProps.item.liked &&
    prevProps.item.disliked === nextProps.item.disliked &&
    prevProps.item.saved === nextProps.item.saved &&
    prevProps.item.likes_count === nextProps.item.likes_count &&
    prevProps.item.dislikes_count === nextProps.item.dislikes_count &&
    prevProps.item.comments_count === nextProps.item.comments_count &&
    prevProps.item.repost_count === nextProps.item.repost_count &&
    prevProps.item.reposted === nextProps.item.reposted &&
    prevProps.isVisible === nextProps.isVisible
  );
});

// Memoized Story Item
const StoryItem = memo(({ userStory, index, stories, isCreateButton }: any) => {
  if (isCreateButton) {
    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => router.push('/create-story')}
      >
        <View style={styles.createStoryRing}>
          <Ionicons name="add" size={28} color={Colors.primary} />
        </View>
        <Text style={styles.storyUsername}>Your Story</Text>
      </TouchableOpacity>
    );
  }

  const hasUnviewed = userStory.stories.some((s: any) => !s.viewed);
  
  return (
    <TouchableOpacity
      style={styles.storyItem}
      onPress={() => {
        router.push({
          pathname: '/stories',
          params: {
            stories: JSON.stringify(stories),
            initialIndex: index.toString(),
          },
        });
      }}
    >
      <View style={[styles.storyRing, hasUnviewed && styles.storyRingUnviewed]}>
        <Image
          source={{ uri: userStory.user.picture || 'https://via.placeholder.com/60' }}
          style={styles.storyAvatar}
        />
      </View>
      <Text style={styles.storyUsername} numberOfLines={1}>
        {userStory.user.name}
      </Text>
    </TouchableOpacity>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [stories, setStories] = useState<any[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [taggedUsers, setTaggedUsers] = useState('');
  const [location, setLocation] = useState('');
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [repostModalVisible, setRepostModalVisible] = useState(false);
  const [repostComment, setRepostComment] = useState('');
  const [selectedRepostPost, setSelectedRepostPost] = useState<Post | null>(null);
  const [showPollOption, setShowPollOption] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDuration, setPollDuration] = useState(24);
  
  // Track visible video posts for auto-play
  const [visiblePostIds, setVisiblePostIds] = useState<string[]>([]);
  
  // Refs for pagination and list
  const skipRef = useRef(0);
  const listRef = useRef<FlashList<Post>>(null);
  const pageSize = 20;

  // Memoized visible posts set for quick lookup
  const visiblePostsSet = useMemo(() => new Set(visiblePostIds), [visiblePostIds]);

  // Helper to update a single post - optimized
  const updatePost = useCallback((postId: string, updater: (p: Post) => Post) => {
    setPosts(prev => {
      const index = prev.findIndex(p => p.post_id === postId);
      if (index === -1) return prev;
      const newPosts = [...prev];
      newPosts[index] = updater(newPosts[index]);
      return newPosts;
    });
  }, []);

  // Load feed with proper state management
  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      skipRef.current = 0;
    } else if (skipRef.current === 0) {
      setLoading(true);
    } else {
      if (loadingMore) return; // Prevent duplicate calls
      setLoadingMore(true);
    }

    try {
      const [feedData, storiesData] = await Promise.all([
        api.getFeed(pageSize, isRefresh ? 0 : skipRef.current),
        isRefresh ? api.getStories().catch(() => []) : Promise.resolve(null),
      ]);

      const newPosts = feedData as Post[];
      
      if (isRefresh) {
        // Direct replacement for refresh - no animation jump
        setPosts(newPosts);
        skipRef.current = newPosts.length;
      } else {
        // Append for load more
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.post_id));
          const uniqueNewPosts = newPosts.filter(p => !existingIds.has(p.post_id));
          return [...prev, ...uniqueNewPosts];
        });
        skipRef.current += newPosts.length;
      }
      
      setHasMore(newPosts.length === pageSize);
      if (isRefresh && storiesData) setStories(storiesData);
    } catch (error) {
      console.error('Feed load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // Refresh feed when screen comes into focus (only on first mount)
  useFocusEffect(
    useCallback(() => {
      if (posts.length === 0) {
        loadFeed(true);
      }
    }, [])
  );

  const handleRefresh = useCallback(() => {
    loadFeed(true);
  }, [loadFeed]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !refreshing) {
      loadFeed(false);
    }
  }, [loadingMore, hasMore, refreshing, loadFeed]);

  // Optimistic updates for interactions
  const handleLike = useCallback(async (postId: string) => {
    updatePost(postId, (p) => ({
      ...p,
      liked: !p.liked,
      disliked: p.liked ? p.disliked : false,
      likes_count: p.likes_count + (p.liked ? -1 : 1),
      dislikes_count: !p.liked && p.disliked ? (p.dislikes_count || 0) - 1 : p.dislikes_count,
    }));

    try {
      const result = await api.likePost(postId);
      updatePost(postId, (p) => ({
        ...p,
        liked: !!result?.liked,
        disliked: typeof result?.disliked === 'boolean' ? result.disliked : p.disliked,
        likes_count: typeof result?.likes_count === 'number' ? result.likes_count : p.likes_count,
        dislikes_count: typeof result?.dislikes_count === 'number' ? result.dislikes_count : p.dislikes_count,
      }));
    } catch (error) {
      // Rollback
      updatePost(postId, (p) => ({
        ...p,
        liked: !p.liked,
        likes_count: p.likes_count + (p.liked ? -1 : 1),
      }));
    }
  }, [updatePost]);

  const handleDislike = useCallback(async (postId: string) => {
    updatePost(postId, (p) => ({
      ...p,
      disliked: !p.disliked,
      liked: p.disliked ? p.liked : false,
      dislikes_count: (p.dislikes_count || 0) + (p.disliked ? -1 : 1),
      likes_count: !p.disliked && p.liked ? p.likes_count - 1 : p.likes_count,
    }));

    try {
      const result = await api.dislikePost(postId);
      updatePost(postId, (p) => ({
        ...p,
        disliked: !!result.disliked,
        dislikes_count: typeof result.dislikes_count === 'number' ? result.dislikes_count : p.dislikes_count,
      }));
    } catch (error) {
      updatePost(postId, (p) => ({
        ...p,
        disliked: !p.disliked,
        dislikes_count: (p.dislikes_count || 0) + (p.disliked ? -1 : 1),
      }));
    }
  }, [updatePost]);

  const handleSave = useCallback(async (postId: string) => {
    updatePost(postId, (p) => ({ ...p, saved: !p.saved }));
    try {
      const result = await api.savePost(postId);
      updatePost(postId, (p) => ({ ...p, saved: !!result.saved }));
    } catch (error) {
      updatePost(postId, (p) => ({ ...p, saved: !p.saved }));
    }
  }, [updatePost]);

  const handleShare = useCallback(async (postId: string) => {
    try {
      await api.sharePost(postId);
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  const handleOpenComment = useCallback((post: Post) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
    loadComments(post.post_id);
  }, []);

  const handleOpenRepost = useCallback((post: Post) => {
    const targetPost = post.is_repost && post.original_post ? post.original_post : post;
    setSelectedRepostPost(targetPost);
    setRepostModalVisible(true);
  }, []);

  const handleVotePoll = useCallback(async (postId: string, optionIndex: number) => {
    try {
      const updatedPost = await api.voteOnPoll(postId, optionIndex);
      setPosts(prev => prev.map(p => p.post_id === postId ? updatedPost : p));
    } catch (error) {
      Alert.alert('Error', 'Failed to vote on poll');
    }
  }, []);

  const loadComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const data = await api.getComments(postId);
      setComments(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedPost || !commentText.trim()) return;

    try {
      await api.createComment(selectedPost.post_id, commentText, replyingTo?.comment_id);
      setCommentText('');
      setReplyingTo(null);
      loadComments(selectedPost.post_id);
      updatePost(selectedPost.post_id, (p) => ({
        ...p,
        comments_count: (p.comments_count || 0) + 1,
      }));
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
    }
  };

  const handleRepost = async () => {
    if (!selectedRepostPost) return;

    try {
      await api.repostPost(selectedRepostPost.post_id, repostComment.trim() || undefined);
      updatePost(selectedRepostPost.post_id, (p) => ({
        ...p,
        repost_count: (p.repost_count || 0) + 1,
        reposted: true,
      }));
      setRepostComment('');
      setRepostModalVisible(false);
      setSelectedRepostPost(null);
      Alert.alert('Success', 'Post reposted!');
    } catch (error: any) {
      const message = error.message?.includes('already reposted')
        ? 'You have already reposted this'
        : 'Failed to repost';
      Alert.alert('Error', message);
    }
  };

  // Get next video URI for preloading
  const getNextVideoUri = useCallback((currentPostId: string) => {
    const currentIndex = posts.findIndex(p => p.post_id === currentPostId);
    if (currentIndex === -1) return undefined;
    
    for (let i = currentIndex + 1; i < Math.min(currentIndex + 3, posts.length); i++) {
      if (posts[i]?.media_type === 'video' && posts[i]?.media_url) {
        return posts[i].media_url;
      }
    }
    return undefined;
  }, [posts]);

  // Viewability configuration for auto-play
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    const ids = viewableItems.map(item => item.item.post_id);
    setVisiblePostIds(ids);
  }, []);

  // Memoized render item
  const renderItem = useCallback(({ item }: { item: Post }) => (
    <PostCard
      item={item}
      isVisible={visiblePostsSet.has(item.post_id)}
      onLike={handleLike}
      onDislike={handleDislike}
      onSave={handleSave}
      onShare={handleShare}
      onComment={handleOpenComment}
      onRepost={handleOpenRepost}
      onVotePoll={handleVotePoll}
      nextVideoUri={getNextVideoUri(item.post_id)}
    />
  ), [visiblePostsSet, handleLike, handleDislike, handleSave, handleShare, handleOpenComment, handleOpenRepost, handleVotePoll, getNextVideoUri]);

  const keyExtractor = useCallback((item: Post) => item.post_id, []);

  const getItemType = useCallback((item: Post) => {
    if (item.media_url) return 'media';
    if (item.has_poll) return 'poll';
    return 'text';
  }, []);

  const overrideItemLayout = useCallback((layout: any, item: Post) => {
    layout.size = item.media_url ? ESTIMATED_POST_WITH_MEDIA_HEIGHT : ESTIMATED_POST_HEIGHT;
  }, []);

  const pickMedia = async (type: 'image' | 'video' | 'audio') => {
    try {
      if (type === 'audio') {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['audio/*'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setSelectedMedia({
            uri: asset.uri,
            type: 'audio',
            name: asset.name,
            mimeType: asset.mimeType,
          });
        }
      } else {
        const mediaType = type === 'image' ? 'Images' : 'Videos';
        const result = await pickMediaUtil({
          mediaTypes: mediaType,
          allowsEditing: type === 'image',
          quality: 0.8,
          base64: false,
        });

        if (result) {
          setSelectedMedia({
            uri: result.uri,
            type: result.type || type,
            width: result.width,
            height: result.height,
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const createPost = async () => {
    if (!newPostContent.trim() && !selectedMedia && !showPollOption) {
      Alert.alert('Error', 'Please add some content');
      return;
    }

    if (showPollOption && (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2)) {
      Alert.alert('Error', 'Poll needs a question and at least 2 options');
      return;
    }

    setUploading(true);
    try {
      const formData = await buildPostFormData({
        content: newPostContent,
        media: selectedMedia,
        taggedUsers: taggedUsers,
        location: location,
        pollQuestion: showPollOption ? pollQuestion : undefined,
        pollOptions: showPollOption ? pollOptions : undefined,
        pollDurationHours: showPollOption ? pollDuration : undefined,
      });

      await api.createPost(formData);
      
      setNewPostContent('');
      setTaggedUsers('');
      setLocation('');
      setSelectedMedia(null);
      setShowPollOption(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDuration(24);
      setCreateModalVisible(false);
      
      loadFeed(true);
      Alert.alert('Success', 'Post created!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  // Footer component
  const ListFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  }, [loadingMore]);

  // Empty component
  const ListEmpty = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="images-outline" size={64} color={Colors.textSecondary} />
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>Follow creators to see their posts</Text>
    </View>
  ), []);

  // Stories header
  const StoriesHeader = useMemo(() => {
    if (stories.length === 0) return null;
    return (
      <ScrollView
        horizontal
        style={styles.storiesContainer}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContent}
      >
        <StoryItem isCreateButton />
        {stories.map((userStory, index) => (
          <StoryItem
            key={userStory.user.user_id}
            userStory={userStory}
            index={index}
            stories={stories}
          />
        ))}
      </ScrollView>
    );
  }, [stories]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <LinearGradient
          colors={[Colors.gradient.start, Colors.gradient.middle]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Feed</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.liveButton}
              onPress={() => router.push('/go-live')}
            >
              <Ionicons name="radio" size={18} color="#fff" />
              <Text style={styles.liveButtonText}>LIVE</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
              <Ionicons name="add-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {StoriesHeader}

      <FlashList
        ref={listRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={ESTIMATED_POST_HEIGHT}
        getItemType={getItemType}
        overrideItemLayout={overrideItemLayout}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        drawDistance={SCREEN_WIDTH * 2}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />

      {/* Create Post Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Post</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.textSecondary}
              multiline
              value={newPostContent}
              onChangeText={setNewPostContent}
            />

            <TextInput
              style={styles.tagInput}
              placeholder="Tag users (comma separated)"
              placeholderTextColor={Colors.textSecondary}
              value={taggedUsers}
              onChangeText={setTaggedUsers}
            />

            <TextInput
              style={styles.tagInput}
              placeholder="Location (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={location}
              onChangeText={setLocation}
            />

            {/* Poll Toggle */}
            <TouchableOpacity
              style={styles.pollToggle}
              onPress={() => setShowPollOption(!showPollOption)}
            >
              <Ionicons 
                name={showPollOption ? "stats-chart" : "stats-chart-outline"} 
                size={20} 
                color={showPollOption ? Colors.primary : Colors.textSecondary} 
              />
              <Text style={[styles.pollToggleText, showPollOption && { color: Colors.primary }]}>
                {showPollOption ? 'Remove Poll' : 'Add Poll'}
              </Text>
            </TouchableOpacity>

            {showPollOption && (
              <View style={styles.pollCreationContainer}>
                <TextInput
                  style={styles.pollQuestionInput}
                  placeholder="Ask a question..."
                  placeholderTextColor={Colors.textSecondary}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                />
                {pollOptions.map((option, index) => (
                  <View key={index} style={styles.pollOptionRow}>
                    <TextInput
                      style={styles.pollOptionInput}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={Colors.textSecondary}
                      value={option}
                      onChangeText={(text) => {
                        const newOptions = [...pollOptions];
                        newOptions[index] = text;
                        setPollOptions(newOptions);
                      }}
                    />
                    {pollOptions.length > 2 && (
                      <TouchableOpacity onPress={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}>
                        <Ionicons name="close-circle" size={24} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {pollOptions.length < 4 && (
                  <TouchableOpacity style={styles.addOptionButton} onPress={() => setPollOptions([...pollOptions, ''])}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {selectedMedia && (
              <View style={styles.mediaPreview}>
                {selectedMedia.type === 'audio' ? (
                  <View style={styles.audioPreview}>
                    <Ionicons name="musical-notes" size={48} color={Colors.primary} />
                    <Text style={styles.audioPreviewText}>{selectedMedia.name || 'Audio'}</Text>
                  </View>
                ) : (
                  <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreviewImage} />
                )}
                <TouchableOpacity style={styles.removeMediaButton} onPress={() => setSelectedMedia(null)}>
                  <Ionicons name="close-circle" size={32} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.mediaSectionTitle}>Add Media</Text>
            <View style={styles.mediaButtonsGrid}>
              <TouchableOpacity style={styles.mediaTypeButton} onPress={() => pickMedia('image')}>
                <Ionicons name="image-outline" size={28} color={Colors.primary} />
                <Text style={styles.mediaTypeText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaTypeButton} onPress={() => pickMedia('video')}>
                <Ionicons name="videocam-outline" size={28} color={Colors.secondary} />
                <Text style={styles.mediaTypeText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaTypeButton} onPress={() => pickMedia('audio')}>
                <Ionicons name="musical-notes-outline" size={28} color={Colors.accent} />
                <Text style={styles.mediaTypeText}>Audio</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              onPress={createPost}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments ({selectedPost?.comments_count || 0})</Text>
              <TouchableOpacity onPress={() => { setCommentsModalVisible(false); setReplyingTo(null); setCommentText(''); }}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <FlashList
                data={comments}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }} style={styles.commentAvatar} />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUsername}>{item.user?.name || 'Unknown'}</Text>
                        <Text style={styles.commentTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.commentText}>{item.content}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity style={styles.commentAction} onPress={() => setReplyingTo(item)}>
                          <Ionicons name="arrow-undo" size={16} color={Colors.textSecondary} />
                          <Text style={styles.commentActionText}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item.comment_id}
                estimatedItemSize={80}
                contentContainerStyle={styles.commentsList}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Ionicons name="chatbubble-outline" size={48} color={Colors.textSecondary} />
                    <Text style={styles.emptyCommentsText}>No comments yet</Text>
                  </View>
                }
              />
            )}

            {replyingTo && (
              <View style={styles.replyingIndicator}>
                <Text style={styles.replyingText}>Replying to @{replyingTo.user?.name}</Text>
                <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.commentInputContainer}>
              <Image source={{ uri: user?.picture || 'https://via.placeholder.com/32' }} style={styles.commentInputAvatar} />
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor={Colors.textSecondary}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSendButton, !commentText.trim() && styles.commentSendButtonDisabled]}
                onPress={handleCommentSubmit}
                disabled={!commentText.trim()}
              >
                <Ionicons name="send" size={20} color={commentText.trim() ? Colors.primary : Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Repost Modal */}
      <Modal
        visible={repostModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRepostModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Repost</Text>
              <TouchableOpacity onPress={() => { setRepostModalVisible(false); setRepostComment(''); setSelectedRepostPost(null); }}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedRepostPost && (
              <View style={styles.repostPreview}>
                <View style={styles.repostPreviewHeader}>
                  <Image source={{ uri: selectedRepostPost.user?.picture || 'https://via.placeholder.com/32' }} style={styles.commentAvatar} />
                  <Text style={styles.repostPreviewUsername}>{selectedRepostPost.user?.name || 'Unknown'}</Text>
                </View>
                <Text style={styles.repostPreviewContent} numberOfLines={3}>{selectedRepostPost.content}</Text>
              </View>
            )}

            <TextInput
              style={styles.repostInput}
              placeholder="Add your commentary (optional)..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              value={repostComment}
              onChangeText={setRepostComment}
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleRepost}>
              <Text style={styles.submitButtonText}>Repost</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    overflow: 'hidden',
  },
  headerGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  liveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postHeaderText: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  postContent: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  postMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  repostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  repostText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  repostCommentBox: {
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  repostCommentText: {
    fontSize: 14,
    color: Colors.text,
    fontStyle: 'italic',
  },
  pollContainer: {
    backgroundColor: Colors.surface || Colors.card,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  pollOption: {
    marginBottom: 12,
  },
  pollOptionContent: {
    position: 'relative',
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    overflow: 'hidden',
  },
  pollBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
    opacity: 0.2,
    borderRadius: 8,
  },
  pollOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  pollPercentage: {
    position: 'absolute',
    right: 12,
    top: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  pollVoteCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  storiesContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  storiesContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  storyItem: {
    alignItems: 'center',
    width: 80,
  },
  storyRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: 2,
    marginBottom: 8,
  },
  storyRingUnviewed: {
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  createStoryRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  storyAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  storyUsername: {
    fontSize: 12,
    color: Colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  tagInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
    marginBottom: 12,
  },
  pollToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.surface || Colors.background,
    borderRadius: 8,
    marginBottom: 12,
  },
  pollToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pollCreationContainer: {
    backgroundColor: Colors.surface || Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  pollQuestionInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 12,
  },
  pollOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pollOptionInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    justifyContent: 'center',
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  mediaPreview: {
    position: 'relative',
    marginBottom: 16,
  },
  mediaPreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  audioPreview: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.background,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  audioPreviewText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text,
  },
  mediaSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  mediaButtonsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  mediaTypeButton: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mediaTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  commentsList: {
    paddingVertical: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  commentTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 12,
  },
  replyingIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
    borderRadius: 8,
  },
  replyingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 100,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    opacity: 0.5,
  },
  repostPreview: {
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  repostPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  repostPreviewUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  repostPreviewContent: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  repostInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
});
