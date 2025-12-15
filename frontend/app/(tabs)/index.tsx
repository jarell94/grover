import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
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
import { router } from 'expo-router';
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

export default function HomeScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      const [feedData, storiesData] = await Promise.all([
        api.getFeed(),
        api.getStories().catch(() => [])
      ]);
      setPosts(feedData);
      setStories(storiesData);
    } catch (error) {
      console.error('Feed load error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const loadComments = async (postId: string) => {
    setLoadingComments(true);
    try {
      const data = await api.getComments(postId);
      setComments(data);
    } catch (error) {
      console.error('Load comments error:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim()) return;

    try {
      await api.createComment(
        selectedPost!.post_id,
        commentText,
        replyingTo?.comment_id
      );
      setCommentText('');
      setReplyingTo(null);
      loadComments(selectedPost!.post_id);
      
      // Update comment count in feed
      setPosts(posts.map(p =>
        p.post_id === selectedPost!.post_id
          ? { ...p, comments_count: (p.comments_count || 0) + 1 }
          : p
      ));
    } catch (error) {
      console.error('Comment submit error:', error);
      Alert.alert('Error', 'Failed to post comment');
    }
  };

  const handleCommentLike = async (commentId: string) => {
    try {
      const result = await api.likeComment(commentId);
      setComments(comments.map(c =>
        c.comment_id === commentId
          ? { ...c, liked: result.liked, likes_count: c.likes_count + (result.liked ? 1 : -1) }
          : c
      ));
    } catch (error) {
      console.error('Comment like error:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteComment(commentId);
            setComments(comments.filter(c => c.comment_id !== commentId));
            
            // Update comment count
            setPosts(posts.map(p =>
              p.post_id === selectedPost!.post_id
                ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) }
                : p
            ));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete comment');
          }
        },
      },
    ]);
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

  const handleDislike = async (postId: string) => {
    try {
      const result = await api.dislikePost(postId);
      setPosts(posts.map(p => 
        p.post_id === postId 
          ? { ...p, disliked: result.disliked, dislikes_count: (p.dislikes_count || 0) + (result.disliked ? 1 : -1) }
          : p
      ));
    } catch (error) {
      console.error('Dislike error:', error);
    }
  };

  const handleSave = async (postId: string) => {
    try {
      const result = await api.savePost(postId);
      setPosts(posts.map(p => 
        p.post_id === postId 
          ? { ...p, saved: result.saved }
          : p
      ));
      Alert.alert('Success', result.saved ? 'Post saved!' : 'Post unsaved');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save post');
    }
  };

  const handleShare = async (postId: string) => {
    try {
      await api.sharePost(postId);
      Alert.alert('Success', 'Post shared!');
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share post');
    }
  };

  const handleOpenRepost = (post: Post) => {
    // If post is already a repost, repost the original
    const targetPost = post.is_repost && post.original_post ? post.original_post : post;
    setSelectedRepostPost(targetPost);
    setRepostModalVisible(true);
  };

  const handleRepost = async () => {
    if (!selectedRepostPost) return;

    try {
      const result = await api.repostPost(
        selectedRepostPost.post_id,
        repostComment.trim() || undefined
      );
      
      // Update repost count in local state
      setPosts(posts.map(p =>
        p.post_id === selectedRepostPost.post_id
          ? { ...p, repost_count: (p.repost_count || 0) + 1, reposted: true }
          : p
      ));

      setRepostComment('');
      setRepostModalVisible(false);
      setSelectedRepostPost(null);
      Alert.alert('Success', 'Post reposted to your feed!');
      loadFeed(); // Refresh to show the repost
    } catch (error: any) {
      console.error('Repost error:', error);
      const message = error.message?.includes('already reposted')
        ? 'You have already reposted this'
        : 'Failed to repost';
      Alert.alert('Error', message);
    }
  };

  const handleVotePoll = async (postId: string, optionIndex: number) => {
    try {
      const result = await api.voteOnPoll(postId, optionIndex);
      // Refresh post to show updated votes
      const updatedPosts = await api.getFeed();
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Vote error:', error);
      Alert.alert('Error', 'Failed to vote on poll');
    }
  };

  const handleUnrepost = async (postId: string) => {
    Alert.alert(
      'Remove Repost',
      'Are you sure you want to remove this repost?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.unrepostPost(postId);
              setPosts(posts.map(p =>
                p.post_id === postId
                  ? { ...p, repost_count: Math.max(0, (p.repost_count || 0) - 1), reposted: false }
                  : p
              ));
              Alert.alert('Success', 'Repost removed');
              loadFeed();
            } catch (error) {
              console.error('Unrepost error:', error);
              Alert.alert('Error', 'Failed to remove repost');
            }
          },
        },
      ]
    );
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
      const formData = new FormData();
      formData.append('content', newPostContent);

      if (taggedUsers.trim()) {
        formData.append('tagged_users', taggedUsers.trim());
      }

      if (location.trim()) {
        formData.append('location', location.trim());
      }

      if (showPollOption && pollQuestion.trim()) {
        formData.append('poll_question', pollQuestion.trim());
        formData.append('poll_options', JSON.stringify(pollOptions.filter(o => o.trim())));
        formData.append('poll_duration_hours', pollDuration.toString());
      }

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
      setTaggedUsers('');
      setLocation('');
      setSelectedMedia(null);
      setShowPollOption(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollDuration(24);
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
          source={{ 
            uri: item.is_repost && item.original_post 
              ? item.original_post.user?.picture 
              : item.user?.picture || 'https://via.placeholder.com/40' 
          }}
          style={styles.avatar}
        />
        <View style={styles.postHeaderText}>
          <Text style={styles.username}>
            {item.is_repost && item.original_post 
              ? item.original_post.user?.name 
              : item.user?.name || 'Unknown'}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.is_repost && item.original_post 
              ? item.original_post.created_at 
              : item.created_at).toLocaleDateString()}
          </Text>
        </View>
        {((item.is_repost && item.original_post?.user?.is_premium) || item.user?.is_premium) && (
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
                onPress={() => handleVotePoll(item.post_id, index)}
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

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDislike(item.post_id)}
        >
          <Ionicons
            name={item.disliked ? 'heart-dislike' : 'heart-dislike-outline'}
            size={24}
            color={item.disliked ? Colors.secondary : Colors.textSecondary}
          />
          <Text style={[styles.actionText, item.disliked && { color: Colors.secondary }]}>
            {item.dislikes_count || 0}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedPost(item);
            setCommentsModalVisible(true);
            loadComments(item.post_id);
          }}
        >
          <Ionicons name="chatbubble-outline" size={24} color={Colors.textSecondary} />
          <Text style={styles.actionText}>{item.comments_count || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenRepost(item)}
        >
          <Ionicons
            name={item.reposted ? 'repeat' : 'repeat-outline'}
            size={24}
            color={item.reposted ? Colors.primary : Colors.textSecondary}
          />
          {item.repost_count! > 0 && (
            <Text style={[styles.actionText, item.reposted && { color: Colors.primary }]}>
              {item.repost_count}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShare(item.post_id)}
        >
          <Ionicons name="share-outline" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSave(item.post_id)}
        >
          <Ionicons
            name={item.saved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={item.saved ? Colors.accent : Colors.textSecondary}
          />
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

      {/* Stories Header */}
      {stories.length > 0 && (
        <ScrollView
          horizontal
          style={styles.storiesContainer}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContent}
        >
          {/* Create Story Button */}
          <TouchableOpacity
            style={styles.storyItem}
            onPress={() => router.push('/create-story')}
          >
            <View style={styles.createStoryRing}>
              <Ionicons name="add" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.storyUsername}>Your Story</Text>
          </TouchableOpacity>

          {/* User Stories */}
          {stories.map((userStory, index) => {
            const hasUnviewed = userStory.stories.some((s: any) => !s.viewed);
            return (
              <TouchableOpacity
                key={userStory.user.user_id}
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
                <View style={[
                  styles.storyRing,
                  hasUnviewed && styles.storyRingUnviewed
                ]}>
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
          })}
        </ScrollView>
      )}

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

            <TextInput
              style={styles.tagInput}
              placeholder="Tag users (comma separated user IDs)"
              placeholderTextColor={Colors.textSecondary}
              value={taggedUsers}
              onChangeText={setTaggedUsers}
            />

            <TextInput
              style={styles.tagInput}
              placeholder="Add location (optional)"
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

            {/* Poll Creation UI */}
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
                      <TouchableOpacity
                        onPress={() => {
                          setPollOptions(pollOptions.filter((_, i) => i !== index));
                        }}
                      >
                        <Ionicons name="close-circle" size={24} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                
                {pollOptions.length < 4 && (
                  <TouchableOpacity
                    style={styles.addOptionButton}
                    onPress={() => setPollOptions([...pollOptions, ''])}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.addOptionText}>Add Option</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.pollDurationContainer}>
                  <Text style={styles.pollDurationLabel}>Poll Duration:</Text>
                  <View style={styles.pollDurationButtons}>
                    {[24, 48, 72].map((hours) => (
                      <TouchableOpacity
                        key={hours}
                        style={[
                          styles.durationButton,
                          pollDuration === hours && styles.durationButtonActive
                        ]}
                        onPress={() => setPollDuration(hours)}
                      >
                        <Text style={[
                          styles.durationButtonText,
                          pollDuration === hours && styles.durationButtonTextActive
                        ]}>
                          {hours}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

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
              <Text style={styles.modalTitle}>
                Comments ({selectedPost?.comments_count || 0})
              </Text>
              <TouchableOpacity onPress={() => {
                setCommentsModalVisible(false);
                setReplyingTo(null);
                setCommentText('');
              }}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {loadingComments ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <FlatList
                data={comments}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image
                      source={{ uri: item.user?.picture || 'https://via.placeholder.com/40' }}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUsername}>{item.user?.name || 'Unknown'}</Text>
                        <Text style={styles.commentTime}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <Text style={styles.commentText}>{item.content}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity
                          style={styles.commentAction}
                          onPress={() => handleCommentLike(item.comment_id)}
                        >
                          <Ionicons
                            name={item.liked ? 'heart' : 'heart-outline'}
                            size={16}
                            color={item.liked ? Colors.error : Colors.textSecondary}
                          />
                          <Text style={[styles.commentActionText, item.liked && { color: Colors.error }]}>
                            {item.likes_count}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.commentAction}
                          onPress={() => {
                            setReplyingTo(item);
                            setCommentText(`@${item.user?.name} `);
                          }}
                        >
                          <Ionicons name="arrow-undo" size={16} color={Colors.textSecondary} />
                          <Text style={styles.commentActionText}>Reply</Text>
                        </TouchableOpacity>
                        {user?.user_id === item.user_id && (
                          <TouchableOpacity
                            style={styles.commentAction}
                            onPress={() => handleDeleteComment(item.comment_id)}
                          >
                            <Ionicons name="trash" size={16} color={Colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                )}
                keyExtractor={(item) => item.comment_id}
                contentContainerStyle={styles.commentsList}
                ListEmptyComponent={
                  <View style={styles.emptyComments}>
                    <Ionicons name="chatbubble-outline" size={48} color={Colors.textSecondary} />
                    <Text style={styles.emptyCommentsText}>No comments yet</Text>
                    <Text style={styles.emptyCommentsSubtext}>Be the first to comment!</Text>
                  </View>
                }
              />
            )}

            {replyingTo && (
              <View style={styles.replyingIndicator}>
                <Text style={styles.replyingText}>
                  Replying to @{replyingTo.user?.name}
                </Text>
                <TouchableOpacity onPress={() => {
                  setReplyingTo(null);
                  setCommentText('');
                }}>
                  <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.commentInputContainer}>
              <Image
                source={{ uri: user?.picture || 'https://via.placeholder.com/32' }}
                style={styles.commentInputAvatar}
              />
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
              <TouchableOpacity onPress={() => {
                setRepostModalVisible(false);
                setRepostComment('');
                setSelectedRepostPost(null);
              }}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedRepostPost && (
              <View style={styles.repostPreview}>
                <View style={styles.repostPreviewHeader}>
                  <Image
                    source={{ uri: selectedRepostPost.user?.picture || 'https://via.placeholder.com/32' }}
                    style={styles.commentAvatar}
                  />
                  <Text style={styles.repostPreviewUsername}>{selectedRepostPost.user?.name || 'Unknown'}</Text>
                </View>
                <Text style={styles.repostPreviewContent} numberOfLines={3}>
                  {selectedRepostPost.content}
                </Text>
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

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleRepost}
            >
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
  tagInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    fontSize: 14,
    marginBottom: 12,
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
  commentsList: {
    paddingVertical: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingHorizontal: 8,
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
    alignItems: 'center',
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
    lineHeight: 20,
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
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 12,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
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
    lineHeight: 20,
    fontStyle: 'italic',
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
    lineHeight: 20,
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
    borderWidth: 1,
    borderColor: Colors.border,
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
  pollToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginBottom: 12,
  },
  pollToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pollCreationContainer: {
    backgroundColor: Colors.surface,
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
    fontWeight: '600',
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
  pollDurationContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pollDurationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  pollDurationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
    alignItems: 'center',
  },
  durationButtonActive: {
    backgroundColor: Colors.primary,
  },
  durationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  durationButtonTextActive: {
    color: '#fff',
  },
  pollContainer: {
    backgroundColor: Colors.surface,
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
    zIndex: 1,
  },
  pollPercentage: {
    position: 'absolute',
    right: 12,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    zIndex: 1,
  },
  pollVoteCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});