import React, { useState, useEffect } from 'react';
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

export default function CommunityDetailScreen() {
  const params = useLocalSearchParams();
  const communityId = params.id as string;
  
  const [community, setCommunity] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postText, setPostText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadCommunityDetail();
  }, [communityId]);

  const loadCommunityDetail = async () => {
    try {
      setLoading(true);
      const [communityData, postsData] = await Promise.all([
        api.getCommunityDetail(communityId),
        api.getCommunityPosts(communityId)
      ]);
      setCommunity(communityData);
      setPosts(postsData);
    } catch (error) {
      console.error('Load community detail error:', error);
      Alert.alert('Error', 'Failed to load community');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedMedia(result.assets[0]);
    }
  };

  const createPost = async () => {
    if (!postText.trim() && !selectedMedia) {
      Alert.alert('Error', 'Please add some content');
      return;
    }

    try {
      setPosting(true);
      const formData = new FormData();
      formData.append('content', postText.trim());
      
      if (selectedMedia) {
        const blob = {
          uri: selectedMedia.uri,
          type: selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg',
          name: selectedMedia.type === 'video' ? 'post.mp4' : 'post.jpg',
        };
        formData.append('media', blob as any);
      }

      await api.createCommunityPost(communityId, formData);
      setPostText('');
      setSelectedMedia(null);
      loadCommunityDetail();
      Alert.alert('Success', 'Post created!');
    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image
          source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }}
          style={styles.avatar}
        />
        <View style={styles.postInfo}>
          <Text style={styles.username}>{item.user?.name || 'Unknown'}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      {item.content && (
        <Text style={styles.postText}>{item.content}</Text>
      )}
      
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
        <TouchableOpacity style={styles.action}>
          <Ionicons name="heart-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.likes_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action}>
          <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action}>
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

  if (!community) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Community not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.communityIconLarge}>
          <Ionicons name="people" size={32} color="#fff" />
        </View>
        <Text style={styles.communityTitle}>{community.name}</Text>
        <Text style={styles.communityDescription}>{community.description}</Text>
        <View style={styles.communityStats}>
          <View style={styles.statLarge}>
            <Ionicons name="people-outline" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.statTextLarge}>
              {community.member_count} members
            </Text>
          </View>
          <View style={styles.statLarge}>
            <Ionicons name="pricetag-outline" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={styles.statTextLarge}>{community.category}</Text>
          </View>
        </View>
      </LinearGradient>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.post_id}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadCommunityDetail();
        }}
        ListHeaderComponent={
          <View style={styles.createPostSection}>
            <Text style={styles.createPostTitle}>Share with Community</Text>
            <View style={styles.createPostInput}>
              <TextInput
                style={styles.textInput}
                placeholder="What's on your mind?"
                placeholderTextColor={Colors.textSecondary}
                value={postText}
                onChangeText={setPostText}
                multiline
              />
              {selectedMedia && (
                <View style={styles.selectedMediaContainer}>
                  <Image
                    source={{ uri: selectedMedia.uri }}
                    style={styles.selectedMedia}
                  />
                  <TouchableOpacity
                    style={styles.removeMediaButton}
                    onPress={() => setSelectedMedia(null)}
                  >
                    <Ionicons name="close-circle" size={24} color={Colors.secondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={styles.createPostActions}>
              <TouchableOpacity style={styles.mediaButton} onPress={pickMedia}>
                <Ionicons name="images-outline" size={20} color={Colors.primary} />
                <Text style={styles.mediaButtonText}>Media</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postButton, posting && styles.postButtonDisabled]}
                onPress={createPost}
                disabled={posting}
              >
                {posting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#fff" />
                    <Text style={styles.postButtonText}>Post</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={Colors.textSecondary} />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptySubtitle}>Be the first to post!</Text>
          </View>
        }
      />
    </KeyboardAvoidingView>
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
    paddingBottom: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
  },
  communityIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  communityTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  communityDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  communityStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statTextLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  listContainer: {
    padding: 16,
  },
  createPostSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  createPostTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  createPostInput: {
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 15,
    padding: 12,
    borderRadius: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectedMediaContainer: {
    marginTop: 12,
    position: 'relative',
  },
  selectedMedia: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  createPostActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  mediaButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.6,
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  postInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  timestamp: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  postText: {
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
  postActions: {
    flexDirection: 'row',
    gap: 20,
  },
  action: {
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
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
