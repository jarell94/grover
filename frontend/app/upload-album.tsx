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
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/Colors';
import { api } from '../services/api';

const genres = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Jazz', 'Classical', 'Country', 'Other'];

export default function UploadAlbumScreen() {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [price, setPrice] = useState('0.00');
  const [coverArt, setCoverArt] = useState<any>(null);

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
      Alert.alert('Error', 'Please enter an album title');
      return false;
    }
    if (!artistName.trim()) {
      Alert.alert('Error', 'Please enter artist name');
      return false;
    }
    if (!coverArt) {
      Alert.alert('Error', 'Please select cover art');
      return false;
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0 || priceNum > 9999.99) {
      Alert.alert('Error', 'Price must be between 0 and 9999.99');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('artist_name', artistName.trim());
      formData.append('price', price);
      
      if (description.trim()) formData.append('description', description.trim());
      if (genre) formData.append('genre', genre);
      if (releaseDate.trim()) formData.append('release_date', releaseDate.trim());

      // Append cover art
      const coverUri = coverArt.uri;
      const coverName = 'cover.jpg';
      const coverType = 'image/jpeg';
      
      formData.append('cover_art', {
        uri: coverUri,
        name: coverName,
        type: coverType,
      } as any);

      const response = await api.post('/albums', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert(
        'Success',
        'Album created! You can now add songs to this album.',
        [
          {
            text: 'Add Songs',
            onPress: () => router.push(`/upload-song?albumId=${response.data.album_id}`),
          },
          {
            text: 'Later',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Create album error:', error);
      const message = error.response?.data?.detail || 'Failed to create album';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary + '20', Colors.background]}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Album</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Cover Art Picker */}
        <TouchableOpacity style={styles.coverArtCard} onPress={pickCoverArt}>
          {coverArt ? (
            <Image source={{ uri: coverArt.uri }} style={styles.coverArtImage} />
          ) : (
            <View style={styles.coverArtPlaceholder}>
              <Ionicons name="albums-outline" size={64} color={Colors.textSecondary} />
              <Text style={styles.coverArtText}>Add Album Cover</Text>
              <Text style={styles.coverArtSubtext}>Required</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Album Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter album title"
            placeholderTextColor={Colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </View>

        {/* Artist Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Artist Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter artist name"
            placeholderTextColor={Colors.textSecondary}
            value={artistName}
            onChangeText={setArtistName}
            maxLength={100}
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your album..."
            placeholderTextColor={Colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={1000}
          />
        </View>

        {/* Genre */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Genre</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreList}>
            {genres.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genreChip, genre === g && styles.genreChipActive]}
                onPress={() => setGenre(g === genre ? '' : g)}
              >
                <Text style={[styles.genreText, genre === g && styles.genreTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Release Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Release Date (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD or text (e.g., 'Coming Soon')"
            placeholderTextColor={Colors.textSecondary}
            value={releaseDate}
            onChangeText={setReleaseDate}
            maxLength={50}
          />
        </View>

        {/* Price */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Album Price (USD)</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.priceInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textSecondary}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              maxLength={7}
            />
            <Text style={styles.priceHint}>Set to 0 for free</Text>
          </View>
          <Text style={styles.priceNote}>
            Note: Individual songs can have separate pricing
          </Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={Colors.primary} />
          <Text style={styles.infoText}>
            After creating the album, you'll be able to add songs and set their order.
          </Text>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreate}
          disabled={loading}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.primary + 'CC']}
            style={styles.createButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <>
                <Ionicons name="albums" size={24} color={Colors.background} />
                <Text style={styles.createButtonText}>Create Album</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  coverArtCard: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  coverArtImage: {
    width: '100%',
    height: '100%',
  },
  coverArtPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverArtText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  coverArtSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    minHeight: 100,
  },
  genreList: {
    marginTop: 8,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    marginRight: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genreChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genreText: {
    fontSize: 14,
    color: Colors.text,
  },
  genreTextActive: {
    color: Colors.background,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  priceHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  priceNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '20',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  createButton: {
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  createButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
