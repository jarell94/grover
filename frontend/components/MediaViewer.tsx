import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
  Image,
  StatusBar,
  Animated,
  PanResponder,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { normalizeImageUrl, normalizeRemoteUrl } from '../utils/normalizeRemoteUrl';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==================== Types ====================

export interface MediaItem {
  id: string;
  uri: string;
  type: 'image' | 'video' | 'audio';
  thumbnail?: string;
  caption?: string;
  title?: string;
  likes_count?: number;
  comments_count?: number;
  duration?: number;
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

// ==================== Helpers ====================

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const resolveUri = (uri: string, type: string) => {
  const normalized = type === 'image'
    ? normalizeImageUrl(uri, 1400)
    : normalizeRemoteUrl(uri);
  if (normalized.startsWith('http')) return normalized;
  const mimeMap: Record<string, string> = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/mpeg',
  };
  return `data:${mimeMap[type] || 'application/octet-stream'};base64,${uri}`;
};

// ==================== Zoomable Image ====================

const ZoomableImage = ({ uri, onSingleTap }: { uri: string; onSingleTap?: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  
  const [isZoomed, setIsZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const lastScale = useRef(1);
  const lastTap = useRef(0);
  const baseTranslateX = useRef(0);
  const baseTranslateY = useRef(0);

  const resetZoom = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
    ]).start();
    lastScale.current = 1;
    baseTranslateX.current = 0;
    baseTranslateY.current = 0;
    setIsZoomed(false);
  };

  const handleDoubleTap = () => {
    if (isZoomed) {
      resetZoom();
    } else {
      Animated.spring(scale, { toValue: 2.5, useNativeDriver: true }).start();
      lastScale.current = 2.5;
      setIsZoomed(true);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only respond to pan if zoomed or significant movement
        return isZoomed || Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10;
      },
      onPanResponderGrant: () => {
        const now = Date.now();
        if (now - lastTap.current < 300) {
          handleDoubleTap();
          lastTap.current = 0;
        } else {
          lastTap.current = now;
        }
      },
      onPanResponderMove: (_, gs) => {
        if (lastScale.current > 1) {
          translateX.setValue(baseTranslateX.current + gs.dx);
          translateY.setValue(baseTranslateY.current + gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        baseTranslateX.current += gs.dx;
        baseTranslateY.current += gs.dy;
        
        // Single tap detection (no significant movement)
        if (Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5 && lastTap.current > 0) {
          setTimeout(() => {
            if (lastTap.current > 0) {
              onSingleTap?.();
              lastTap.current = 0;
            }
          }, 300);
        }
      },
    })
  ).current;

  return (
    <View style={styles.mediaContainer}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.zoomContainer,
          {
            transform: [
              { scale },
              { translateX },
              { translateY },
            ],
          },
        ]}
      >
        <Image
          source={{ uri }}
          style={styles.fullImage}
          resizeMode="contain"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
        />
      </Animated.View>
      
      {isZoomed && (
        <TouchableOpacity style={styles.resetZoomButton} onPress={resetZoom}>
          <Ionicons name="contract-outline" size={24} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ==================== Video Player ====================

const VideoPlayerFull = ({ 
  uri, 
  isActive, 
  onToggleControls 
}: { 
  uri: string; 
  isActive: boolean;
  onToggleControls: () => void;
}) => {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const isLoaded = status?.isLoaded;
  const isPlaying = isLoaded && status.isPlaying;
  const isBuffering = isLoaded && status.isBuffering;
  const position = isLoaded ? status.positionMillis : 0;
  const duration = isLoaded ? status.durationMillis || 0 : 0;
  const progress = duration > 0 ? position / duration : 0;

  useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
    } else {
      videoRef.current?.pauseAsync();
    }
  }, [isActive]);

  useEffect(() => {
    // Auto-hide controls after 3 seconds
    if (showControls && isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    };
  }, [showControls, isPlaying]);

  const togglePlay = async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
    }
  };

  const handleSeek = async (value: number) => {
    if (duration > 0) {
      await videoRef.current?.setPositionAsync(value * duration);
    }
  };

  const handleTap = () => {
    setShowControls((prev) => !prev);
    onToggleControls();
  };

  const handleReplay = async () => {
    await videoRef.current?.replayAsync();
  };

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.mediaContainer}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={styles.fullVideo}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isActive}
          isLooping
          onPlaybackStatusUpdate={setStatus}
        />

        {/* Buffering indicator */}
        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.bufferingText}>Buffering...</Text>
          </View>
        )}

        {/* Controls overlay */}
        {showControls && isLoaded && (
          <View style={styles.videoControlsOverlay}>
            {/* Center play/pause */}
            <TouchableOpacity style={styles.centerPlayButton} onPress={togglePlay}>
              <View style={styles.playButtonBg}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={48}
                  color="#fff"
                />
              </View>
            </TouchableOpacity>

            {/* Bottom controls */}
            <View style={styles.videoBottomControls}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              
              {/* Progress bar */}
              <TouchableOpacity 
                style={styles.progressBarContainer}
                activeOpacity={1}
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const barWidth = SCREEN_WIDTH - 140;
                  const seekValue = Math.max(0, Math.min(1, locationX / barWidth));
                  handleSeek(seekValue);
                }}
              >
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  <View 
                    style={[
                      styles.progressThumb, 
                      { left: `${progress * 100}%` }
                    ]} 
                  />
                </View>
              </TouchableOpacity>
              
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

// ==================== Audio Player ====================

const AudioPlayerFull = ({ 
  item, 
  isActive 
}: { 
  item: MediaItem; 
  isActive: boolean;
}) => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoaded = status?.isLoaded;
  const isPlaying = isLoaded && status.isPlaying;
  const position = isLoaded ? status.positionMillis : 0;
  const duration = isLoaded ? status.durationMillis || 0 : 0;
  const progress = duration > 0 ? position / duration : 0;

  useEffect(() => {
    let mounted = true;
    
    const loadAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: resolveUri(item.uri, 'audio') },
          { shouldPlay: isActive },
          (newStatus) => {
            if (mounted) setStatus(newStatus);
          }
        );
        
        if (mounted) {
          soundRef.current = sound;
          setLoading(false);
        }
      } catch (error) {
        if (__DEV__) console.error('Audio load error:', error);
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, [item.uri]);

  useEffect(() => {
    if (isActive && soundRef.current) {
      soundRef.current.playAsync();
    } else if (soundRef.current) {
      soundRef.current.pauseAsync();
    }
  }, [isActive]);

  const togglePlay = async () => {
    if (!soundRef.current) return;
    
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  const handleSeek = async (value: number) => {
    if (!soundRef.current || duration <= 0) return;
    await soundRef.current.setPositionAsync(value * duration);
  };

  const skipBackward = async () => {
    if (!soundRef.current) return;
    const newPosition = Math.max(0, position - 10000);
    await soundRef.current.setPositionAsync(newPosition);
  };

  const skipForward = async () => {
    if (!soundRef.current) return;
    const newPosition = Math.min(duration, position + 10000);
    await soundRef.current.setPositionAsync(newPosition);
  };

  return (
    <View style={styles.audioContainer}>
      {/* Album art / waveform visualization placeholder */}
      <View style={styles.audioArtContainer}>
        <View style={styles.audioArt}>
          <Ionicons name="musical-notes" size={80} color={Colors.primary} />
        </View>
        {item.title && (
          <Text style={styles.audioTitle} numberOfLines={2}>
            {item.title}
          </Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.audioControls}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} />
        ) : (
          <>
            {/* Time and progress */}
            <View style={styles.audioProgressContainer}>
              <TouchableOpacity
                style={styles.audioProgressBar}
                activeOpacity={1}
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const barWidth = SCREEN_WIDTH - 64;
                  const seekValue = Math.max(0, Math.min(1, locationX / barWidth));
                  handleSeek(seekValue);
                }}
              >
                <View style={styles.audioProgressBg}>
                  <View style={[styles.audioProgressFill, { width: `${progress * 100}%` }]} />
                  <View 
                    style={[
                      styles.audioProgressThumb, 
                      { left: `${progress * 100}%` }
                    ]} 
                  />
                </View>
              </TouchableOpacity>
              
              <View style={styles.audioTimeRow}>
                <Text style={styles.audioTimeText}>{formatTime(position)}</Text>
                <Text style={styles.audioTimeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            {/* Playback controls */}
            <View style={styles.audioButtonsRow}>
              <TouchableOpacity style={styles.audioButton} onPress={skipBackward}>
                <Ionicons name="play-back" size={32} color="#fff" />
                <Text style={styles.skipText}>10s</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.audioPlayButton} onPress={togglePlay}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={40}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.audioButton} onPress={skipForward}>
                <Ionicons name="play-forward" size={32} color="#fff" />
                <Text style={styles.skipText}>10s</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
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
  const [showUI, setShowUI] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setShowUI(true);
    }
  }, [visible, initialIndex]);

  // Swipe down to close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        return gs.dy > 20 && Math.abs(gs.dy) > Math.abs(gs.dx) * 2;
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onClose();
            translateY.setValue(0);
          });
        } else {
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

  const toggleUI = useCallback(() => {
    setShowUI((prev) => !prev);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: MediaItem; index: number }) => {
      const isActive = index === currentIndex;
      const uri = resolveUri(item.uri, item.type);

      if (item.type === 'video') {
        return (
          <VideoPlayerFull 
            uri={uri} 
            isActive={isActive} 
            onToggleControls={toggleUI}
          />
        );
      }
      
      if (item.type === 'audio') {
        return <AudioPlayerFull item={{ ...item, uri }} isActive={isActive} />;
      }
      
      return <ZoomableImage uri={uri} onSingleTap={toggleUI} />;
    },
    [currentIndex, toggleUI]
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
        {showUI && (
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
        )}

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

        {/* Side Actions */}
        {showUI && currentItem?.type !== 'audio' && (
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
        )}

        {/* Caption */}
        {showUI && currentItem?.caption && currentItem.type !== 'audio' && (
          <View style={[styles.captionContainer, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.caption} numberOfLines={3}>
              {currentItem.caption}
            </Text>
          </View>
        )}

        {/* Pagination dots for multiple images */}
        {showUI && media.length > 1 && media[0]?.type === 'image' && (
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

// ==================== Styles ====================

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
  
  // Media containers
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  fullImage: {
    width: '100%',
    height: '100%',
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
    zIndex: 5,
  },
  resetZoomButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Video controls
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  bufferingText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  videoControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayButton: {
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
  videoBottomControls: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    minWidth: 45,
  },
  progressBarContainer: {
    flex: 1,
    height: 30,
    justifyContent: 'center',
  },
  progressBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginLeft: -8,
  },

  // Audio player
  audioContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  audioArtContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  audioArt: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  audioTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  audioControls: {
    width: '100%',
    alignItems: 'center',
  },
  audioProgressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  audioProgressBar: {
    height: 30,
    justifyContent: 'center',
  },
  audioProgressBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  audioProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  audioProgressThumb: {
    position: 'absolute',
    top: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    marginLeft: -10,
  },
  audioTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  audioTimeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  audioButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  audioButton: {
    alignItems: 'center',
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  audioPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Side actions
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

  // Caption
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

  // Pagination
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
