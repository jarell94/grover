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
  ScrollView,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

import { api } from '../services/api';
import MusicPicker from '../components/MusicPicker';

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

type Picked = ImagePicker.ImagePickerAsset & { mimeType?: string; caption?: string };

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

interface SelectedMusic {
  id: string;
  title: string;
  artist: string;
  url: string;
}

export default function CreateStoryScreen() {
  const [selectedMedia, setSelectedMedia] = useState<Picked[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<SelectedMusic | null>(null);
  const [showDraftsButton, setShowDraftsButton] = useState(true);

  const videoRef = useRef<Video>(null);

  const currentMedia = selectedMedia[currentIndex];
  const isVideo = currentMedia?.type === 'video';
  const canPost = selectedMedia.length > 0 && !uploading;

  const pickMultipleFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.85,
      base64: false,
    });

    if (!result.canceled && result.assets) {
      const media = result.assets.map(asset => ({ ...asset, caption: '' } as Picked));
      setSelectedMedia(media);
      setCurrentIndex(0);
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
      const media = { ...result.assets[0], caption: '' } as Picked;
      setSelectedMedia([media]);
      setCurrentIndex(0);
    }
  };

  const addMoreMedia = async () => {
    if (selectedMedia.length >= 10) {
      Alert.alert('Limit Reached', 'You can only add up to 10 stories at once');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      selectionLimit: 10 - selectedMedia.length,
      quality: 0.85,
      base64: false,
    });

    if (!result.canceled && result.assets) {
      const newMedia = result.assets.map(asset => ({ ...asset, caption: '' } as Picked));
      setSelectedMedia([...selectedMedia, ...newMedia]);
    }
  };

  const removeMedia = (index: number) => {
    const newMedia = selectedMedia.filter((_, i) => i !== index);
    setSelectedMedia(newMedia);
    if (currentIndex >= newMedia.length) {
      setCurrentIndex(Math.max(0, newMedia.length - 1));
    }
  };

  const updateCaption = (text: string) => {
    const updated = [...selectedMedia];
    updated[currentIndex] = { ...updated[currentIndex], caption: text };
    setSelectedMedia(updated);
  };

  const saveAsDraft = async () => {
    if (!currentMedia?.uri) {
      Alert.alert('Error', 'No media selected');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();

      const mime = guessMimeType(currentMedia.uri, currentMedia.type, (currentMedia as any).mimeType);
      const ext = guessFileExt(mime);
      const filename = `draft-${Date.now()}.${ext}`;

      formData.append('media', {
        uri: currentMedia.uri,
        type: mime,
        name: filename,
      } as any);

      if (currentMedia.caption?.trim()) {
        formData.append('caption', currentMedia.caption.trim());
      }

      if (selectedMusic) {
        formData.append('music_url', selectedMusic.url);
        formData.append('music_title', selectedMusic.title);
        formData.append('music_artist', selectedMusic.artist);
      }

      await api.saveStoryDraft(formData);
      Alert.alert('Success', 'Story saved as draft', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      console.error('Save draft error:', error);
      Alert.alert('Error', 'Failed to save draft');
    } finally {
      setUploading(false);
    }
  };

  const createStories = async () => {
    if (selectedMedia.length === 0) {
      Alert.alert('Error', 'Please select at least one photo or video');
      return;
    }

    setUploading(true);
    try {
      if (selectedMedia.length === 1) {
        // Single story
        const formData = new FormData();
        const media = selectedMedia[0];

        const mime = guessMimeType(media.uri, media.type, (media as any).mimeType);
        const ext = guessFileExt(mime);
        const filename = `story-${Date.now()}.${ext}`;

        formData.append('media', {
          uri: media.uri,
          type: mime,
          name: filename,
        } as any);

        if (media.caption?.trim()) {
          formData.append('caption', media.caption.trim());
        }

        if (selectedMusic) {
          formData.append('music_url', selectedMusic.url);
          formData.append('music_title', selectedMusic.title);
          formData.append('music_artist', selectedMusic.artist);
        }

        await api.createStory(formData);
      } else {
        // Batch upload
        const formData = new FormData();
        
        selectedMedia.forEach((media, index) => {
          const mime = guessMimeType(media.uri, media.type, (media as any).mimeType);
          const ext = guessFileExt(mime);
          const filename = `story-${Date.now()}-${index}.${ext}`;

          formData.append('media', {
            uri: media.uri,
            type: mime,
            name: filename,
          } as any);
        });

        // Add captions as JSON array
        const captions = selectedMedia.map(m => m.caption || null);
        formData.append('captions', JSON.stringify(captions));

        if (selectedMusic) {
          formData.append('music_url', selectedMusic.url);
          formData.append('music_title', selectedMusic.title);
          formData.append('music_artist', selectedMusic.artist);
        }

        await api.createStoriesBatch(formData);
      }

      Alert.alert('Success', `${selectedMedia.length} ${selectedMedia.length === 1 ? 'story' : 'stories'} posted!`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Create story error:', error);
      Alert.alert('Error', 'Failed to post story');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectMusic = (track: any) => {
    setSelectedMusic({
      id: track.id,
      title: track.title,
      artist: track.artist,
      url: track.url,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        {showDraftsButton && (
          <TouchableOpacity onPress={() => router.push('/story-drafts')}>
            <Ionicons name="document-text-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {selectedMedia.length > 0 ? (
        <View style={styles.previewContainer}>
          {/* Current Media Preview */}
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: currentMedia.uri }}
              style={styles.preview}
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
              useNativeControls={false}
              onError={(e) => console.log('Video error', e)}
            />
          ) : (
            <Image source={{ uri: currentMedia.uri }} style={styles.preview} resizeMode="cover" />
          )}

          {/* Media Counter */}
          {selectedMedia.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {selectedMedia.length}
              </Text>
            </View>
          )}

          {/* Thumbnail Carousel */}
          {selectedMedia.length > 1 && (
            <View style={styles.carousel}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedMedia.map((media, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.thumbnail, index === currentIndex && styles.activeThumbnail]}
                    onPress={() => setCurrentIndex(index)}
                    onLongPress={() => removeMedia(index)}
                  >
                    <Image source={{ uri: media.uri }} style={styles.thumbnailImage} />
                    {media.type === 'video' && (
                      <View style={styles.thumbnailVideoIcon}>
                        <Ionicons name="play" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                {selectedMedia.length < 10 && (
                  <TouchableOpacity style={styles.addMoreThumbnail} onPress={addMoreMedia}>
                    <Ionicons name="add" size={24} color={Colors.text} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}

          {/* Caption Input */}
          <View style={styles.captionOverlay}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a caption..."
              placeholderTextColor={Colors.textSecondary}
              value={currentMedia.caption || ''}
              onChangeText={updateCaption}
              multiline
              editable={!uploading}
            />
          </View>

          {/* Music Display */}
          {selectedMusic && (
            <View style={styles.musicBanner}>
              <Ionicons name="musical-notes" size={16} color={Colors.text} />
              <Text style={styles.musicText} numberOfLines={1}>
                {selectedMusic.title} - {selectedMusic.artist}
              </Text>
              <TouchableOpacity onPress={() => setSelectedMusic(null)}>
                <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actions}>
            <View style={styles.leftActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowMusicPicker(true)}
                disabled={uploading}
              >
                <Ionicons name="musical-notes" size={24} color={Colors.text} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.iconButton}
                onPress={saveAsDraft}
                disabled={uploading}
              >
                <Ionicons name="bookmark-outline" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.postButton, (!canPost || uploading) && styles.postButtonDisabled]}
              onPress={createStories}
              disabled={!canPost || uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.postButtonText}>
                    Post {selectedMedia.length > 1 ? `(${selectedMedia.length})` : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="images-outline" size={80} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Create a Story</Text>
          <Text style={styles.emptySubtitle}>Share moments that disappear in 24 hours</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={takePhotoOrVideo}>
              <Ionicons name="camera" size={32} color={Colors.primary} />
              <Text style={styles.buttonText}>Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={pickMultipleFromGallery}>
              <Ionicons name="images" size={32} color={Colors.primary} />
              <Text style={styles.buttonText}>Gallery</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>✨ New Features</Text>
            <Text style={styles.tip}>📸 Upload multiple stories at once</Text>
            <Text style={styles.tip}>🎵 Add music to your stories</Text>
            <Text style={styles.tip}>💾 Save drafts for later</Text>
            <Text style={styles.tip}>📦 Archive your favorite stories</Text>
          </View>
        </View>
      )}

      <MusicPicker
        visible={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={handleSelectMusic}
      />
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

  counter: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },

  carousel: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  thumbnail: {
    width: 50,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  activeThumbnail: {
    borderColor: Colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailVideoIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreThumbnail: {
    width: 50,
    height: 70,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },

  captionOverlay: { 
    position: 'absolute', 
    bottom: selectedMedia?.length > 1 ? 160 : 120, 
    left: 16, 
    right: 16 
  },
  captionInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    maxHeight: 120,
  },

  musicBanner: {
    position: 'absolute',
    bottom: selectedMedia?.length > 1 ? 280 : 240,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  musicText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
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
  leftActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

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
