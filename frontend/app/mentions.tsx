import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import MediaDisplay from '../components/MediaDisplay';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
};

interface Post {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  user?: any;
  tagged_users?: string[];
  // optional if you have it:
  is_liked?: boolean;
}

export default function MentionsScreen() {
  const { user } = useAuth();
  const [mentions, setMentions] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);      // first load only
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [pendingLike, setPendingLike] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMentions({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMentions = async ({ initial }: { initial: boolean }) => {
    try {
      if (initial) setLoading(true);

      // ✅ Preferred: backend endpoint (fast)
      // Fallback to current client filter if endpoint not available yet.
      let data: Post[] | null = null;

      try {
        if (api.getMentions) {
          data = await api.getMentions(); // implement when ready
        }
      } catch {
        data = null;
      }

      if (!data) {
        const allPosts = await api.getPosts();
        const uid = user?.user_id || '';
        data = allPosts.filter((post: Post) => post.tagged_users?.includes(uid));
      }

      // newest first
      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMentions(data);
    } catch (error) {
      console.error('Load mentions error:', error);
      Alert.alert('Error', 'Failed to load mentions');
    } finally {
      if (initial) setLoading(false);
      setRefreshing(false);
    }
  };

  const likePost = async (post: Post) => {
    if (pendingLike[post.post_id]) return;

    setPendingLike((p) => ({ ...p, [post.post_id]: true }));

    // optimistic toggle
    const wasLiked = !!post.is_liked;
    setMentions((prev) =>
      prev.map((p) =>
        p.post_id === post.post_id
          ? {
              ...p,
              is_liked: !wasLiked,
              likes_count: Math.max(0, p.likes_count + (wasLiked ? -1 : 1)),
            }
          : p
      )
    );

    try {
      if (wasLiked) {
        if (api.unlikePost) await api.unlikePost(post.post_id);
        else await api.likePost(post.post_id); // fallback if you only have like
      } else {
        await api.likePost(post.post_id);
      }
    } catch (error) {
      console.error('Like error:', error);

      // rollback
      setMentions((prev) =>
        prev.map((p) =>
          p.post_id === post.post_id
            ? { ...p, is_liked: wasLiked, likes_count: post.likes_count }
            : p
        )
      );
    } finally {
      setPendingLike((p) => ({ ...p, [post.post_id]: false }));
    }
  };

  const openPost = (postId: string) => {
    // create this route when ready: app/post/[id].tsx
    router.push(`/post/${postId}` as any);
  };

  const openComments = (postId: string) => {
    // can be same post screen with focus=comments
    router.push(`/post/${postId}?focus=comments` as any);
  };

  const replyToMention = (post: Post) => {
    // route to your create screen with mention prefill
    // implement in CreatePost screen by reading params.replyTo + params.mentionUserId
    router.push(
      `/create?replyTo=${encodeURIComponent(post.post_id)}&mentionUserId=${encodeURIComponent(
        post.user_id
      )}` as any
    );
  };

  const renderMention = ({ item }: { item: Post }) => {
    const liked = !!item.is_liked;

    return (
      <TouchableOpacity style={styles.mentionCard} activeOpacity={0.9} onPress={() => openPost(item.post_id)}>
        {/* User Info */}
        <View style={styles.userHeader}>
          <Image
            source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.user?.name || 'Unknown'}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.created_at).toLocaleDateString()} at{' '}
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.mentionBadge}>
            <Ionicons name="at" size={16} color={Colors.primary} />
            <Text style={styles.mentionBadgeText}>Mentioned you</Text>
          </View>
        </View>

        {/* Content */}
        {item.content ? <Text style={styles.content}>{item.content}</Text> : null}

        {/* Media */}
        {item.media_url ? (
          <View style={styles.mediaContainer}>
            <MediaDisplay mediaUrl={item.media_url} mediaType={item.media_type} style={styles.media} />
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              likePost(item);
            }}
            disabled={!!pendingLike[item.post_id]}
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={20}
              color={liked ? Colors.secondary : Colors.textSecondary}
            />
            <Text style={styles.actionText}>{item.likes_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              openComments(item.post_id);
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionText}>{item.comments_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              replyToMention(item);
            }}
          >
            <Ionicons name="arrow-undo-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionText}>Reply</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert('Share', 'Hook this to your share sheet');
            }}
          >
            <Ionicons name="share-social-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTitle}>
            <Ionicons name="at" size={24} color="#fff" />
            <Text style={styles.headerTitleText}>Mentions</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              loadMentions({ initial: false });
            }}
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerSubtitle}>Posts where you have been mentioned</Text>
      </LinearGradient>

      <FlatList
        data={mentions}
        renderItem={renderMention}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMentions({ initial: false });
            }}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="at-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Mentions Yet</Text>
            <Text style={styles.emptySubtitle}>When someone tags you in a post, it will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitleText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },

  listContainer: { padding: 16 },

  mentionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },

  userHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600', color: Colors.text },
  timestamp: { fontSize: 12, color: Colors.textSecondary },

  mentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mentionBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.primary },

  content: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 12 },

  mediaContainer: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  media: { width: '100%', height: '100%' },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  actionText: { fontSize: 14, color: Colors.textSecondary },

  emptyContainer: { alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
});
