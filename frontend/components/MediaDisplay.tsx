import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import FeedVideoPlayer from './FeedVideoPlayer';
import { Colors } from '../constants/Colors';
import { normalizeRemoteUrl } from '../utils/normalizeRemoteUrl';

interface MediaDisplayProps {
  mediaUrl?: string; // Cloudinary secure_url
  mediaType?: 'image' | 'video' | 'audio' | string;
  title?: string;
  style?: any;
  isVisible?: boolean;
  onDoubleTapLike?: () => void;
  preloadUri?: string;
  useFeedPlayer?: boolean;
}

/**
 * Resolve media URI with normalization and legacy base64 fallback
 */
function resolveUri(mediaUrl: string, mediaType: string): string {
  const u = normalizeRemoteUrl(mediaUrl);

  // If it's any valid URI-like thing, use it
  if (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('file://') ||
    u.startsWith('content://') ||
    u.startsWith('ph://') ||
    u.startsWith('blob:') ||
    u.startsWith('data:')
  ) {
    return u;
  }

  // Legacy base64 fallback (if you still have old data stored)
  switch (mediaType) {
    case 'image':
      return `data:image/jpeg;base64,${mediaUrl}`;
    case 'video':
      return `data:video/mp4;base64,${mediaUrl}`;
    case 'audio':
      return `data:audio/mpeg;base64,${mediaUrl}`;
    default:
      return mediaUrl;
  }
}

export default function MediaDisplay({
  mediaUrl,
  mediaType,
  title,
  style,
  isVisible = true,
  onDoubleTapLike,
  preloadUri,
  useFeedPlayer = true,
}: MediaDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!mediaUrl || !mediaType) return null;

  if (mediaType === 'image') {
    const safe = resolveUri(mediaUrl, 'image');

    if (error) {
      return (
        <View style={[styles.image, styles.errorContainer, style]}>
          <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
          <Text style={styles.errorText}>Failed to load image</Text>
        </View>
      );
    }

    return (
      <View style={[styles.imageContainer, style]}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}
        <Image
          source={{ uri: safe }}
          style={[styles.image, style]}
          resizeMode="cover"
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      </View>
    );
  }

  if (mediaType === 'video') {
    const safe = resolveUri(mediaUrl, 'video');

    if (useFeedPlayer) {
      return (
        <FeedVideoPlayer
          uri={safe}
          style={style}
          isVisible={isVisible}
          onDoubleTapLike={onDoubleTapLike}
          preloadUri={preloadUri ? normalizeRemoteUrl(preloadUri) : undefined}
          showControls
          autoPlay={isVisible}
          loop
        />
      );
    }

    return <VideoPlayer uri={safe} style={style} />;
  }

  if (mediaType === 'audio') {
    const safe = resolveUri(mediaUrl, 'audio');
    return <AudioPlayer uri={safe} title={title} />;
  }

  return null;
}

const styles = StyleSheet.create({
  imageContainer: { position: 'relative' },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    zIndex: 1,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
});
