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
import { Video, AVPlaybackStatus } from 'expo-av';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

const genres = ['Drama', 'Comedy', 'Documentary', 'Horror', 'Sci-Fi', 'Action', 'Romance', 'Thriller', 'Animation', 'Other'];

interface FileUpload {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export default function UploadFilmScreen() {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [title, setTitle] = useState('');
  const [filmmakerName, setFilmmakerName] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [price, setPrice] = useState('0.00');
  const [isDownloadable, setIsDownloadable] = useState(false);
  const [videoFile, setVideoFile] = useState<FileUpload | null>(null);
  const [thumbnail, setThumbnail] = useState<FileUpload | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [extractingMetadata, setExtractingMetadata] = useState(false);

  const pickVideoFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['video/mp4', 'video/quicktime', 'video/webm', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        // Check file size (max 500MB)
        if (file.size && file.size > 500 * 1024 * 1024) {
          Alert.alert('Error', 'Video file must be less than 500MB');
          return;
        }
        setVideoFile(file);
        
        // Extract video metadata
        await extractVideoMetadata(file.uri);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video file');
    }
  };

  const extractVideoMetadata = async (uri: string) => {
    try {
      setExtractingMetadata(true);
      setUploadStatus('Analyzing video...');
      
      // Create a video component to extract duration
      const { sound, status } = await Video.createAsync(
        { uri },
        {},
        null,
        false
      );
      
      if (status && status.isLoaded && status.durationMillis) {
        const durationSeconds = Math.round(status.durationMillis / 1000);
        setDuration(durationSeconds);
        setUploadStatus(`Video duration: ${formatDuration(durationSeconds)}`);
        
        // Unload the video
        if (sound) {
          await sound.unloadAsync();
        }
      }
    } catch (error) {
      console.error('Error extracting metadata:', error);
      setUploadStatus('Could not extract video duration');
    } finally {
      setExtractingMetadata(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const pickThumbnail = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setThumbnail(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking thumbnail:', error);
      Alert.alert('Error', 'Failed to pick thumbnail');
    }
  };

  const validateForm = (): boolean => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a film title');
      return false;
    }
    if (!filmmakerName.trim()) {
      Alert.alert('Error', 'Please enter filmmaker name');
      return false;
    }
    if (!videoFile) {
      Alert.alert('Error', 'Please select a video file');
      return false;
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0 || priceNum > 9999.99) {
      Alert.alert('Error', 'Price must be between 0 and 9999.99');
      return false;
    }

    const year = parseInt(releaseYear);
    if (releaseYear && (isNaN(year) || year < 1900 || year > 2100)) {
      Alert.alert('Error', 'Please enter a valid release year');
      return false;
    }

    return true;
  };

  const handleUpload = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setUploadProgress(0);
      setUploadStatus('Preparing upload...');

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('filmmaker_name', filmmakerName.trim());
      formData.append('price', price);

      if (genre) formData.append('genre', genre);
      if (description) formData.append('description', description.trim());
      if (releaseYear) formData.append('release_year', releaseYear);
      if (duration) formData.append('duration', duration.toString());
      if (isDownloadable !== undefined) formData.append('is_downloadable', isDownloadable.toString());

      // Add video file
      if (videoFile) {
        formData.append('video_file', {
          uri: videoFile.uri,
          name: videoFile.name || 'video.mp4',
          type: videoFile.mimeType || 'video/mp4',
        } as any);
      }

      // Add thumbnail if provided
      if (thumbnail) {
        formData.append('thumbnail', {
          uri: thumbnail.uri,
          name: thumbnail.name || 'thumbnail.jpg',
          type: thumbnail.mimeType || 'image/jpeg',
        } as any);
      }

      setUploadStatus('Uploading video...');
      
      // Simulate progress (actual progress tracking requires XMLHttpRequest or axios)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      await api.uploadFilm(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadStatus('Upload complete!');

      Alert.alert('Success', 'Film uploaded successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Better error messages
      let errorMessage = 'Failed to upload film';
      if (error.message?.includes('timeout') || error.message?.includes('ECONNABORTED')) {
        errorMessage = 'Upload timeout. Please check your connection and try again.';
      } else if (error.response?.status === 413) {
        errorMessage = 'File is too large. Maximum size is 500MB.';
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.detail || 'Invalid file or data provided.';
      } else if (error.response?.status === 401) {
        errorMessage = 'You must be logged in to upload videos.';
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Please check your network.';
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      
      setUploadStatus('Upload failed');
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#6B46C1', '#9333EA']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Film</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video File Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>Video File *</Text>
          <TouchableOpacity
            style={[styles.filePicker, videoFile && styles.filePickerActive]}
            onPress={pickVideoFile}
          >
            <Ionicons
              name={videoFile ? 'checkmark-circle' : 'film'}
              size={24}
              color={videoFile ? Colors.light.tint : '#666'}
            />
            <Text style={[styles.filePickerText, videoFile && styles.filePickerTextActive]}>
              {videoFile ? videoFile.name : 'Choose Video (MP4, MOV, WebM - Max 500MB)'}
            </Text>
          </TouchableOpacity>
          {videoFile && videoFile.size && (
            <Text style={styles.fileSize}>
              Size: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB
            </Text>
          )}
          {duration && (
            <Text style={styles.fileSize}>
              Duration: {formatDuration(duration)}
            </Text>
          )}
          {extractingMetadata && (
            <View style={styles.metadataExtraction}>
              <ActivityIndicator size="small" color={Colors.light.tint} />
              <Text style={styles.metadataText}>Analyzing video...</Text>
            </View>
          )}
        </View>

        {/* Thumbnail */}
        <View style={styles.section}>
          <Text style={styles.label}>Thumbnail (16:9 recommended)</Text>
          <TouchableOpacity
            style={[styles.imagePicker, thumbnail && styles.imagePickerActive]}
            onPress={pickThumbnail}
          >
            {thumbnail ? (
              <Image source={{ uri: thumbnail.uri }} style={styles.thumbnailPreview} />
            ) : (
              <>
                <Ionicons name="image-outline" size={40} color="#666" />
                <Text style={styles.imagePickerText}>Choose Thumbnail</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.label}>Film Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter film title"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#999"
          />
        </View>

        {/* Filmmaker Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Filmmaker Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name or production company"
            value={filmmakerName}
            onChangeText={setFilmmakerName}
            placeholderTextColor="#999"
          />
        </View>

        {/* Genre */}
        <View style={styles.section}>
          <Text style={styles.label}>Genre</Text>
          <View style={styles.genreContainer}>
            {genres.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genreChip, genre === g && styles.genreChipActive]}
                onPress={() => setGenre(g)}
              >
                <Text style={[styles.genreText, genre === g && styles.genreTextActive]}>
                  {g}
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
            placeholder="Tell viewers about your film..."
            value={description}
            onChangeText={setDescription}
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
          />
        </View>

        {/* Release Year */}
        <View style={styles.section}>
          <Text style={styles.label}>Release Year</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 2024"
            value={releaseYear}
            onChangeText={setReleaseYear}
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={4}
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
        {loading && uploadProgress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {uploadProgress}% - {uploadStatus}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[styles.uploadButton, loading && styles.uploadButtonDisabled]}
          onPress={handleUpload}
          disabled={loading}
        >
          {loading ? (
            <>
              <ActivityIndicator color="white" />
              <Text style={styles.uploadButtonText}> Uploading...</Text>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload" size={24} color="white" />
              <Text style={styles.uploadButtonText}>Upload Film</Text>
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
  thumbnailPreview: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  genreChipActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  genreText: {
    fontSize: 14,
    color: '#666',
  },
  genreTextActive: {
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
  progressContainer: {
    marginTop: 20,
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.light.tint,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  metadataExtraction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F0E6FF',
    borderRadius: 8,
  },
  metadataText: {
    marginLeft: 8,
    fontSize: 12,
    color: Colors.light.tint,
  },
});
