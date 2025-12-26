import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import FeedVideoPlayer from './FeedVideoPlayer';
import { Colors } from '../constants/Colors';

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
 * Check if string is a valid URL (Cloudinary or local file)
 */
function isValidMediaUrl(url: string): boolean {
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://') ||
    url.startsWith('content://') ||
    url.startsWith('blob:')
  );
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

  // Cloudinary always returns https URLs - reject anything else
  if (!isValidMediaUrl(mediaUrl)) {
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
          source={{ uri: mediaUrl }}
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
    if (useFeedPlayer) {
      return (
        <FeedVideoPlayer
          uri={mediaUrl}
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
    return <VideoPlayer uri={mediaUrl} style={style} />;
  }

  if (mediaType === 'audio') {
    return <AudioPlayer uri={mediaUrl} title={title} />;
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
