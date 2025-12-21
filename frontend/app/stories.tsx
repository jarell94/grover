import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  background: '#000000',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  card: '#1E293B',
  border: '#334155',
};

const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];
const STORY_DURATION = 5000; // 5 seconds for images
const VIDEO_MAX_DURATION = 30000; // 30 seconds max for videos

interface Story {
  story_id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
  views_count?: number;
  viewers?: any[];
}

interface StoryGroup {
  user: {
    user_id: string;
    username: string;
    profile_picture?: string;
  };
  stories: Story[];
}

export default function StoriesScreen() {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const params = useLocalSearchParams();
  const { stories: storiesParam, initialIndex } = params;
  
  const [allStories, setAllStories] = useState<StoryGroup[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(parseInt(initialIndex as string) || 0);
  const [currentUserStories, setCurrentUserStories] = useState<Story[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  
  // UI states
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  
  // Refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pausedRef = useRef(false);
  const videoRef = useRef<Video>(null);
  const videoDuration = useRef(STORY_DURATION);

  // Keep refs in sync
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Parse stories from params
  useEffect(() => {
    if (storiesParam) {
      try {
        const parsed = JSON.parse(storiesParam as string);
        if (Array.isArray(parsed)) {
          setAllStories(parsed);
          if (parsed[currentStoryIndex]?.stories) {
            setCurrentUserStories(parsed[currentStoryIndex].stories);
          }
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to parse stories:', error);
        router.back();
      }
    }
  }, [storiesParam]);

  // Sync stories when index changes
  useEffect(() => {
    if (allStories[currentStoryIndex]?.stories) {
      setCurrentUserStories(allStories[currentStoryIndex].stories);
      setCurrentMediaIndex(0);
    }
  }, [currentStoryIndex, allStories]);

  // Start progress when story changes
  useEffect(() => {
    if (currentUserStories.length > 0 && currentUserStories[currentMediaIndex]) {
      const story = currentUserStories[currentMediaIndex];
      if (story?.story_id) {
        viewStory(story.story_id);
      }
      
      // Reset and start progress
      progressAnim.setValue(0);
      if (!pausedRef.current) {
        startProgress();
      }
    }
    
    return () => stopProgress();
  }, [currentMediaIndex, currentUserStories]);

  const startProgress = useCallback(() => {
    const currentStory = currentUserStories[currentMediaIndex];
    const duration = currentStory?.media_type === 'video' 
      ? Math.min(videoDuration.current, VIDEO_MAX_DURATION) 
      : STORY_DURATION;
    
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !pausedRef.current) {
        handleNext();
      }
    });
  }, [currentMediaIndex, currentUserStories, progressAnim]);

  const stopProgress = useCallback(() => {
    progressAnim.stopAnimation();
  }, [progressAnim]);

  const resumeProgress = useCallback(() => {
    progressAnim.addListener(({ value }) => {
      // Continue from current position
    });
    
    const currentStory = currentUserStories[currentMediaIndex];
    const totalDuration = currentStory?.media_type === 'video' 
      ? Math.min(videoDuration.current, VIDEO_MAX_DURATION) 
      : STORY_DURATION;
    
    // Get current progress value
    let currentValue = 0;
    progressAnim.addListener(({ value }) => {
      currentValue = value;
    });
    progressAnim.removeAllListeners();
    
    const remainingDuration = totalDuration * (1 - currentValue);
    
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: remainingDuration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !pausedRef.current) {
        handleNext();
      }
    });
  }, [currentMediaIndex, currentUserStories, progressAnim]);

  const viewStory = async (storyId: string) => {
    try {
      await api.viewStory(storyId);
    } catch (error) {
      if (__DEV__) console.error('View story error:', error);
    }
  };

  const handleNext = useCallback(() => {
    if (currentMediaIndex < currentUserStories.length - 1) {
      setCurrentMediaIndex((i) => i + 1);
    } else if (currentStoryIndex < allStories.length - 1) {
      setCurrentStoryIndex((i) => i + 1);
    } else {
      router.back();
    }
  }, [currentMediaIndex, currentUserStories.length, currentStoryIndex, allStories.length]);

  const handlePrevious = useCallback(() => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex((i) => i - 1);
    } else if (currentStoryIndex > 0) {
      const prevIndex = currentStoryIndex - 1;
      const prevStories = allStories[prevIndex]?.stories || [];
      setCurrentStoryIndex(prevIndex);
      setCurrentUserStories(prevStories);
      setCurrentMediaIndex(Math.max(prevStories.length - 1, 0));
    }
  }, [currentMediaIndex, currentStoryIndex, allStories]);

  const handlePressScreen = useCallback((x: number) => {
    if (showReplyInput || showViewers) return;
    
    const third = width / 3;
    if (x < third) {
      handlePrevious();
    } else if (x > third * 2) {
      handleNext();
    } else {
      // Center tap - pause/resume
      setPaused((prev) => {
        const next = !prev;
        if (next) {
          stopProgress();
          videoRef.current?.pauseAsync();
        } else {
          startProgress();
          videoRef.current?.playAsync();
        }
        return next;
      });
    }
  }, [showReplyInput, showViewers, handlePrevious, handleNext, stopProgress, startProgress]);

  const handleLongPressIn = useCallback(() => {
    setPaused(true);
    stopProgress();
    videoRef.current?.pauseAsync();
  }, [stopProgress]);

  const handleLongPressOut = useCallback(() => {
    setPaused(false);
    startProgress();
    videoRef.current?.playAsync();
  }, [startProgress]);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    
    const story = currentUserStories[currentMediaIndex];
    const storyOwner = allStories[currentStoryIndex]?.user;
    
    if (!storyOwner?.user_id) return;
    
    try {
      // Send as DM to story owner
      await api.sendMessage(storyOwner.user_id, `📷 Reply to your story: ${replyText}`);
      setReplyText('');
      setShowReplyInput(false);
      Alert.alert('Sent!', `Your reply was sent to ${storyOwner.username}`);
      
      // Resume story
      setPaused(false);
      startProgress();
    } catch (error) {
      if (__DEV__) console.error('Reply error:', error);
      Alert.alert('Error', 'Failed to send reply');
    }
  };

  const handleReact = async (reaction: string) => {
    const story = currentUserStories[currentMediaIndex];
    const storyOwner = allStories[currentStoryIndex]?.user;
    
    try {
      // Send reaction as DM
      await api.sendMessage(storyOwner.user_id, `Reacted ${reaction} to your story`);
      Alert.alert('Sent!', `You reacted with ${reaction}`);
    } catch (error) {
      if (__DEV__) console.error('React error:', error);
    }
  };

  const loadViewers = async () => {
    const story = currentUserStories[currentMediaIndex];
    if (!story?.story_id) return;
    
    setLoadingViewers(true);
    try {
      const response = await api.getStoryViewers(story.story_id);
      setViewers(response?.viewers || []);
    } catch (error) {
      if (__DEV__) console.error('Load viewers error:', error);
      setViewers([]);
    } finally {
      setLoadingViewers(false);
    }
  };

  const openViewers = () => {
    setPaused(true);
    stopProgress();
    setShowViewers(true);
    loadViewers();
  };

  const closeViewers = () => {
    setShowViewers(false);
    setPaused(false);
    startProgress();
  };

  const openReplyInput = () => {
    setPaused(true);
    stopProgress();
    setShowReplyInput(true);
  };

  const closeReplyInput = () => {
    setShowReplyInput(false);
    setReplyText('');
    setPaused(false);
    startProgress();
  };

  const handleVideoStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.durationMillis) {
        videoDuration.current = status.durationMillis;
      }
      if (status.didJustFinish && !pausedRef.current) {
        handleNext();
      }
    }
  };

  const getMediaUri = (story: Story) => {
    if (!story?.media_url) return '';
    if (story.media_url.startsWith('http')) return story.media_url;
    return story.media_type === 'video'
      ? `data:video/mp4;base64,${story.media_url}`
      : `data:image/jpeg;base64,${story.media_url}`;
  };

  const timeAgo = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Loading state
  if (currentUserStories.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const currentStory = currentUserStories[currentMediaIndex];
  const storyUser = allStories[currentStoryIndex]?.user;
  const isOwnStory = currentUser?.user_id === storyUser?.user_id;
  const mediaUri = getMediaUri(currentStory);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Media */}
      <TouchableWithoutFeedback
        onPress={(e) => handlePressScreen(e.nativeEvent.locationX)}
        onLongPress={handleLongPressIn}
        onPressOut={handleLongPressOut}
        delayLongPress={200}
      >
        <View style={StyleSheet.absoluteFill}>
          {currentStory.media_type === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode={ResizeMode.COVER}
              shouldPlay={!paused}
              isLooping={false}
              onPlaybackStatusUpdate={handleVideoStatusUpdate}
            />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode="cover"
            />
          )}
          
          {/* Gradient overlay for better text visibility */}
          <View style={styles.gradientTop} />
          <View style={styles.gradientBottom} />
        </View>
      </TouchableWithoutFeedback>

      {/* Progress bars */}
      <View style={[styles.progressContainer, { top: insets.top + 8 }]}>
        {currentUserStories.map((_, index) => {
          const isPast = index < currentMediaIndex;
          const isCurrent = index === currentMediaIndex;

          return (
            <View key={index} style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBar,
                  isPast && { width: '100%' },
                  isCurrent && {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                  !isPast && !isCurrent && { width: '0%' },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 20 }]}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => {
            router.back();
            router.push(`/user/${storyUser?.user_id}`);
          }}
        >
          {storyUser?.profile_picture ? (
            <Image source={{ uri: storyUser.profile_picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={16} color={Colors.textSecondary} />
            </View>
          )}
          <View style={styles.userTextContainer}>
            <Text style={styles.username}>{storyUser?.username || 'User'}</Text>
            <Text style={styles.timestamp}>{timeAgo(currentStory.created_at)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {paused && (
            <View style={styles.pausedIndicator}>
              <Ionicons name="pause" size={16} color="#fff" />
            </View>
          )}
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Caption */}
      {currentStory.caption && (
        <View style={[styles.captionContainer, { bottom: isOwnStory ? 100 : 140 }]}>
          <Text style={styles.caption}>{currentStory.caption}</Text>
        </View>
      )}

      {/* Bottom actions */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
        {isOwnStory ? (
          // Creator view - show viewers
          <TouchableOpacity style={styles.viewersButton} onPress={openViewers}>
            <Ionicons name="eye-outline" size={24} color="#fff" />
            <Text style={styles.viewersText}>
              {currentStory.views_count || 0} views
            </Text>
          </TouchableOpacity>
        ) : (
          // Viewer view - show reply input and reactions
          <View style={styles.viewerActions}>
            <TouchableOpacity 
              style={styles.replyButton}
              onPress={openReplyInput}
            >
              <TextInput
                style={styles.replyPlaceholder}
                placeholder={`Reply to ${storyUser?.username}...`}
                placeholderTextColor={Colors.textSecondary}
                editable={false}
                pointerEvents="none"
              />
            </TouchableOpacity>
            
            <View style={styles.quickReactions}>
              {REACTIONS.slice(0, 3).map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionButton}
                  onPress={() => handleReact(emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Reply Modal */}
      <Modal
        visible={showReplyInput}
        transparent
        animationType="slide"
        onRequestClose={closeReplyInput}
      >
        <TouchableWithoutFeedback onPress={closeReplyInput}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.replyModal, { paddingBottom: insets.bottom + 16 }]}>
                <View style={styles.replyInputContainer}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder={`Reply to ${storyUser?.username}...`}
                    placeholderTextColor={Colors.textSecondary}
                    value={replyText}
                    onChangeText={setReplyText}
                    autoFocus
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity
                    style={[styles.sendButton, !replyText.trim() && styles.sendButtonDisabled]}
                    onPress={handleReply}
                    disabled={!replyText.trim()}
                  >
                    <Ionicons name="send" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.reactionsRow}>
                  {REACTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionButtonLarge}
                      onPress={() => {
                        handleReact(emoji);
                        closeReplyInput();
                      }}
                    >
                      <Text style={styles.reactionEmojiLarge}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Viewers Modal (for story owners) */}
      <Modal
        visible={showViewers}
        transparent
        animationType="slide"
        onRequestClose={closeViewers}
      >
        <TouchableWithoutFeedback onPress={closeViewers}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.viewersModal, { paddingBottom: insets.bottom }]}>
                <View style={styles.viewersHeader}>
                  <Text style={styles.viewersTitle}>Story Viewers</Text>
                  <TouchableOpacity onPress={closeViewers}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                
                {loadingViewers ? (
                  <View style={styles.viewersLoading}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                  </View>
                ) : viewers.length === 0 ? (
                  <View style={styles.viewersEmpty}>
                    <Ionicons name="eye-off-outline" size={48} color={Colors.textSecondary} />
                    <Text style={styles.viewersEmptyText}>No viewers yet</Text>
                  </View>
                ) : (
                  <FlatList
                    data={viewers}
                    keyExtractor={(item) => item.user_id}
                    renderItem={({ item }) => (
                      <TouchableOpacity 
                        style={styles.viewerItem}
                        onPress={() => {
                          closeViewers();
                          router.push(`/user/${item.user_id}`);
                        }}
                      >
                        {item.profile_picture ? (
                          <Image source={{ uri: item.profile_picture }} style={styles.viewerAvatar} />
                        ) : (
                          <View style={[styles.viewerAvatar, styles.avatarPlaceholder]}>
                            <Ionicons name="person" size={16} color={Colors.textSecondary} />
                          </View>
                        )}
                        <View style={styles.viewerInfo}>
                          <Text style={styles.viewerName}>{item.username}</Text>
                          <Text style={styles.viewerTime}>{timeAgo(item.viewed_at)}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  media: {
    width: '100%',
    height: '100%',
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: 'transparent',
    // Gradient effect via opacity
    opacity: 0.5,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'transparent',
  },
  progressContainer: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTextContainer: {
    marginLeft: 10,
  },
  username: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pausedIndicator: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  viewersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignSelf: 'center',
  },
  viewersText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  replyPlaceholder: {
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  quickReactions: {
    flexDirection: 'row',
    gap: 4,
  },
  reactionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  replyModal: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  replyInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  reactionButtonLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmojiLarge: {
    fontSize: 28,
  },
  viewersModal: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.6,
    minHeight: 300,
  },
  viewersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  viewersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  viewersLoading: {
    padding: 40,
    alignItems: 'center',
  },
  viewersEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  viewersEmptyText: {
    color: Colors.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  viewerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewerName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  viewerTime: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
