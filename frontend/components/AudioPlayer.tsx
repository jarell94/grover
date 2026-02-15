import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Pressable } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface AudioPlayerProps {
  uri: string;      // https://... OR file://... OR data:audio/...;base64,...
  title?: string;
}

/**
 * Global single-audio policy:
 * keep a reference to whichever sound is currently playing.
 */
let globalCurrentSound: Audio.Sound | null = null;

function isDataAudioUri(u: string) {
  return typeof u === 'string' && u.startsWith('data:audio/');
}

async function dataUriToFile(dataUri: string) {
  // data:audio/mpeg;base64,AAA...
  const match = dataUri.match(/^data:(audio\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
  if (!match) return null;

  const mime = match[1];
  const base64 = match[2];

  const ext =
    mime.includes('mpeg') ? 'mp3' :
    mime.includes('wav') ? 'wav' :
    mime.includes('mp4') || mime.includes('aac') ? 'm4a' :
    'mp3';

  if (!cacheDirectory) return null;
  const path = `${cacheDirectory}audio_${Date.now()}.${ext}`;
  await writeAsStringAsync(path, base64, { encoding: EncodingType.Base64 });
  return path;
}

export default function AudioPlayer({ uri, title }: AudioPlayerProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const loadingRef = useRef(false);
  const progressWidthRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  // If the uri is a data: uri, convert to file on native
  const safeUri = useMemo(() => uri, [uri]);

  useEffect(() => {
    // Ideally do this once at app start, but this is OK.
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // When uri changes or unmount, unload
    return () => {
      unload().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeUri]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis ?? 0);
    setDuration(status.durationMillis ?? 0);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPosition(0);
    }
  }, []);

  const unload = useCallback(async () => {
    const s = soundRef.current;
    soundRef.current = null;

    // If this was the global current sound, clear it
    if (globalCurrentSound === s) globalCurrentSound = null;

    if (s) {
      try {
        await s.unloadAsync();
      } catch {}
    }
  }, []);

  const ensureLoaded = useCallback(async () => {
    if (soundRef.current) return;
    if (loadingRef.current) return;

    loadingRef.current = true;
    setIsLoading(true);

    try {
      // If we got a data: uri, convert it to a temp file for native reliability
      let sourceUri = safeUri;
      if (isDataAudioUri(sourceUri)) {
        const fileUri = await dataUriToFile(sourceUri);
        if (fileUri) sourceUri = fileUri;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: sourceUri },
        { shouldPlay: false, progressUpdateIntervalMillis: 250 },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [safeUri, onPlaybackStatusUpdate]);

  const togglePlayPause = useCallback(async () => {
    try {
      await ensureLoaded();
      const s = soundRef.current;
      if (!s) return;

      if (isPlaying) {
        await s.pauseAsync();
        return;
      }

      // Pause any other sound in the app (single-audio policy)
      if (globalCurrentSound && globalCurrentSound !== s) {
        try {
          await globalCurrentSound.pauseAsync();
        } catch {}
      }

      globalCurrentSound = s;
      await s.playAsync();
    } catch (e) {
      console.error('Audio toggle error:', e);
    }
  }, [ensureLoaded, isPlaying]);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor((millis || 0) / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const seekToPercent = useCallback(async (percent: number) => {
    try {
      await ensureLoaded();
      const s = soundRef.current;
      if (!s || !duration) return;

      const nextPos = Math.max(0, Math.min(duration, Math.floor(duration * percent)));
      await s.setPositionAsync(nextPos);
    } catch (e) {
      console.error('Seek error:', e);
    }
  }, [ensureLoaded, duration]);

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="musical-notes" size={32} color={Colors.primary} />
      </View>

      <View style={styles.info}>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}

        <View style={styles.progressContainer}>
          <Pressable
            style={styles.progressBar}
            onLayout={(ev) => {
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
