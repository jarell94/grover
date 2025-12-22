import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import MediaDisplay from '../components/MediaDisplay';
import * as ImagePicker from 'expo-image-picker';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#10B981',
};

interface Post {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  comments_count?: number;
  created_at: string;
  user?: any;
  is_liked?: boolean;
}

type PickedMedia = ImagePicker.ImagePickerAsset & {
  mimeType?: string;
};

function guessMimeType(uri: string, assetType?: string, mimeType?: string) {
  if (mimeType) return mimeType;

  const lower = uri.toLowerCase();
  if (assetType === 'video') {
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  }

  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function guessFileName(uri: string, assetType?: string) {
  const last = uri.split('/').pop();
  if (last && last.includes('.')) return last;

  if (assetType === 'video') return 'post.mp4';
  return 'post.jpg';
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

export default function CommunityDetailScreen() {
  const params = useLocalSearchParams();
  const communityId = params.id as string;

  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [postText, setPostText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<PickedMedia | null>(null);
  const [posting, setPosting] = useState(false);

  const [likingPostId, setLikingPostId] = useState<string | null>(null);

  const canPost = useMemo(() => {
    return !!postText.trim() || !!selectedMedia;
  }, [postText, selectedMedia]);

  const loadCommunityDetail = useCallback(
    async (opts?: { showLoader?: boolean }) => {
      const showLoader = opts?.showLoader ?? false;

      try {
        if (showLoader) setInitialLoading(true);

        const [communityData, postsData] = await Promise.all([
          api.getCommunityDetail(communityId),
          api.getCommunityPosts(communityId),
        ]);

        setCommunity(communityData);
        setPosts(Array.isArray(postsData) ? postsData : []);
      } catch (error) {
        console.error('Load community detail error:', error);
        Alert.alert('Error', 'Failed to load community');
      } finally {
        if (showLoader) setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [communityId]
  );

  useEffect(() => {
    loadCommunityDetail({ showLoader: true });
  }, [loadCommunityDetail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCommunityDetail();
  }, [loadCommunityDetail]);

  const pickMedia = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelectedMedia(result.assets[0] as PickedMedia);
    }
  }, []);

  const removeMedia = useCallback(() => {
    setSelectedMedia(null);
  }, []);

  const createPost = useCallback(async () => {
    if (!canPost) return;

    try {
      setPosting(true);

      const formData = new FormData();
      formData.append('content', postText.trim());
      formData.append('community_id', communityId);

      if (selectedMedia) {
        const assetType = selectedMedia.type; // 'image' | 'video'
        const mimeType = guessMimeType(selectedMedia.uri, assetType, selectedMedia.mimeType);
        const fileName = guessFileName(selectedMedia.uri, assetType);

        formData.append('media', {
          uri: selectedMedia.uri,
          type: mimeType,
          name: fileName,
        } as any);

        formData.append('media_type', assetType === 'video' ? 'video' : 'image');
      }

      const created = await api.createCommunityPost(communityId, formData);

      // Optimistic insert
      if (created?.post_id) {
        setPosts((prev) => [created, ...prev]);
      } else {
        await loadCommunityDetail();
      }

      setPostText('');
      setSelectedMedia(null);
      Alert.alert('Success', 'Post created!');
    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setPosting(false);
    }
  }, [canPost, postText, selectedMedia, communityId, loadCommunityDetail]);

  const likePost = useCallback(async (postId: string) => {
    try {
      setLikingPostId(postId);

      await api.likePost(postId);

      setPosts((prev) =>
        prev.map((p) =>
          p.post_id === postId
            ? {
                ...p,
                is_liked: !p.is_liked,
                likes_count: p.is_liked
                  ? Math.max(0, (p.likes_count ?? 0) - 1)
                  : (p.likes_count ?? 0) + 1,
              }
            : p
        )
      );
    } catch (error) {
      console.error('Like post error:', error);
    } finally {
      setLikingPostId(null);
    }
  }, []);

  const viewPost = useCallback((postId: string) => {
    router.push(`/post/${postId}`);
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => {
      const isLiking = likingPostId === item.post_id;

      return (
        <TouchableOpacity
          style={styles.postCard}
          onPress={() => viewPost(item.post_id)}
          activeOpacity={0.9}
        >
          <View style={styles.postHeader}>
            <Image
              source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }}
              style={styles.avatar}
            />
            <View style={styles.postHeaderInfo}>
              <Text style={styles.username}>{item.user?.name || 'Unknown'}</Text>
              <Text style={styles.timestamp}>{formatTimeAgo(item.created_at)}</Text>
            </View>
          </View>

          {!!item.content && <Text style={styles.postContent}>{item.content}</Text>}

          {item.media_url && (
            <View style={styles.mediaContainer}>
              <MediaDisplay
                mediaUrl={item.media_url}
                mediaType={item.media_type}
                style={styles.media}
              />
            </View>
          )}

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => likePost(item.post_id)}
              disabled={isLiking}
            >
              {isLiking ? (
                <ActivityIndicator size="small" color={Colors.secondary} />
              ) : (
                <Ionicons
                  name={item.is_liked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={item.is_liked ? Colors.secondary : Colors.textSecondary}
                />
              )}
              <Text
                style={[styles.actionText, item.is_liked && { color: Colors.secondary }]}
              >
                {item.likes_count ?? 0}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => viewPost(item.post_id)}
            >
              <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
              <Text style={styles.actionText}>{item.comments_count ?? 0}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    },
    [likePost, likingPostId, viewPost]
  );

  if (initialLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Community not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContent}>
          <View style={styles.communityIconLarge}>
            <Ionicons name="people" size={32} color="#fff" />
          </View>
          <Text style={styles.communityTitle}>{community.name}</Text>

          {!!community.description && (
            <Text style={styles.communityDescription} numberOfLines={2}>
              {community.description}
            </Text>
          )}

          <View style={styles.communityStats}>
            <View style={styles.statLarge}>
              <Ionicons name="people-outline" size={18} color="rgba(255,255,255,0.9)" />
              <Text style={styles.statTextLarge}>
                {community.member_count ?? 0} members
              </Text>
            </View>

            <View style={styles.statLarge}>
              <Ionicons name="document-text-outline" size={18} color="rgba(255,255,255,0.9)" />
              <Text style={styles.statTextLarge}>{posts.length} posts</Text>
            </View>

            {!!community.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{community.category}</Text>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptySubtitle}>
              Be the first to share something with the community!
            </Text>
          </View>
        }
      />

      {/* Post Composer */}
      <View style={styles.composerContainer}>
        {selectedMedia && (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: selectedMedia.uri }} style={styles.mediaPreview} />
            <TouchableOpacity style={styles.removeMediaButton} onPress={removeMedia}>
              <Ionicons name="close-circle" size={24} color={Colors.secondary} />
            </TouchableOpacity>
            {selectedMedia.type === 'video' && (
              <View style={styles.videoIndicator}>
                <Ionicons name="videocam" size={16} color="#fff" />
              </View>
            )}
          </View>
        )}

        <View style={styles.composerRow}>
          <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
            <Ionicons name="image-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.composerInput}
            placeholder="Write something..."
            placeholderTextColor={Colors.textSecondary}
            value={postText}
            onChangeText={setPostText}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.postButton, !canPost && styles.postButtonDisabled]}
            onPress={createPost}
            disabled={!canPost || posting}
          >
            {posting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerContent: { alignItems: 'center' },

  communityIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  communityTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  communityDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  communityStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  statLarge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextLarge: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  categoryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  listContainer: { padding: 16, paddingBottom: 100 },

  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  postHeaderInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600', color: Colors.text },
  timestamp: { fontSize: 12, color: Colors.textSecondary },

  postContent: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },

  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  media: { width: '100%', height: 200 },

  postActions: { flexDirection: 'row', gap: 20 },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 14, color: Colors.textSecondary },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },

  errorText: { fontSize: 16, color: Colors.textSecondary, marginBottom: 16 },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  // Composer
  composerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  mediaPreviewContainer: {
    padding: 12,
    paddingBottom: 0,
  },
  mediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 4,
    left: 76,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    padding: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  mediaButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerInput: {
    flex: 1,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 15,
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
  },
  postButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postButtonDisabled: { opacity: 0.5 },
});
