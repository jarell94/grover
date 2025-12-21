import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  StatusBar,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MediaItem {
  id: string;
  uri: string;
  type: 'image' | 'video';
  thumbnail?: string;
  caption?: string;
  likes_count?: number;
  comments_count?: number;
}

interface MediaViewerProps {
  visible: boolean;
  media: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
  onLike?: (id: string) => void;
  onComment?: (id: string) => void;
  onShare?: (id: string) => void;
}

// ==================== Image Viewer ====================

const ImageViewer = ({ item, isActive }: { item: MediaItem; isActive: boolean }) => {
  const [loading, setLoading] = useState(true);

  const uri = item.uri.startsWith('http')
    ? item.uri
    : `data:image/jpeg;base64,${item.uri}`;

  return (
    <View style={styles.mediaContainer}>
      <Image
        source={{ uri }}
        style={styles.fullImage}
        resizeMode="contain"
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <Ionicons name="image-outline" size={48} color={Colors.textSecondary} />
        </View>
      )}
    </View>
  );
};

// ==================== Video Viewer (TikTok-style) ====================

const VideoViewer = ({ item, isActive }: { item: MediaItem; isActive: boolean }) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(isActive);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const uri = item.uri.startsWith('http')
    ? item.uri
    : `data:video/mp4;base64,${item.uri}`;

  React.useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [isActive]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setProgress(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      
      // Loop video
      if (status.didJustFinish) {
        videoRef.current?.replayAsync();
      }
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={styles.mediaContainer}
      activeOpacity={1}
      onPress={() => setShowControls(!showControls)}
    >
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.fullVideo}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isActive}
        isLooping
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />

      {/* Center play/pause button */}
      {showControls && (
        <TouchableOpacity style={styles.centerPlayButton} onPress={togglePlay}>
          <View style={styles.playButtonBg}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={48}
              color="#fff"
            />
          </View>
        </TouchableOpacity>
      )}

      {/* Progress bar at bottom */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: duration > 0 ? `${(progress / duration) * 100}%` : '0%' },
            ]}
          />
        </View>
        {showControls && (
          <Text style={styles.timeText}>
            {formatTime(progress)} / {formatTime(duration)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ==================== Main Component ====================

export default function MediaViewer({
  visible,
  media,
  initialIndex = 0,
  onClose,
  onLike,
  onComment,
  onShare,
}: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  // Swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 20 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Close if dragged down enough
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const currentItem = media[currentIndex];

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const isActive = index === currentIndex;

      if (item.type === 'video') {
        return <VideoViewer item={item} isActive={isActive} />;
      }
      return <ImageViewer item={item} isActive={isActive} />;
    },
    [currentIndex]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.counter}>
            {currentIndex + 1} / {media.length}
          </Text>

          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Media */}
        <FlatList
          ref={flatListRef}
          data={media}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* Side Actions (TikTok-style) */}
        <View style={[styles.sideActions, { bottom: 100 + insets.bottom }]}>
          {onLike && (
            <TouchableOpacity
              style={styles.sideAction}
              onPress={() => onLike(currentItem.id)}
            >
              <Ionicons name="heart-outline" size={32} color="#fff" />
              {currentItem.likes_count !== undefined && (
                <Text style={styles.sideActionText}>{currentItem.likes_count}</Text>
              )}
            </TouchableOpacity>
          )}

          {onComment && (
            <TouchableOpacity
              style={styles.sideAction}
              onPress={() => onComment(currentItem.id)}
            >
              <Ionicons name="chatbubble-outline" size={30} color="#fff" />
              {currentItem.comments_count !== undefined && (
                <Text style={styles.sideActionText}>{currentItem.comments_count}</Text>
              )}
            </TouchableOpacity>
          )}

          {onShare && (
            <TouchableOpacity
              style={styles.sideAction}
              onPress={() => onShare(currentItem.id)}
            >
              <Ionicons name="share-outline" size={30} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Caption */}
        {currentItem?.caption && (
          <View style={[styles.captionContainer, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.caption} numberOfLines={3}>
              {currentItem.caption}
            </Text>
          </View>
        )}

        {/* Pagination dots for images */}
        {media.length > 1 && media[0].type === 'image' && (
          <View style={[styles.pagination, { bottom: insets.bottom + 60 }]}>
            {media.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  centerPlayButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 80,
  },
  progressBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  sideActions: {
    position: 'absolute',
    right: 12,
    alignItems: 'center',
    gap: 24,
  },
  sideAction: {
    alignItems: 'center',
  },
  sideActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    padding: 16,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  pagination: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
});
