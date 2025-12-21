import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FeedVideoPlayerProps {
  uri: string;
  style?: any;
  isVisible?: boolean;
  isMuted?: boolean;
  onDoubleTapLike?: () => void;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  preloadUri?: string; // Next video URI to preload
}

// Preload cache for videos
const preloadCache = new Map<string, boolean>();

const FeedVideoPlayer = memo(({
  uri,
  style,
  isVisible = true,
  isMuted = false,
  onDoubleTapLike,
  showControls = true,
  autoPlay = true,
  loop = true,
  preloadUri,
}: FeedVideoPlayerProps) => {
  const videoRef = useRef<Video>(null);
  const preloadVideoRef = useRef<Video>(null);
  
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showPlayPause, setShowPlayPause] = useState(false);
  
  // Double-tap detection
  const lastTap = useRef<{ time: number; x: number } | null>(null);
  const doubleTapTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Like animation
  const likeScale = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  
  // Seek indicator
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; visible: boolean }>({
    side: 'left',
    visible: false,
  });
  const seekTimeout = useRef<NodeJS.Timeout | null>(null);

  const isLoaded = status?.isLoaded;
  const isPlaying = isLoaded && status.isPlaying;
  const isBuffering = isLoaded && status.isBuffering;
  const position = isLoaded ? status.positionMillis : 0;
  const duration = isLoaded ? status.durationMillis || 0 : 0;

  // Handle visibility changes
  useEffect(() => {
    if (isVisible && autoPlay) {
      videoRef.current?.playAsync();
    } else {
      videoRef.current?.pauseAsync();
    }
  }, [isVisible, autoPlay]);

  // Preload next video
  useEffect(() => {
    if (preloadUri && !preloadCache.has(preloadUri)) {
      preloadCache.set(preloadUri, true);
      // The hidden video component will preload
    }
  }, [preloadUri]);

  // Clean up preload cache periodically
  useEffect(() => {
    return () => {
      if (preloadCache.size > 10) {
        const keys = Array.from(preloadCache.keys());
        keys.slice(0, 5).forEach(key => preloadCache.delete(key));
      }
    };
  }, []);

  const showLikeAnimation = useCallback(() => {
    likeScale.setValue(0);
    likeOpacity.setValue(1);
    
    Animated.sequence([
      Animated.spring(likeScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(likeOpacity, {
        toValue: 0,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [likeScale, likeOpacity]);

  const togglePlayPause = useCallback(async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
    }
    
    // Show play/pause indicator briefly
    setShowPlayPause(true);
    setTimeout(() => setShowPlayPause(false), 800);
  }, [isPlaying]);

  const seekBy = useCallback(async (seconds: number) => {
    if (!isLoaded || duration <= 0) return;
    
    const newPosition = Math.max(0, Math.min(duration, position + seconds * 1000));
    await videoRef.current?.setPositionAsync(newPosition);
    
    // Show seek indicator
    setSeekIndicator({ side: seconds > 0 ? 'right' : 'left', visible: true });
    
    if (seekTimeout.current) clearTimeout(seekTimeout.current);
    seekTimeout.current = setTimeout(() => {
      setSeekIndicator(prev => ({ ...prev, visible: false }));
    }, 600);
  }, [isLoaded, duration, position]);

  const handlePress = useCallback((locationX: number, screenWidth: number) => {
    const now = Date.now();
    const tapZone = screenWidth / 3;
    
    // Check for double-tap
    if (lastTap.current && now - lastTap.current.time < 300) {
      // Double tap detected
      if (doubleTapTimeout.current) {
        clearTimeout(doubleTapTimeout.current);
        doubleTapTimeout.current = null;
      }
      
      // Check which zone was tapped
      if (locationX < tapZone) {
        // Left third - seek backward
        seekBy(-10);
      } else if (locationX > tapZone * 2) {
        // Right third - seek forward
        seekBy(10);
      } else {
        // Center - double-tap like
        showLikeAnimation();
        onDoubleTapLike?.();
      }
      
      lastTap.current = null;
    } else {
      // Single tap - wait to see if it's a double tap
      lastTap.current = { time: now, x: locationX };
      
      doubleTapTimeout.current = setTimeout(() => {
        // Single tap confirmed - toggle play/pause
        togglePlayPause();
        lastTap.current = null;
      }, 300);
    }
  }, [seekBy, showLikeAnimation, onDoubleTapLike, togglePlayPause]);

  const resolvedUri = uri.startsWith('http') 
    ? uri 
    : `data:video/mp4;base64,${uri}`;

  return (
    <TouchableWithoutFeedback
      onPress={(e) => handlePress(e.nativeEvent.locationX, e.nativeEvent.target ? SCREEN_WIDTH : SCREEN_WIDTH)}
    >
      <View style={[styles.container, style]}>
        <Video
          ref={videoRef}
          source={{ uri: resolvedUri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isVisible && autoPlay}
          isLooping={loop}
          isMuted={isMuted}
          onPlaybackStatusUpdate={setStatus}
        />

        {/* Buffering indicator */}
        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Play/Pause indicator */}
        {showPlayPause && (
          <View style={styles.playPauseIndicator}>
            <View style={styles.playPauseBg}>
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={32} 
                color="#fff" 
              />
            </View>
          </View>
        )}

        {/* Double-tap like heart animation */}
        <Animated.View
          style={[
            styles.likeAnimation,
            {
              transform: [{ scale: likeScale }],
              opacity: likeOpacity,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color="#fff" />
        </Animated.View>

        {/* Seek indicator */}
        {seekIndicator.visible && (
          <View style={[
            styles.seekIndicator,
            seekIndicator.side === 'left' ? styles.seekLeft : styles.seekRight,
          ]}>
            <Ionicons 
              name={seekIndicator.side === 'left' ? 'play-back' : 'play-forward'} 
              size={24} 
              color="#fff" 
            />
            <Text style={styles.seekText}>10s</Text>
          </View>
        )}

        {/* Progress bar */}
        {showControls && isLoaded && duration > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(position / duration) * 100}%` }
                ]} 
              />
            </View>
          </View>
        )}

        {/* Hidden preload video */}
        {preloadUri && (
          <Video
            ref={preloadVideoRef}
            source={{ uri: preloadUri.startsWith('http') ? preloadUri : `data:video/mp4;base64,${preloadUri}` }}
            style={styles.hiddenVideo}
            shouldPlay={false}
            isMuted={true}
          />
        )}
      </View>
    </TouchableWithoutFeedback>
  );
});

FeedVideoPlayer.displayName = 'FeedVideoPlayer';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playPauseIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -50,
    marginTop: -50,
  },
  seekIndicator: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  seekLeft: {
    left: 20,
  },
  seekRight: {
    right: 20,
  },
  seekText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  progressBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  hiddenVideo: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },
});

export default FeedVideoPlayer;
