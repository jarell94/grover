import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Pressable,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface VideoPlayerProps {
  uri: string;
  style?: any;
  height?: number;
  autoPlay?: boolean;
}

export default function VideoPlayer({
  uri,
  style,
  height = 300,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const hideTimer = useRef<any>(null);

  // progress bar layout for scrubbing math
  const [barWidth, setBarWidth] = useState(1);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const scheduleHideControls = () => {
    clearHideTimer();
    // hide only when playing
    if (isPlaying) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2000);
    }
  };

  useEffect(() => {
    scheduleHideControls();
    return () => clearHideTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // unloaded or error
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis);
    setDuration(status.durationMillis || 0);

    // keep controls visible when paused
    if (!status.isPlaying) setShowControls(true);
  };

  const togglePlayPause = async () => {
    try {
      if (!videoRef.current) return;

      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }

      setShowControls(true);
      scheduleHideControls();
    } catch (e) {
      console.error('togglePlayPause error', e);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    setShowControls(true);
    scheduleHideControls();
  };

  const openFullscreen = async () => {
    try {
      if (!videoRef.current) return;
      setShowControls(true);
      await videoRef.current.presentFullscreenPlayer();
      // fullscreen player manages its own UI; when you return:
      scheduleHideControls();
    } catch (e) {
      console.error('presentFullscreenPlayer error', e);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekToPercent = async (pct: number) => {
    if (!videoRef.current || !duration) return;
    const clamped = Math.max(0, Math.min(1, pct));
    const target = Math.floor(duration * clamped);
    try {
      await videoRef.current.setPositionAsync(target);
      setPosition(target);
    } catch (e) {
      console.error('seek error', e);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setShowControls(true);
          clearHideTimer();
          const x = evt.nativeEvent.locationX;
          seekToPercent(x / barWidth);
        },
        onPanResponderMove: (evt) => {
          const x = evt.nativeEvent.locationX;
          seekToPercent(x / barWidth);
        },
        onPanResponderRelease: () => {
          scheduleHideControls();
        },
        onPanResponderTerminate: () => {
          scheduleHideControls();
        },
      }),
    // duration and barWidth need to be current
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [duration, barWidth, isPlaying]
  );

  const progressPct = duration ? (position / duration) * 100 : 0;

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(Math.max(1, e.nativeEvent.layout.width));
  };

  return (
    <Pressable
      style={[styles.container, { height }, style]}
      onPress={() => {
        // tap video to show/hide controls
        setShowControls((prev) => {
          const next = !prev;
          if (next) scheduleHideControls();
          else clearHideTimer();
          return next;
        });
      }}
    >
      <Video
        ref={videoRef}
        source={{ uri }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        useNativeControls={false}
        isMuted={isMuted}
        shouldPlay={autoPlay}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {showControls && (
        <>
          {/* Big play/pause */}
          <TouchableOpacity style={styles.playButton} onPress={togglePlayPause} activeOpacity={0.9}>
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={64}
              color="#fff"
            />
          </TouchableOpacity>

          {/* Bottom controls */}
          <View style={styles.controls}>
            <TouchableOpacity onPress={toggleMute} style={styles.iconBtn}>
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>

            <Text style={styles.timeText}>{formatTime(position)}</Text>

            <View style={styles.progressWrap} onLayout={onBarLayout} {...panResponder.panHandlers}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            </View>

            <Text style={styles.timeText}>{formatTime(duration)}</Text>

            <TouchableOpacity onPress={openFullscreen} style={styles.iconBtn}>
              <Ionicons name="expand" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    gap: 8,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    width: 44,
    textAlign: 'center',
  },
  progressWrap: {
    flex: 1,
    height: 28,
    justifyContent: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
});
