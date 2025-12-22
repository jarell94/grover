import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

import { api } from '../services/api';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  card: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  border: 'rgba(255,255,255,0.1)',
};

type Picked = ImagePicker.ImagePickerAsset & { mimeType?: string };

function guessMimeType(uri: string, assetType?: string, mimeType?: string) {
  if (mimeType) return mimeType;

  const lower = uri.toLowerCase();
  if (assetType === 'video') {
    if (lower.endsWith('.mov')) return 'video/quicktime';
    if (lower.endsWith('.m4v')) return 'video/x-m4v';
    return 'video/mp4';
  }

  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function guessFileExt(mime: string) {
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('x-m4v')) return 'm4v';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('heic') || mime.includes('heif')) return 'heic';
  return 'jpg';
}

export default function CreateStoryScreen() {
  const [selectedMedia, setSelectedMedia] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const videoRef = useRef<Video>(null);

  const isVideo = selectedMedia?.type === 'video';

  const canPost = useMemo(() => !!selectedMedia?.uri && !uploading, [selectedMedia, uploading]);

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
      base64: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelectedMedia(result.assets[0] as Picked);
    }
  };

  const takePhotoOrVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
      base64: false,
    });

    if (!result.canceled && result.assets?.[0]) {
      setSelectedMedia(result.assets[0] as Picked);
    }
  };

  const createStory = async () => {
    if (!selectedMedia?.uri) {
      Alert.alert('Error', 'Please select a photo or video');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      const mime = guessMimeType(
        selectedMedia.uri,
        selectedMedia.type,
        (selectedMedia as any).mimeType
      );
      const ext = guessFileExt(mime);
      const filename = `story-${Date.now()}.${ext}`;

      formData.append('media', {
        uri: selectedMedia.uri,
        type: mime,
        name: filename,
      } as any);

      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      await api.createStory(formData);

      Alert.alert('Success', 'Story posted!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      console.error('Create story error:', error);
      Alert.alert('Error', 'Failed to post story');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <View style={{ width: 28 }} />
      </View>

      {selectedMedia ? (
        <View style={styles.previewContainer}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: selectedMedia.uri }}
              style={styles.preview}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
              useNativeControls={false}
              onError={(e) => console.log('Video error', e)}
            />
          ) : (
            <Image source={{ uri: selectedMedia.uri }} style={styles.preview} resizeMode="cover" />
          )}

          <View style={styles.captionOverlay}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor={Colors.textSecondary}
              value={caption}
              onChangeText={setCaption}
              multiline
              editable={!uploading}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                setSelectedMedia(null);
                setCaption('');
              }}
              disabled={uploading}
            >
              <Ionicons name="refresh" size={22} color={Colors.text} />
              <Text style={styles.actionText}>Change</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.postButton, (!canPost || uploading) && styles.postButtonDisabled]}
              onPress={createStory}
              disabled={!canPost || uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={styles.postButtonText}>Post</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Create a Story</Text>
          <Text style={styles.emptySubtitle}>Share a moment that disappears in 24 hours</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={takePhotoOrVideo}>
              <Ionicons name="camera" size={32} color={Colors.primary} />
              <Text style={styles.buttonText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={pickFromGallery}>
              <Ionicons name="images" size={32} color={Colors.primary} />
              <Text style={styles.buttonText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>Story Tips</Text>
            <Text style={styles.tip}>Stories disappear after 24 hours</Text>
            <Text style={styles.tip}>Add captions, reactions, and replies</Text>
            <Text style={styles.tip}>Save your favorites to Highlights</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.text, marginTop: 24 },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },

  buttonContainer: { flexDirection: 'row', gap: 16, marginBottom: 48 },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    minWidth: 140,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: { fontSize: 14, fontWeight: '600', color: Colors.text, marginTop: 8 },

  tips: {
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipsTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  tip: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },

  previewContainer: { flex: 1, position: 'relative' },
  preview: { width: '100%', height: '100%' },

  captionOverlay: { position: 'absolute', bottom: 120, left: 16, right: 16 },
  captionInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    maxHeight: 120,
  },

  actions: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  actionText: { fontSize: 16, fontWeight: '600', color: Colors.text },

  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  postButtonDisabled: { opacity: 0.6 },
  postButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
