import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
  created_at: string;
  user?: any;
}

// Memoized post row component for better FlatList performance
const PostRow = React.memo(function PostRow({
  item,
  isRemoving,
  onRemove,
}: {
  item: Post;
  isRemoving: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <TouchableOpacity 
      style={styles.postCard} 
      activeOpacity={0.9}
      onPress={() => router.push(`/post/${item.post_id}`)}
    >
      {item.media_url && (
        <View style={styles.mediaContainer}>
          <MediaDisplay mediaUrl={item.media_url} mediaType={item.media_type} style={styles.media} />
        </View>
      )}

      <View style={styles.postContent}>
        <View style={styles.postHeader}>
          <Image
            source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <View style={styles.postInfo}>
            <Text style={styles.username}>{item.user?.name || 'Unknown'}</Text>
            <Text style={styles.timestamp}>
              {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => onRemove(item.post_id)}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color={Colors.secondary} />
            ) : (
              <Ionicons name="close-circle" size={24} color={Colors.secondary} />
            )}
          </TouchableOpacity>
        </View>

        {!!item.content && (
          <Text style={styles.postText} numberOfLines={3}>
            {item.content}
          </Text>
        )}

        <View style={styles.postStats}>
          <View style={styles.stat}>
            <Ionicons name="heart" size={16} color={Colors.secondary} />
            <Text style={styles.statText}>{item.likes_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function CollectionDetailScreen() {
  const params = useLocalSearchParams();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updating, setUpdating] = useState(false);
  const [removingPostId, setRemovingPostId] = useState<string | null>(null);

  const followersCount = useMemo(
    () => Number(collection?.followers_count ?? 0),
    [collection?.followers_count]
  );

  const loadCollectionDetail = useCallback(async () => {
    try {
      const data = await api.getCollectionDetail(collectionId);

      setCollection(data);
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
      setEditName(String(data?.name ?? ''));
      setEditDescription(String(data?.description ?? ''));
    } catch (error) {
      console.error('Load collection detail error:', error);
      Alert.alert('Error', 'Failed to load collection');
    }
  }, [collectionId]);

  // Load with mounted flag
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        await loadCollectionDetail();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadCollectionDetail]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollectionDetail();
    setRefreshing(false);
  }, [loadCollectionDetail]);

  const openEditModal = useCallback(() => {
    // Reset inputs to current collection values each time modal opens
    setEditName(String(collection?.name ?? ''));
    setEditDescription(String(collection?.description ?? ''));
    setEditModalVisible(true);
  }, [collection?.name, collection?.description]);

  const removePost = useCallback(
    (postId: string) => {
      Alert.alert(
        'Remove post?',
        'This will remove the post from this collection (it will not delete the post).',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                setRemovingPostId(postId);
                await api.removePostFromCollection(collectionId, postId);

                // functional update to avoid stale state
                setPosts((prev) => prev.filter((p) => p.post_id !== postId));
              } catch (error) {
                console.error('Remove post error:', error);
                Alert.alert('Error', 'Failed to remove post');
              } finally {
                setRemovingPostId(null);
              }
            },
          },
        ]
      );
    },
    [collectionId]
  );

  const updateCollection = useCallback(async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Please enter a collection name');
      return;
    }

    try {
      setUpdating(true);

      const payload = {
        name: editName.trim(),
        description: editDescription.trim(),
      };

      const updated = await api.updateCollection(collectionId, payload);

      // Prefer the server response if it returns the updated object,
      // otherwise fall back to local merge.
      setCollection((prev: any) => ({
        ...(prev ?? {}),
        ...(updated ?? {}),
        name: payload.name,
        description: payload.description,
      }));

      // Sync edit fields with saved values
      setEditName(payload.name);
      setEditDescription(payload.description);

      setEditModalVisible(false);
      Alert.alert('Success', 'Collection updated!');
    } catch (error) {
      console.error('Update collection error:', error);
      Alert.alert('Error', 'Failed to update collection');
    } finally {
      setUpdating(false);
    }
  }, [collectionId, editName, editDescription]);

  // Memoized render function for FlatList
  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostRow
        item={item}
        isRemoving={removingPostId === item.post_id}
        onRemove={removePost}
      />
    ),
    [removePost, removingPostId]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Collection not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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

          <TouchableOpacity onPress={openEditModal}>
            <Ionicons name="create-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.headerContent}>
          <View style={styles.collectionIconLarge}>
            <Ionicons name="folder" size={32} color="#fff" />
          </View>
          <Text style={styles.collectionTitle}>{collection.name}</Text>

          {!!collection.description && (
            <Text style={styles.collectionDescription}>{collection.description}</Text>
          )}

          <View style={styles.collectionStats}>
            <View style={styles.statLarge}>
              <Ionicons name="images-outline" size={20} color="rgba(255,255,255,0.9)" />
              <Text style={styles.statTextLarge}>{posts.length} posts</Text>
            </View>

            {!!collection.is_public && (
              <View style={styles.statLarge}>
                <Ionicons name="people-outline" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={styles.statTextLarge}>{followersCount} followers</Text>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={80} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptySubtitle}>Save posts to this collection from your feed</Text>
          </View>
        }
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
      />

      {/* Edit Collection Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setEditModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <KeyboardAvoidingView
              style={{ justifyContent: 'flex-end' }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Collection</Text>
                  <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Collection name"
                  placeholderTextColor={Colors.textSecondary}
                  value={editName}
                  onChangeText={setEditName}
                  maxLength={50}
                  returnKeyType="next"
                />

                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Description (optional)"
                  placeholderTextColor={Colors.textSecondary}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  multiline
                  maxLength={200}
                />

                <TouchableOpacity
                  style={[styles.updateButton, updating && styles.updateButtonDisabled]}
                  onPress={updateCollection}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.updateButtonText}>Update Collection</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerContent: { alignItems: 'center' },

  collectionIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  collectionTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8, textAlign: 'center' },
  collectionDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  collectionStats: { flexDirection: 'row', gap: 24 },
  statLarge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTextLarge: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },

  listContainer: { padding: 16, paddingBottom: 24 },

  postCard: { backgroundColor: Colors.surface, borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  mediaContainer: { width: '100%', height: 200 },
  media: { width: '100%', height: '100%' },

  postContent: { padding: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  postInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600', color: Colors.text },
  timestamp: { fontSize: 14, color: Colors.textSecondary },
  removeButton: { padding: 4 },

  postText: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 12 },
  postStats: { flexDirection: 'row', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 14, color: Colors.textSecondary },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 },
  errorText: { fontSize: 16, color: Colors.textSecondary },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text },

  input: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  textArea: { height: 100, textAlignVertical: 'top' },

  updateButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  updateButtonDisabled: { opacity: 0.6 },
  updateButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
