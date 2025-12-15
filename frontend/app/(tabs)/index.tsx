import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import MediaDisplay from '../../components/MediaDisplay';

interface Post {
  post_id: string;
  user_id: string;
  content: string;
  media_url?: string;
  media_type?: string;
  likes_count: number;
  created_at: string;
  user?: any;
  liked?: boolean;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      const data = await api.getFeed();
      setPosts(data);
    } catch (error) {
      console.error('Load feed error:', error);
      Alert.alert('Error', 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const handleLike = async (postId: string) => {
    try {
      const result = await api.likePost(postId);
      setPosts(posts.map(p => 
        p.post_id === postId 
          ? { ...p, liked: result.liked, likes_count: p.likes_count + (result.liked ? 1 : -1) }
          : p
      ));
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const pickMedia = async (type: 'image' | 'video' | 'audio') => {
    try {
      if (type === 'audio') {
        // Pick audio files
        const result = await DocumentPicker.getDocumentAsync({
          type: ['audio/*'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          setSelectedMedia({
            ...asset,
            base64,
            type: 'audio',
          });
        }
      } else {
        // Pick images or videos
        const mediaTypes = type === 'image' ? ['images'] : ['videos'];
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: mediaTypes as any,
          allowsEditing: type === 'image',
          quality: 0.8,
          videoMaxDuration: type === 'video' ? 600 : undefined, // 10 minutes max
        });

        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const base64 = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          setSelectedMedia({
            ...asset,
            base64,
            type: asset.type || type,
          });
        }
      }
    } catch (error) {
      console.error('Media picking error:', error);
      Alert.alert('Error', 'Failed to pick media file');
    }
  };

  const createPost = async () => {
    if (!newPostContent.trim() && !selectedMedia) {
      Alert.alert('Error', 'Please add some content');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('content', newPostContent);

      if (selectedMedia) {
        let fileType = 'application/octet-stream';
        let fileName = 'media';
        
        if (selectedMedia.type === 'video') {
          fileType = 'video/mp4';
          fileName = 'video.mp4';
        } else if (selectedMedia.type === 'audio') {
          fileType = selectedMedia.mimeType || 'audio/mpeg';
          fileName = selectedMedia.name || 'audio.mp3';
        } else {
          fileType = 'image/jpeg';
          fileName = 'image.jpg';
        }

        // Create blob from base64
        const blob = {
          uri: `data:${fileType};base64,${selectedMedia.base64}`,
          type: fileType,
          name: fileName,
        };

        formData.append('media', blob as any);
      }

      await api.createPost(formData);
      setNewPostContent('');
      setSelectedMedia(null);
      setCreateModalVisible(false);
      loadFeed();
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image
          source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.postHeaderText}>
          <Text style={styles.username}>{item.user?.name || 'Unknown'}</Text>
          <Text style={styles.timestamp}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        {item.user?.is_premium && (
          <Ionicons name="star" size={20} color={Colors.accent} />
        )}
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      <MediaDisplay
        mediaUrl={item.media_url}
        mediaType={item.media_type}
        title={item.content}
      />

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleLike(item.post_id)}
        >
          <Ionicons
            name={item.liked ? 'heart' : 'heart-outline'}
            size={24}
            color={item.liked ? Colors.error : Colors.textSecondary}
          />
          <Text style={[styles.actionText, item.liked && { color: Colors.error }]}>
            {item.likes_count}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
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
          <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
            <Ionicons name="add-circle" size={32} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Follow some creators to see their posts here</Text>
          </View>
        }
      />

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

            {selectedMedia && (
              <View style={styles.mediaPreview}>
                {selectedMedia.type === 'audio' ? (
                  <View style={styles.audioPreview}>
                    <Ionicons name="musical-notes" size={48} color={Colors.primary} />
                    <Text style={styles.audioPreviewText}>{selectedMedia.name || 'Audio file'}</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: selectedMedia.uri }}
                    style={styles.mediaPreviewImage}
                  />
                )}
                <TouchableOpacity
                  style={styles.removeMediaButton}
                  onPress={() => setSelectedMedia(null)}
                >
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
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Post</Text>
              )}
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
  listContent: {
    padding: 16,
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
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 16,
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
    textAlign: 'center',
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
    minHeight: 400,
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
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
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
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  mediaButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
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
  audioPreview: {
    width: '100%',
    height: 150,
    backgroundColor: Colors.card,
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
    fontWeight: '600',
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
});