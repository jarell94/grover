import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  ActivityIndicator,
  Text,
  LayoutChangeEvent,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface FeedVideoPlayerProps {
  uri: string;
  style?: any;
  isVisible?: boolean;
  isMuted?: boolean;
  onDoubleTapLike?: () => void;
  showControls?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  preloadUri?: string;
  posterUri?: string; // <- optional Cloudinary thumbnail
}

const preloadCache = new Map<string, boolean>();

function isUriLike(u?: string) {
  if (!u) return false;
  return (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('file://') ||
    u.startsWith('content://') ||
    u.startsWith('ph://') ||
    u.startsWith('blob:') ||
    u.startsWith('data:')
  );
}

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
  posterUri,
}: FeedVideoPlayerProps) => {
  const videoRef = useRef<Video>(null);
  const preloadVideoRef = useRef<Video>(null);

  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [showPlayPause, setShowPlayPause] = useState(false);

  // measured width for tap zones
  const [tileWidth, setTileWidth] = useState(0);

  // Double-tap detection
  const lastTap = useRef<{ time: number; x: number } | null>(null);
  const doubleTapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Like animation
  const likeScale = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;

  // Seek indicator
  const [seekIndicator, setSeekIndicator] = useState<{ side: 'left' | 'right'; visible: boolean }>({
    side: 'left',
    visible: false,
  });
  const seekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playPauseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoaded = status?.isLoaded;
  const isPlaying = !!(isLoaded && (status as any).isPlaying);
  const isBuffering = !!(isLoaded && (status as any).isBuffering);
  const position = isLoaded ? (status as any).positionMillis ?? 0 : 0;
  const duration = isLoaded ? (status as any).durationMillis ?? 0 : 0;

  const resolvedUri = useMemo(() => {
    // With Cloudinary, this should always be a real URL.
    // Still allow file/content/ph/data for local previews.
    return isUriLike(uri) ? uri : '';
  }, [uri]);

  // visibility autoplay
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    (async () => {
      try {
        if (isVisible && autoPlay) await v.playAsync();
        else await v.pauseAsync();
      } catch {}
    })();
  }, [isVisible, autoPlay]);

  // timers cleanup
  useEffect(() => {
    return () => {
      if (doubleTapTimeout.current) clearTimeout(doubleTapTimeout.current);
      if (seekTimeout.current) clearTimeout(seekTimeout.current);
      if (playPauseTimeout.current) clearTimeout(playPauseTimeout.current);
    };
  }, []);

  // Preload next video (light guard)
  useEffect(() => {
    if (preloadUri && !preloadCache.has(preloadUri)) {
      preloadCache.set(preloadUri, true);
    }
  }, [preloadUri]);

  // Clean preload cache occasionally
  useEffect(() => {
    if (preloadCache.size > 12) {
      const keys = Array.from(preloadCache.keys());
      keys.slice(0, 6).forEach((k) => preloadCache.delete(k));
    }
  }, [preloadUri]);

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

  const flashPlayPause = useCallback(() => {
    setShowPlayPause(true);
    if (playPauseTimeout.current) clearTimeout(playPauseTimeout.current);
    playPauseTimeout.current = setTimeout(() => setShowPlayPause(false), 800);
  }, []);

  const togglePlayPause = useCallback(async () => {
    try {
      const v = videoRef.current;
      if (!v) return;

      if (isPlaying) await v.pauseAsync();
      else await v.playAsync();

      flashPlayPause();
    } catch (e) {
      console.error('togglePlayPause error', e);
    }
  }, [isPlaying, flashPlayPause]);

  const seekBy = useCallback(async (seconds: number) => {
    try {
      const v = videoRef.current;
      if (!v || !isLoaded || duration <= 0) return;

      const next = Math.max(0, Math.min(duration, position + seconds * 1000));
      await v.setPositionAsync(next);

      setSeekIndicator({ side: seconds > 0 ? 'right' : 'left', visible: true });

      if (seekTimeout.current) clearTimeout(seekTimeout.current);
      seekTimeout.current = setTimeout(() => {
        setSeekIndicator((prev) => ({ ...prev, visible: false }));
      }, 600);
    } catch (e) {
      console.error('seekBy error', e);
    }
  }, [isLoaded, duration, position]);

  const handlePress = useCallback((locationX: number) => {
    const now = Date.now();
    const w = tileWidth || 1;
    const tapZone = w / 3;

    if (lastTap.current && now - lastTap.current.time < 300) {
      // double tap
      if (doubleTapTimeout.current) {
        clearTimeout(doubleTapTimeout.current);
        doubleTapTimeout.current = null;
      }

      if (locationX < tapZone) seekBy(-10);
      else if (locationX > tapZone * 2) seekBy(10);
      else {
        showLikeAnimation();
        onDoubleTapLike?.();
      }

      lastTap.current = null;
      return;
    }

    // single tap candidate
    lastTap.current = { time: now, x: locationX };

    if (doubleTapTimeout.current) clearTimeout(doubleTapTimeout.current);
    doubleTapTimeout.current = setTimeout(() => {
      togglePlayPause();
      lastTap.current = null;
    }, 300);
  }, [tileWidth, seekBy, showLikeAnimation, onDoubleTapLike, togglePlayPause]);

  const onLayout = (e: LayoutChangeEvent) => {
    setTileWidth(e.nativeEvent.layout.width);
  };

  if (!resolvedUri) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.invalid}>
          <Ionicons name="alert-circle-outline" size={28} color={Colors.textSecondary} />
          <Text style={styles.invalidText}>Invalid video URL</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={(e) => handlePress(e.nativeEvent.locationX)}>
      <View style={[styles.container, style]} onLayout={onLayout}>
        <Video
          ref={videoRef}
          source={{ uri: resolvedUri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isVisible && autoPlay}
          isLooping={loop}
          isMuted={isMuted}
          onPlaybackStatusUpdate={setStatus}
          usePoster={!!posterUri}
          posterSource={posterUri ? { uri: posterUri } : undefined}
        />

        {isBuffering && (
          <View style={styles.bufferingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {showPlayPause && (
          <View style={styles.playPauseIndicator}>
            <View style={styles.playPauseBg}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#fff" />
            </View>
          </View>
        )}

        <Animated.View
          style={[
            styles.likeAnimation,
            { transform: [{ scale: likeScale }], opacity: likeOpacity },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color="#fff" />
        </Animated.View>

        {seekIndicator.visible && (
          <View
            style={[
              styles.seekIndicator,
              seekIndicator.side === 'left' ? styles.seekLeft : styles.seekRight,
            ]}
          >
            <Ionicons
              name={seekIndicator.side === 'left' ? 'play-back' : 'play-forward'}
              size={24}
              color="#fff"
            />
            <Text style={styles.seekText}>10s</Text>
          </View>
        )}

        {showControls && isLoaded && duration > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(position / duration) * 100}%` }]} />
            </View>
          </View>
        )}

        {/* Hidden preload video - consider removing for perf; if kept, only for http(s) */}
        {preloadUri && isUriLike(preloadUri) && (
          <Video
            ref={preloadVideoRef}
            source={{ uri: preloadUri }}
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
  video: { width: '100%', height: '100%' },
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
  seekLeft: { left: 20 },
  seekRight: { right: 20 },
  seekText: { color: '#fff', fontSize: 12, marginTop: 4, fontWeight: '600' },
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
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  hiddenVideo: { width: 1, height: 1, position: 'absolute', opacity: 0 },

  invalid: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  invalidText: { color: Colors.textSecondary, fontSize: 12 },
});

export default FeedVideoPlayer;
