import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';

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
  if (!mediaUrl || !mediaType) return null;

  const uri = resolveUri(mediaUrl, mediaType);

  if (mediaType === 'image') {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, style]}
        resizeMode="cover"
      />
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
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#000',
  },
});
