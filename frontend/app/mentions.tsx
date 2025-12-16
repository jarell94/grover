import React, { useState, useEffect } from 'react';
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
}

export default function MentionsScreen() {
  const { user } = useAuth();
  const [mentions, setMentions] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMentions();
  }, []);

  const loadMentions = async () => {
    try {
      setLoading(true);
      // Get all posts and filter for mentions
      const allPosts = await api.getPosts();
      const mentionedPosts = allPosts.filter((post: Post) => 
        post.tagged_users?.includes(user?.user_id || '')
      );
      setMentions(mentionedPosts);
    } catch (error) {
      console.error('Load mentions error:', error);
      Alert.alert('Error', 'Failed to load mentions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const likePost = async (postId: string) => {
    try {
      await api.likePost(postId);
      setMentions(mentions.map(p => 
        p.post_id === postId 
          ? { ...p, likes_count: p.likes_count + 1 }
          : p
      ));
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const openComments = (post: Post) => {
    // You can implement a modal or navigate to post detail
    Alert.alert('Comments', `Open comments for post: ${post.post_id}`);
  };

  const replyToMention = (post: Post) => {
    // Navigate to create post with pre-filled mention
    Alert.alert('Reply', 'Reply feature coming soon!');
  };

  const renderMention = ({ item }: { item: Post }) => (
    <View style={styles.mentionCard}>
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
      {item.content && (
        <Text style={styles.content}>{item.content}</Text>
      )}

      {/* Media */}
      {item.media_url && (
        <View style={styles.mediaContainer}>
          <MediaDisplay
            mediaUrl={item.media_url}
            mediaType={item.media_type}
            style={styles.media}
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => likePost(item.post_id)}
        >
          <Ionicons name="heart-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.likes_count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openComments(item)}
        >
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.comments_count}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => replyToMention(item)}
        >
          <Ionicons name="arrow-undo-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>Reply</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
          <TouchableOpacity onPress={loadMentions}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          Posts where you've been mentioned
        </Text>
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
              loadMentions();
            }}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="at-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Mentions Yet</Text>
            <Text style={styles.emptySubtitle}>
              When someone tags you in a post, it will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  listContainer: {
    padding: 16,
  },
  mentionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  userHeader: {
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
  userInfo: {
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
  },
  mentionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  mentionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
  content: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  mediaContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});
