import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';
import { Colors } from '../constants/Colors';

interface MediaDisplayProps {
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | string;
  title?: string;
  style?: any;
}

function resolveUri(mediaUrl: string, mediaType: string) {
  // If already a remote URL, return as-is
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    return mediaUrl;
  }

  // Otherwise assume base64
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
}: MediaDisplayProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!mediaUrl || !mediaType) return null;

  const uri = resolveUri(mediaUrl, mediaType);

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
    return <VideoPlayer uri={uri} style={style} />;
  }

  if (mediaType === 'audio') {
    return <AudioPlayer uri={uri} title={title} />;
  }

  return null;
}

const styles = StyleSheet.create({
  imageContainer: {
    position: 'relative',
  },
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
