import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Pressable } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface AudioPlayerProps {
  uri: string;      // can be https://... OR data:audio/...;base64,...
  title?: string;
}

/**
 * Optional: global "only one audio at a time"
 * If you want this behavior across your app, keep this.
 */
let currentlyPlayingStopper: null | (() => Promise<void>) = null;

// For seek bar width
const progressWidthRef = { current: 0 };

export default function AudioPlayer({ uri, title }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  const safeUri = useMemo(() => uri, [uri]);

  useEffect(() => {
    // Configure audio mode once per component mount
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true, // important so audio works even if silent switch is on
      staysActiveInBackground: false,
      interruptionModeIOS: 1, // DO_NOT_MIX
      interruptionModeAndroid: 1, // DO_NOT_MIX
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // If uri changes, unload previous sound
    return () => {
      unload().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeUri]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      unload().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis ?? 0);
    setDuration(status.durationMillis ?? 0);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  };

  const unload = async () => {
    const s = soundRef.current;
    soundRef.current = null;

    if (s) {
      try {
        await s.unloadAsync();
      } catch {}
    }
  };

  const ensureLoaded = async () => {
    if (soundRef.current) return;

    if (loadingRef.current) return; // prevent double-load
    loadingRef.current = true;
    setIsLoading(true);

    try {
      // Stop any other audio in the app (optional)
      if (currentlyPlayingStopper) {
        await currentlyPlayingStopper();
        currentlyPlayingStopper = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: safeUri },
        { shouldPlay: false, progressUpdateIntervalMillis: 250 },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;

      // Register stopper for global "single audio"
      currentlyPlayingStopper = async () => {
        try {
          await sound.pauseAsync();
        } catch {}
      };
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    try {
      await ensureLoaded();
      const s = soundRef.current;
      if (!s) return;

      // If starting play, stop other audio first (optional)
      if (!isPlaying && currentlyPlayingStopper) {
        await currentlyPlayingStopper();
        currentlyPlayingStopper = null;
      }

      if (isPlaying) {
        await s.pauseAsync();
      } else {
        // Register this as the current audio stopper
        currentlyPlayingStopper = async () => {
          try {
            await s.pauseAsync();
          } catch {}
        };

        await s.playAsync();
      }
    } catch (e) {
      console.error('Audio toggle error:', e);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor((millis || 0) / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekToPercent = async (percent: number) => {
    try {
      await ensureLoaded();
      const s = soundRef.current;
      if (!s || !duration) return;

      const nextPos = Math.max(0, Math.min(duration, Math.floor(duration * percent)));
      await s.setPositionAsync(nextPos);
    } catch (e) {
      console.error('Seek error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="musical-notes" size={32} color={Colors.primary} />
      </View>

      <View style={styles.info}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}

        <View style={styles.progressContainer}>
          {/* Tap-to-seek bar */}
          <Pressable
            style={styles.progressBar}
            onLayout={(ev) => {
              // store width in ref for seek calculation
              progressWidthRef.current = ev.nativeEvent.layout.width;
            }}
            onPressIn={(e) => {
              const w = progressWidthRef.current || 1;
              const percent = e.nativeEvent.locationX / w;
              seekToPercent(percent);
            }}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${duration ? (position / duration) * 100 : 0}%` },
              ]}
            />
          </Pressable>

          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.playButton} onPress={togglePlayPause} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={48}
            color={Colors.primary}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${Colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  progressContainer: { width: '100%' },
  progressBar: {
    height: 6,
    backgroundColor: Colors.background,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  playButton: { padding: 4 },
});
