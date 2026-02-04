import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

const categories = ['Technology', 'Business', 'Comedy', 'News', 'Sports', 'Education', 'Health', 'Arts', 'Science', 'Other'];

interface FileUpload {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export default function UploadPodcastScreen() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [hostName, setHostName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [seasonNumber, setSeasonNumber] = useState('');
  const [price, setPrice] = useState('0.00');
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [audioFile, setAudioFile] = useState<FileUpload | null>(null);
  const [coverArt, setCoverArt] = useState<FileUpload | null>(null);

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        // Check file size (max 200MB)
        if (file.size && file.size > 200 * 1024 * 1024) {
          Alert.alert('Error', 'Audio file must be less than 200MB');
          return;
        }
        setAudioFile(file);
      }
    } catch (error) {
      console.error('Error picking audio:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const pickCoverArt = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setCoverArt(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking cover art:', error);
      Alert.alert('Error', 'Failed to pick cover art');
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an episode title');
      return false;
    }
    if (!hostName.trim()) {
      Alert.alert('Error', 'Please enter host name');
      return false;
    }
    if (!audioFile) {
      Alert.alert('Error', 'Please select an audio file');
      return false;
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0 || priceNum > 999.99) {
      Alert.alert('Error', 'Price must be between 0 and 999.99');
      return false;
    }

    if (episodeNumber) {
      const ep = parseInt(episodeNumber);
      if (isNaN(ep) || ep < 1) {
        Alert.alert('Error', 'Please enter a valid episode number');
        return false;
      }
    }

    if (seasonNumber) {
      const season = parseInt(seasonNumber);
      if (isNaN(season) || season < 1) {
        Alert.alert('Error', 'Please enter a valid season number');
        return false;
      }
    }

    return true;
  };

  const handleUpload = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('host_name', hostName.trim());
      formData.append('price', price);

      if (category) formData.append('category', category);
      if (description) formData.append('description', description.trim());
      if (episodeNumber) formData.append('episode_number', episodeNumber);
      if (seasonNumber) formData.append('season_number', seasonNumber);
      if (isDownloadable !== undefined) formData.append('is_downloadable', isDownloadable.toString());

      // Add audio file
      if (audioFile) {
        formData.append('audio_file', {
          uri: audioFile.uri,
          name: audioFile.name || 'podcast.mp3',
          type: audioFile.mimeType || 'audio/mpeg',
        } as any);
      }

      // Add cover art if provided
      if (coverArt) {
        formData.append('cover_art', {
          uri: coverArt.uri,
          name: coverArt.name || 'cover.jpg',
          type: coverArt.mimeType || 'image/jpeg',
        } as any);
      }

      await api.uploadPodcast(formData);

      Alert.alert('Success', 'Podcast episode uploaded successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to upload podcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#EC4899', '#F97316']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Podcast Episode</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Audio File Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Audio File *</Text>
          <TouchableOpacity
            style={[styles.filePicker, audioFile && styles.filePickerActive]}
            onPress={pickAudioFile}
          >
            <Ionicons
              name={audioFile ? 'checkmark-circle' : 'mic'}
              size={24}
              color={audioFile ? Colors.light.tint : '#666'}
            />
            <Text style={[styles.filePickerText, audioFile && styles.filePickerTextActive]}>
              {audioFile ? audioFile.name : 'Choose Audio (MP3, WAV, OGG - Max 200MB)'}
            </Text>
          </TouchableOpacity>
          {audioFile && audioFile.size && (
            <Text style={styles.fileSize}>
              Size: {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
            </Text>
          )}
        </View>

        {/* Cover Art */}
        <View style={styles.section}>
          <Text style={styles.label}>Cover Art (Square recommended)</Text>
          <TouchableOpacity
            style={[styles.imagePicker, coverArt && styles.imagePickerActive]}
            onPress={pickCoverArt}
          >
            {coverArt ? (
              <Image source={{ uri: coverArt.uri }} style={styles.coverPreview} />
            ) : (
              <>
                <Ionicons name="image-outline" size={40} color="#666" />
                <Text style={styles.imagePickerText}>Choose Cover Art</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Episode Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Episode Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter episode title"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#999"
          />
        </View>

        {/* Host Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Host Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name or show name"
            value={hostName}
            onChangeText={setHostName}
            placeholderTextColor="#999"
          />
        </View>

        {/* Episode & Season Numbers */}
        <View style={styles.row}>
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.label}>Episode #</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              value={episodeNumber}
              onChangeText={setEpisodeNumber}
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
          </View>
          
          <View style={[styles.section, styles.halfWidth]}>
            <Text style={styles.label}>Season #</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              value={seasonNumber}
              onChangeText={setSeasonNumber}
              placeholderTextColor="#999"
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe this episode..."
            value={description}
            onChangeText={setDescription}
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
          />
        </View>

        {/* Price */}
        <View style={styles.section}>
          <Text style={styles.label}>Price (USD)</Text>
          <Text style={styles.hint}>Set to 0.00 for free content</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            value={price}
            onChangeText={setPrice}
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Downloadable */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setIsDownloadable(!isDownloadable)}
          >
            <Ionicons
              name={isDownloadable ? 'checkbox' : 'square-outline'}
              size={24}
              color={isDownloadable ? Colors.light.tint : '#666'}
            />
            <Text style={styles.checkboxLabel}>Allow downloads</Text>
          </TouchableOpacity>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="white" />
              <Text style={styles.uploadButtonText}>Upload Episode</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filePickerActive: {
    borderColor: Colors.light.tint,
    backgroundColor: '#F0E6FF',
  },
  filePickerText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  filePickerTextActive: {
    color: Colors.light.tint,
    fontWeight: '600',
  },
  fileSize: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  imagePicker: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderStyle: 'dashed',
  },
  imagePickerActive: {
    borderColor: Colors.light.tint,
    borderStyle: 'solid',
  },
  imagePickerText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  coverPreview: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  uploadButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
