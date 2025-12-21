import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../services/api';
import VideoPlayer from '../components/VideoPlayer';

const { width, height } = Dimensions.get('window');

const Colors = {
  primary: '#8B5CF6',
  background: '#000000',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  overlay: 'rgba(0, 0, 0, 0.3)',
};

const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

export default function StoriesScreen() {
  const params = useLocalSearchParams();
  const { stories: storiesParam, initialIndex } = params;
  
  const [allStories, setAllStories] = useState<any[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(parseInt(initialIndex as string) || 0);
  const [currentUserStories, setCurrentUserStories] = useState<any[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [paused, setPaused] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (storiesParam) {
      const parsed = JSON.parse(storiesParam as string);
      setAllStories(parsed);
      if (parsed[currentStoryIndex]) {
        setCurrentUserStories(parsed[currentStoryIndex].stories);
      }
    }
  }, [storiesParam]);

  useEffect(() => {
    if (currentUserStories.length > 0) {
      const story = currentUserStories[currentMediaIndex];
      viewStory(story.story_id);
      startProgress();
    }
    return () => stopProgress();
  }, [currentMediaIndex, currentUserStories]);

  const startProgress = () => {
    stopProgress();
    progressAnim.setValue(0);
    
    const duration = currentUserStories[currentMediaIndex]?.media_type === 'video' ? 15000 : 5000;
    
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !paused) {
        handleNext();
      }
    });
  };

  const stopProgress = () => {
    if (progressTimer.current) {
      clearTimeout(progressTimer.current);
    }
    progressAnim.stopAnimation();
  };

  const viewStory = async (storyId: string) => {
    try {
      await api.viewStory(storyId);
    } catch (error) {
      console.error('View story error:', error);
    }
  };

  const handleNext = () => {
    if (currentMediaIndex < currentUserStories.length - 1) {
      setCurrentMediaIndex(currentMediaIndex + 1);
    } else if (currentStoryIndex < allStories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setCurrentUserStories(allStories[currentStoryIndex + 1].stories);
      setCurrentMediaIndex(0);
    } else {
      router.back();
    }
  };

  const handlePrevious = () => {
    if (currentMediaIndex > 0) {
      setCurrentMediaIndex(currentMediaIndex - 1);
    } else if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      const prevStories = allStories[currentStoryIndex - 1].stories;
      setCurrentUserStories(prevStories);
      setCurrentMediaIndex(prevStories.length - 1);
    }
  };

  const handleReact = async (reaction: string) => {
    try {
      const story = currentUserStories[currentMediaIndex];
      await api.reactToStory(story.story_id, reaction);
      setShowReactions(false);
      Alert.alert('Reacted!', `You reacted with ${reaction}`);
    } catch (error) {
      console.error('React error:', error);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    
    try {
      const story = currentUserStories[currentMediaIndex];
      await api.replyToStory(story.story_id, replyText);
      setReplyText('');
      setShowReplyInput(false);
      Alert.alert('Sent!', 'Your reply was sent as a message');
    } catch (error) {
      console.error('Reply error:', error);
    }
  };

  const handlePressScreen = (x: number) => {
    const third = width / 3;
    if (x < third) {
      handlePrevious();
    } else if (x > third * 2) {
      handleNext();
    } else {
      setPaused(!paused);
      if (!paused) {
        stopProgress();
      } else {
        startProgress();
      }
    }
  };

  if (currentUserStories.length === 0) {
    return <View style={styles.container}><Text style={styles.text}>Loading...</Text></View>;
  }

  const currentStory = currentUserStories[currentMediaIndex];
  const user = allStories[currentStoryIndex]?.user;

  // Handle both Cloudinary URLs and legacy base64 data
  const getMediaUri = (story: any) => {
    if (!story?.media_url) return '';
    if (story.media_url.startsWith('http')) {
      return story.media_url;
    }
    // Legacy base64 fallback
    return story.media_type === 'video'
      ? `data:video/mp4;base64,${story.media_url}`
      : `data:image/jpeg;base64,${story.media_url}`;
  };

  const mediaUri = getMediaUri(currentStory);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={(e) => handlePressScreen(e.nativeEvent.locationX)}
      >
        {currentStory.media_type === 'video' ? (
          <VideoPlayer
            source={mediaUri}
            style={styles.media}
            autoPlay={!paused}
            onEnd={handleNext}
          />
        ) : (
          <Image
            source={{ uri: mediaUri }}
            style={styles.media}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>

      {/* Progress bars */}
      <View style={styles.progressContainer}>
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
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Image
            source={{ uri: user?.picture || 'https://via.placeholder.com/40' }}
            style={styles.avatar}
          />
          <Text style={styles.username}>{user?.name || 'Unknown'}</Text>
          <Text style={styles.time}>
            {Math.floor((Date.now() - new Date(currentStory.created_at).getTime()) / 3600000)}h
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {currentStory.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{currentStory.caption}</Text>
        </View>
      )}

      {/* Footer actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowReactions(!showReactions)}
        >
          <Ionicons name="heart-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowReplyInput(!showReplyInput)}
        >
          <Ionicons name="chatbubble-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="paper-plane-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Reactions overlay */}
      {showReactions && (
        <View style={styles.reactionsOverlay}>
          {REACTIONS.map((reaction) => (
            <TouchableOpacity
              key={reaction}
              style={styles.reactionButton}
              onPress={() => handleReact(reaction)}
            >
              <Text style={styles.reactionEmoji}>{reaction}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <View style={styles.replyContainer}>
          <TextInput
            style={styles.replyInput}
            placeholder="Reply to story..."
            placeholderTextColor={Colors.textSecondary}
            value={replyText}
            onChangeText={setReplyText}
            autoFocus
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleReply}>
            <Ionicons name="send" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  media: {
    width: width,
    height: height,
  },
  progressContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 4,
    zIndex: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  header: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  time: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  text: {
    color: '#fff',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  caption: {
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionsOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 16,
    backgroundColor: Colors.overlay,
    zIndex: 20,
  },
  reactionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionEmoji: {
    fontSize: 32,
  },
  replyContainer: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 30,
  },
  replyInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
