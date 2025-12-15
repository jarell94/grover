import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import VideoPlayer from './VideoPlayer';
import AudioPlayer from './AudioPlayer';

interface MediaDisplayProps {
  mediaUrl?: string;
  mediaType?: string;
  title?: string;
  style?: any;
}

export default function MediaDisplay({ mediaUrl, mediaType, title, style }: MediaDisplayProps) {
  if (!mediaUrl || !mediaType) return null;

  if (mediaType === 'image') {
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${mediaUrl}` }}
        style={[styles.image, style]}
      />
    );
  }

  if (mediaType === 'video') {
    return (
      <VideoPlayer
        uri={`data:video/mp4;base64,${mediaUrl}`}
        style={style}
      />
    );
  }

  if (mediaType === 'audio') {
    return (
      <AudioPlayer
        uri={`data:audio/mpeg;base64,${mediaUrl}`}
        title={title}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
});