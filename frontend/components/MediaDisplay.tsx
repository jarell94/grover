import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import FeedVideoPlayer from './FeedVideoPlayer';
import { Colors } from '../constants/Colors';

interface MediaDisplayProps {
  mediaUrl?: string; // Cloudinary secure_url (preferred)
  mediaType?: 'image' | 'video' | 'audio' | string;
  title?: string;
  style?: any;
  isVisible?: boolean;
  onDoubleTapLike?: () => void;
  preloadUri?: string;
  useFeedPlayer?: boolean;

  /**
   * Optional legacy: only set true if your backend sometimes returns raw base64 (not recommended with Cloudinary)
   */
  allowLegacyBase64?: boolean;
}

function isProbablyUrl(u: string) {
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

function resolveUri(mediaUrl: string, mediaType: string, allowLegacyBase64 = false) {
  // If it already looks like a URI, return as-is
  if (isProbablyUrl(mediaUrl)) return mediaUrl;

  // If you truly have legacy base64 coming from backend, wrap it only when explicitly allowed
  if (allowLegacyBase64) {
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

  // Otherwise treat it as invalid (Cloudinary should always be a URL)
  return '';
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
  allowLegacyBase64 = false,
}: MediaDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!mediaUrl || !mediaType) return null;

  const uri = resolveUri(mediaUrl, mediaType, allowLegacyBase64);

  if (!uri) {
    return (
      <View style={[styles.image, styles.errorContainer, style]}>
        <Ionicons name="alert-circle-outline" size={32} color={Colors.textSecondary} />
        <Text style={styles.errorText}>Invalid media URL</Text>
      </View>
    );
  }

  if (mediaType === 'image') {
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
          source={{ uri }}
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
    // IMPORTANT: always pass resolved uri, not raw mediaUrl
    if (useFeedPlayer) {
      return (
        <FeedVideoPlayer
          uri={uri}
          style={style}
          isVisible={isVisible}
          onDoubleTapLike={onDoubleTapLike}
          preloadUri={preloadUri}
          showControls={true}
          autoPlay={isVisible}
          loop={true}
        />
      );
    }
    return <VideoPlayer uri={uri} style={style} />;
  }

  if (mediaType === 'audio') {
    return <AudioPlayer uri={uri} title={title} />;
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
